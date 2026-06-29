"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { OrderRow } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { Phone, Calendar, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function RemindersPage() {
  const { profile, role } = useAuth();
  const isCloser = role === "closer";
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role !== "closer") { router.push("/dashboard"); return; }
    loadOrders();
  }, [role, router]);

  const loadOrders = async () => {
    if (!isSupabaseReady || !profile) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["programmée", "injoignable"])
      .eq("claimed_by", profile.id)
      .order("created_at", { ascending: false });

    setOrders((data || []) as OrderRow[]);
    setLoading(false);
  };

  const today = new Date().toDateString();
  const todayOrders = orders.filter((o) => new Date(o.created_at).toDateString() === today);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toDateString();
  const tomorrowOrders = orders.filter(
    (o) =>
      (o.estimated_delivery_time &&
        new Date(o.estimated_delivery_time).toDateString() === tomorrowStr) ||
      new Date(o.created_at).toDateString() === tomorrowStr
  );
  const otherOrders = orders.filter(
    (o) =>
      new Date(o.created_at).toDateString() !== today &&
      !(o.estimated_delivery_time &&
        new Date(o.estimated_delivery_time).toDateString() === tomorrowStr) &&
      new Date(o.created_at).toDateString() !== tomorrowStr
  );

  function Section({ title, icon: Icon, items }: { title: string; icon: any; items: OrderRow[] }) {
    if (items.length === 0) return null;
    return (
      <div>
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-blue-400" />
          {title}
          <span className="text-xs text-gray-500">({items.length})</span>
        </h3>
        <div className="space-y-2">
          {items.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="hover:border-gray-700 transition-all cursor-pointer">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{order.client_name}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {order.phone} — {order.city}
                    </p>
                    {order.estimated_delivery_time && (
                      <p className="text-xs text-blue-400 mt-0.5">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {format(new Date(order.estimated_delivery_time), "dd MMM HH:mm", { locale: fr })}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="À rappeler" />
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-blue-500" />
          <h2 className="text-base lg:text-lg font-medium text-white">Commandes à relancer</h2>
          <span className="rounded-full bg-blue-600/20 px-2.5 py-0.5 text-xs font-medium text-blue-400">
            {orders.length}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-900/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Phone className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-1">Tout est à jour</h3>
            <p className="text-sm text-gray-600">Aucune commande à rappeler pour le moment</p>
          </div>
        ) : (
          <div className="space-y-6">
            <Section title="Aujourd'hui" icon={Calendar} items={todayOrders} />
            <Section title="Demain" icon={Calendar} items={tomorrowOrders} />
            <Section title="Autres" icon={Calendar} items={otherOrders} />
          </div>
        )}
      </div>
    </div>
  );
}
