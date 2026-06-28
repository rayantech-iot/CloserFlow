"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { OrderRow, OrderStatus } from "@/types";
import { ORDER_STATUSES, STATUS_LABELS } from "@/types";
import { Header } from "@/components/layout/header";
import { OrderCard } from "@/components/orders/order-card";
import { useClaimOrder } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/providers/auth-provider";
import { Calendar } from "lucide-react";

function getDefaultDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAdmin, country: authCountry, profile } = useAuth();
  const statusFilter = searchParams.get("status") as OrderStatus | null;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const claimMutation = useClaimOrder();

  const country = isAdmin ? authCountry : profile?.country;

  const loadOrders = useCallback(() => {
    if (!isSupabaseReady) return;
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter) query = query.eq("status", statusFilter);
    if (country) query = query.eq("country", country);
    if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) query = query.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());

    query.then(({ data }) => {
      setOrders(data || []);
      setLoading(false);
    });
  }, [statusFilter, country, dateFrom, dateTo]);

  useEffect(() => {
    loadOrders();
    const channel = supabase
      .channel("orders-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadOrders]);

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
      <div className="p-4 lg:p-6 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap">
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
          {!dateFrom && !dateTo && (
            <Button variant="outline" size="sm"
              onClick={() => { const d = getDefaultDates(); setDateFrom(d.from); setDateTo(d.to); setLoading(true); }}>
              Ce mois
            </Button>
          )}
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
