"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { OrderRow } from "@/types";
import { Header } from "@/components/layout/header";
import { OrderCard } from "@/components/orders/order-card";
import { useClaimOrder } from "@/hooks/use-orders";
import { Inbox } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

export default function InboxPage() {
  const { isAdmin, country: authCountry, profile } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const claimMutation = useClaimOrder();

  const country = isAdmin ? authCountry : profile?.country;

  useEffect(() => {
    if (!isSupabaseReady) return;

    const load = async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("status", "nouvelle")
        .is("claimed_by", null)
        .order("created_at", { ascending: false });

      if (country) query = query.eq("country", country);

      const { data } = await query;
      setOrders(data || []);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("inbox-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [country]);

  return (
    <div>
      <Header title="Boîte de réception" />
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-6">
          <Inbox className="h-5 w-5 text-blue-500 shrink-0" />
          <h2 className="text-base lg:text-lg font-medium text-white">Nouvelles commandes</h2>
          <span className="rounded-full bg-blue-600/20 px-2.5 py-0.5 text-xs font-medium text-blue-400">
            {orders.length}
          </span>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1,2,3].map((i) => <div key={i} className="h-48 bg-gray-900/50 rounded-xl animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Inbox className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-1">Boîte de réception vide</h3>
            <p className="text-sm text-gray-600">Toutes les nouvelles commandes ont été traitées</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClaim={(id) => claimMutation.mutate(id)}
                claiming={claimMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
