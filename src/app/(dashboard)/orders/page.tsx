"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { OrderRow, OrderStatus } from "@/types";
import { ORDER_STATUSES, STATUS_LABELS } from "@/types";
import { Header } from "@/components/layout/header";
import { OrderCard } from "@/components/orders/order-card";
import { useClaimOrder } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/providers/auth-provider";

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAdmin, country: authCountry, profile } = useAuth();
  const statusFilter = searchParams.get("status") as OrderStatus | null;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const claimMutation = useClaimOrder();

  const country = isAdmin ? authCountry : profile?.country;

  useEffect(() => {
    if (!isSupabaseReady) return;

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter) query = query.eq("status", statusFilter);
    if (country) query = query.eq("country", country);

    query.then(({ data }) => {
      setOrders(data || []);
      setLoading(false);
    });

    const channel = supabase
      .channel("orders-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
        if (statusFilter) q = q.eq("status", statusFilter);
        if (country) q = q.eq("country", country);
        q.then(({ data }) => setOrders(data || []));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [statusFilter, country]);

  const filtered = debouncedSearch
    ? orders.filter((o) => {
        const q = debouncedSearch.toLowerCase();
        return (
          o.client_name.toLowerCase().includes(q) ||
          o.phone.includes(q) ||
          o.city.toLowerCase().includes(q) ||
          o.product.toLowerCase().includes(q) ||
          o.address?.toLowerCase().includes(q) ||
          o.comments?.toLowerCase().includes(q)
        );
      })
    : orders;

  return (
    <div>
      <Header title="Commandes" showSearch searchQuery={search} onSearchChange={setSearch} />
      <div className="p-4 lg:p-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 flex-nowrap">
          <Button variant={!statusFilter ? "default" : "outline"} size="sm" onClick={() => router.push("/orders")}
            className="shrink-0">
            Toutes
          </Button>
          {ORDER_STATUSES.map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm"
              onClick={() => router.push(`/orders?status=${s}`)}
              className="shrink-0">
              {STATUS_LABELS[s]}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="h-48 bg-gray-900/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucune commande trouvée</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((order) => (
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
