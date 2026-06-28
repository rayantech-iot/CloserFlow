"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { OrderRow, ProfileRow } from "@/types";
import { ORDER_STATUSES, STATUS_LABELS, FINAL_STATUSES } from "@/types";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { useAuth } from "@/providers/auth-provider";
import { useClaimDelivery, useUpdateDeliveryStatus } from "@/hooks/use-orders";
import { useRouter } from "next/navigation";
import { formatCurrency, formatPhone, getTimeAgo } from "@/lib/utils";
import { Truck, Package, MapPin, Phone, Clock, ShoppingBag, Calendar } from "lucide-react";

export default function DeliveriesPage() {
  const { isAdmin, role, profile } = useAuth();
  const router = useRouter();
  const [readyOrders, setReadyOrders] = useState<OrderRow[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const claimMutation = useClaimDelivery();
  const statusMutation = useUpdateDeliveryStatus();

  useEffect(() => {
    if (!isAdmin && role !== "delivery_person") {
      router.push("/dashboard");
      return;
    }
  }, [isAdmin, role, router]);

  useEffect(() => {
    if (!isSupabaseReady) return;
    const load = async () => {
      let readyQuery = supabase
        .from("orders").select("*")
        .eq("ready_for_delivery", true)
        .is("delivery_person_id", null);
      if (dateFrom) readyQuery = readyQuery.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) readyQuery = readyQuery.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
      readyQuery = readyQuery.order("estimated_delivery_time", { ascending: true });

      let mineQuery = supabase
        .from("orders").select("*")
        .eq("delivery_person_id", profile?.id || "")
        .not("status", "in", `("${FINAL_STATUSES.join('","')}")`);
      if (dateFrom) mineQuery = mineQuery.gte("claimed_by_delivery_at", new Date(dateFrom).toISOString());
      if (dateTo) mineQuery = mineQuery.lte("claimed_by_delivery_at", new Date(dateTo + "T23:59:59").toISOString());
      mineQuery = mineQuery.order("claimed_by_delivery_at", { ascending: false });

      const [readyRes, mineRes] = await Promise.all([readyQuery, mineQuery]);
      setReadyOrders((readyRes.data || []) as OrderRow[]);
      setMyDeliveries((mineRes.data || []) as OrderRow[]);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel("deliveries-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, dateFrom, dateTo]);

  return (
    <div>
      <Header title="Livraisons" />
      <div className="p-4 lg:p-6 space-y-4">
        {/* Filtres date */}
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setLoading(true); }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-40" />
          <span className="text-gray-500">—</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setLoading(true); }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-40" />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setLoading(true); }}>
              Réinitialiser
            </Button>
          )}
        </div>

        <div className="space-y-8">
        {/* Commandes prêtes à livrer */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-5 w-5 text-amber-500" />
            <h2 className="text-base lg:text-lg font-medium text-white">Commandes prêtes ({readyOrders.length})</h2>
          </div>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-gray-900/50 rounded-xl animate-pulse" />)}
            </div>
          ) : readyOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Truck className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Aucune commande prête pour le moment</p>
                <p className="text-sm text-gray-600 mt-1">Revenez plus tard ou attendez qu'un closer prépare des commandes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {readyOrders.map((order) => (
                <DeliveryCard
                  key={order.id}
                  order={order}
                  type="ready"
                  onClaim={() => claimMutation.mutate(order.id)}
                  claiming={claimMutation.isPending}
                  onStatusChange={(status) => statusMutation.mutate({ orderId: order.id, newStatus: status })}
                />
              ))}
            </div>
          )}
        </section>

        {/* Mes livraisons en cours */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-blue-500" />
            <h2 className="text-base lg:text-lg font-medium text-white">Mes livraisons ({myDeliveries.length})</h2>
          </div>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2].map((i) => <div key={i} className="h-40 bg-gray-900/50 rounded-xl animate-pulse" />)}
            </div>
          ) : myDeliveries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Aucune livraison en cours</p>
                <p className="text-sm text-gray-600 mt-1">Prenez en charge une commande prête ci-dessus</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {myDeliveries.map((order) => (
                <DeliveryCard
                  key={order.id}
                  order={order}
                  type="mine"
                  onStatusChange={(status) => statusMutation.mutate({ orderId: order.id, newStatus: status })}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  </div>
  );
}

interface DeliveryCardProps {
  order: OrderRow;
  type: "ready" | "mine";
  onClaim?: () => void;
  claiming?: boolean;
  onStatusChange?: (status: any) => void;
}

function DeliveryCard({ order, type, onClaim, claiming, onStatusChange }: DeliveryCardProps) {
  const deliveryActions = ORDER_STATUSES.filter(
    (s) => s !== order.status && ["livrée", "refusée", "injoignable", "faux_numéro"].includes(s)
  );

  return (
    <Card className="hover:border-gray-700 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="h-4 w-4 text-gray-500 shrink-0" />
              <h3 className="font-medium text-white truncate">{order.client_name}</h3>
              {order.country && (
                <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded shrink-0">{order.country}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Phone className="h-3.5 w-3.5" />
              <span>{formatPhone(order.phone)}</span>
            </div>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="space-y-1 text-sm mb-3">
          <div className="flex items-center gap-1.5 text-gray-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{order.address}, {order.city}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
            <span>{order.product} x{order.quantity} — {formatCurrency(order.price * order.quantity)}</span>
          </div>
          {order.estimated_delivery_time && (
            <div className="flex items-center gap-1.5 text-amber-400">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Prévue le {new Date(order.estimated_delivery_time).toLocaleString("fr-FR")}</span>
            </div>
          )}
          {type === "ready" && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Importée {getTimeAgo(order.created_at)}</span>
            </div>
          )}
          {type === "mine" && order.claimed_by_delivery_at && (
            <div className="flex items-center gap-1.5 text-blue-400">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Pris en charge {getTimeAgo(order.claimed_by_delivery_at)}</span>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-gray-800">
          {type === "ready" && onClaim && (
            <Button onClick={onClaim} disabled={claiming} className="w-full">
              Prendre en charge la livraison
            </Button>
          )}
          {type === "mine" && onStatusChange && deliveryActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {deliveryActions.map((status) => (
                <Button
                  key={status}
                  variant={status === "livrée" ? "success" : "outline"}
                  size="sm"
                  onClick={() => onStatusChange(status)}
                >
                  {STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
