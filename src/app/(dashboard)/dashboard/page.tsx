"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { OrderRow, OrderStatus } from "@/types";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatCurrency, getTimeAgo } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const statusCards = [
  { label: "Nouvelles", key: "nouvelle" as const, icon: Package, color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "Confirmées", key: "confirmée" as const, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { label: "Programmées", key: "programmée" as const, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
  { label: "Livrées", key: "livrée" as const, icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
  { label: "Refusées", key: "refusée" as const, icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
  { label: "Injoignables", key: "injoignable" as const, icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500/10" },
];

export default function DashboardPage() {
  const { isAdmin, country } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    if (!isSupabaseReady) return;
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (country) query = query.eq("country", country);

    const { data: allOrders } = await query;
    if (!allOrders) return;
    const typedOrders = allOrders as OrderRow[];

    const c: Record<string, number> = {};
    typedOrders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; });
    c.total = typedOrders.length;
    c.today = typedOrders.filter((o) => {
      const d = new Date(o.created_at);
      return d.toDateString() === new Date().toDateString();
    }).length;

    setCounts(c);
    setRecentOrders(typedOrders.slice(0, 5));
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        loadOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [country]);

  const subtitle = country ? `Équipe ${country}` : isAdmin ? "Vue d'ensemble" : "";

  return (
    <div>
      <Header title={`Dashboard${subtitle ? ` — ${subtitle}` : ""}`} />
      <div className="p-4 lg:p-6 space-y-6">

        {/* Stats statut */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
          {statusCards.map((s) => (
            <Link key={s.key} href={`/orders?status=${s.key}`}>
              <Card className="hover:border-gray-700 transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bg}`}>
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{counts[s.key] || 0}</p>
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activité récente</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1,2,3].map((i) => (
                    <div key={i} className="h-12 bg-gray-800/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Aucune commande récente</p>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <Link key={order.id} href={`/orders/${order.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{order.client_name}</p>
                        <p className="text-xs text-gray-500">{order.product} — {order.city}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-600">{getTimeAgo(order.created_at)}</span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aperçu rapide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-800/30 p-4">
                  <p className="text-sm text-gray-400">Total commandes</p>
                  <p className="text-2xl font-bold text-white mt-1">{counts.total || 0}</p>
                </div>
                <div className="rounded-lg bg-gray-800/30 p-4">
                  <p className="text-sm text-gray-400">Aujourd'hui</p>
                  <p className="text-2xl font-bold text-white mt-1">{counts.today || 0}</p>
                </div>
                <div className="rounded-lg bg-gray-800/30 p-4">
                  <p className="text-sm text-gray-400">Taux de livraison</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {counts.total ? Math.round(((counts["livrée"] || 0) / counts.total) * 100) : 0}%
                  </p>
                </div>
                <div className="rounded-lg bg-gray-800/30 p-4">
                  <p className="text-sm text-gray-400">En attente</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">
                    {(counts["nouvelle"] || 0) + (counts["confirmée"] || 0) + (counts["programmée"] || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
