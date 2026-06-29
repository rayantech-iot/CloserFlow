"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { OrderRow, ProfileRow } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, Users, Globe, Clock, Phone, Truck } from "lucide-react";

function getDefaultDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

type Tab = "global" | "closers" | "livreurs";

export default function StatsPage() {
  const { isAdmin, role, profile } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("global");
  const [dateFrom, setDateFrom] = useState(getDefaultDates().from);
  const [dateTo, setDateTo] = useState(getDefaultDates().to);
  const [personFilter, setPersonFilter] = useState("");

  const isDeliveryPerson = role === "delivery_person";

  useEffect(() => {
    if (isDeliveryPerson) setTab("livreurs");
  }, [isDeliveryPerson]);

  useEffect(() => {
    if (isAdmin) return;
    if (role === "closer" && tab === "livreurs") setTab("closers");
    if (role === "delivery_person" && tab !== "livreurs") setTab("livreurs");
  }, [role, tab, isAdmin]);

  useEffect(() => {
    if (!isSupabaseReady) return;
    loadData();
  }, [dateFrom, dateTo]);

  const loadData = async () => {
    setLoading(true);
    let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) query = query.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());

    const { data: oData } = await query;
    const { data: pData } = await supabase.from("profiles").select("*").order("display_name");

    setOrders((oData || []) as OrderRow[]);
    setProfiles((pData || []) as ProfileRow[]);
    setLoading(false);
  };

  const closers = profiles.filter((p) => p.role === "closer");
  const livreurs = profiles.filter((p) => p.role === "delivery_person");

  // computed stats
  const totalOrders = orders.length;
  const statusCounts: Record<string, number> = {};
  orders.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const todayCount = orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString()).length;

  const closerStats = closers.map((c) => {
    const o = orders.filter((x) => x.claimed_by === c.id);
    const claimed = o.length;
    const livree = o.filter((x) => x.status === "livrée").length;
    const refusee = o.filter((x) => x.status === "refusée").length;
    const programmee = o.filter((x) => x.status === "programmée").length;
    const injoignable = o.filter((x) => x.status === "injoignable").length;
    const faux_numero = o.filter((x) => x.status === "faux_numéro").length;
    const taux = claimed > 0 ? Math.round((livree / claimed) * 100) : 0;
    return { id: c.id, name: c.display_name, country: c.country, claimed, livree, refusee, programmee, injoignable, faux_numero, taux };
  }).filter((s) => !personFilter || s.id === personFilter);

  const livreurStats = livreurs.map((l) => {
    const o = orders.filter((x) => x.delivery_person_id === l.id);
    const total = o.length;
    const livree = o.filter((x) => x.status === "livrée").length;
    const refusee = o.filter((x) => x.status === "refusée").length;
    const injoignable = o.filter((x) => x.status === "injoignable").length;
    const faux_numero = o.filter((x) => x.status === "faux_numéro").length;
    const taux = total > 0 ? Math.round((livree / total) * 100) : 0;
    return { id: l.id, name: l.display_name, total, livree, refusee, injoignable, faux_numero, taux };
  }).filter((s) => !personFilter || s.id === personFilter);

  // Delivery person's own stats
  const myDeliveries = orders.filter((o) => o.delivery_person_id === profile?.id);
  const myDelivered = myDeliveries.filter((o) => o.status === "livrée").length;

  // Stats globales par statut
  const globalStatusRows = [
    { label: "Nouvelles", key: "nouvelle", color: "text-blue-500" },
    { label: "Confirmées", key: "confirmée", color: "text-emerald-500" },
    { label: "Programmées", key: "programmée", color: "text-amber-500" },
    { label: "Injoignables", key: "injoignable", color: "text-orange-500" },
    { label: "Faux numéros", key: "faux_numéro", color: "text-red-500" },
    { label: "Livrées", key: "livrée", color: "text-green-500" },
    { label: "Refusées", key: "refusée", color: "text-rose-500" },
    { label: "Annulées", key: "annulée", color: "text-gray-500" },
  ];

  const exportCSV = () => {
    const rows = tab === "closers" ? closerStats : livreurStats;
    const headers = tab === "closers"
      ? ["Closer", "Pays", "Assignées", "Livrées", "Refusées", "Programmées", "Injoignables", "Faux N°", "Taux %"]
      : ["Livreur", "Livraisons", "Livrées", "Refusées", "Injoignables", "Faux N°", "Taux %"];
    const csv = [
      headers.join(","),
      ...rows.map((r: any) => tab === "closers"
        ? [r.name, r.country, r.claimed, r.livree, r.refusee, r.programmee, r.injoignable, r.faux_numero, r.taux].join(",")
        : [r.name, r.total, r.livree, r.refusee, r.injoignable, r.faux_numero, r.taux].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `statistiques-${tab}.csv`;
    a.click();
  };

  return (
    <div>
      <Header title="Statistiques" />
      <div className="p-4 lg:p-6 space-y-6">

        {/* Tabs */}
        {isAdmin && (
          <div className="flex gap-2 border-b border-gray-800 pb-0">
            {(["global", "closers", "livreurs"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setPersonFilter(""); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {t === "global" ? "Globale" : t === "closers" ? "Par closer" : "Par livreur"}
              </button>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Du</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-36" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Au</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-36" />
          </div>
          <Button variant="outline" size="sm"
            onClick={() => { const d = getDefaultDates(); setDateFrom(d.from); setDateTo(d.to); }}>
            Ce mois
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(new Date().toISOString().slice(0, 10)); }}>
            7 jours
          </Button>

          {tab !== "global" && (tab === "closers" ? closers : livreurs).length > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <label className="text-xs text-gray-500 shrink-0">Personne :</label>
              <Select value={personFilter} onValueChange={setPersonFilter}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {(tab === "closers" ? closers : livreurs).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Exporter CSV
          </Button>
        </div>

        {/* Vue GLOBALE */}
        {tab === "global" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Total commandes</p>
                      <p className="text-xl font-bold text-white">{totalOrders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                      <Clock className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Aujourd'hui</p>
                      <p className="text-xl font-bold text-white">{todayCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Users className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Closers actifs</p>
                      <p className="text-xl font-bold text-white">{closerStats.filter((s) => s.claimed > 0).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                      <Globe className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Taux livraison global</p>
                      <p className="text-xl font-bold text-emerald-400">
                        {totalOrders > 0 ? Math.round(((statusCounts["livrée"] || 0) / totalOrders) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Répartition par statut</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {globalStatusRows.map((s) => (
                    <div key={s.key} className="rounded-lg bg-gray-800/30 p-3">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className={`text-lg font-bold mt-1 ${s.color}`}>{statusCounts[s.key] || 0}</p>
                    </div>
                  ))}
                  <div className="rounded-lg bg-gray-800/30 p-3">
                    <p className="text-xs text-gray-500">Assignées à un closer</p>
                    <p className="text-lg font-bold text-white mt-1">{orders.filter((o) => o.claimed_by).length}</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/30 p-3">
                    <p className="text-xs text-gray-500">En attente d'assignation</p>
                    <p className="text-lg font-bold text-amber-400 mt-1">{orders.filter((o) => !o.claimed_by).length}</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/30 p-3">
                    <p className="text-xs text-gray-500">Prêtes pour livraison</p>
                    <p className="text-lg font-bold text-blue-400 mt-1">{orders.filter((o) => o.ready_for_delivery && !o.delivery_person_id).length}</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/30 p-3">
                    <p className="text-xs text-gray-500">En cours de livraison</p>
                    <p className="text-lg font-bold text-indigo-400 mt-1">{orders.filter((o) => o.delivery_person_id && o.status !== "livrée" && o.status !== "refusée" && o.status !== "annulée").length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Vue CLOSERS */}
        {tab === "closers" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-xs text-gray-400">Commandes assignées</p>
                      <p className="text-xl font-bold text-white">{closerStats.reduce((a, s) => a + s.claimed, 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-xs text-gray-400">Livrées</p>
                      <p className="text-xl font-bold text-emerald-400">{closerStats.reduce((a, s) => a + s.livree, 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-xs text-gray-400">Closers actifs</p>
                      <p className="text-xl font-bold text-white">{closerStats.filter((s) => s.claimed > 0).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-indigo-500" />
                    <div>
                      <p className="text-xs text-gray-400">Taux de closing</p>
                      <p className="text-xl font-bold text-emerald-400">
                        {closerStats.length > 0
                          ? Math.round(closerStats.reduce((a, s) => a + s.taux, 0) / closerStats.filter((s) => s.claimed > 0).length)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left p-4 text-gray-400 font-medium">Closer</th>
                      <th className="text-center p-4 text-gray-400 font-medium">Assignées</th>
                      <th className="text-center p-4 text-emerald-400 font-medium">Livrées</th>
                      <th className="text-center p-4 text-rose-400 font-medium">Refusées</th>
                      <th className="text-center p-4 text-amber-400 font-medium">Prog.</th>
                      <th className="text-center p-4 text-orange-400 font-medium">Injoign.</th>
                      <th className="text-center p-4 text-red-400 font-medium">Faux N°</th>
                      <th className="text-center p-4 text-gray-400 font-medium">Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="p-8 text-center text-gray-500">Chargement...</td></tr>
                    ) : closerStats.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-gray-500">Aucune donnée</td></tr>
                    ) : (
                      closerStats.map((s) => (
                        <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                          <td className="p-4 text-white font-medium">{s.name}</td>
                          <td className="p-4 text-center text-white">{s.claimed}</td>
                          <td className="p-4 text-center text-emerald-400">{s.livree}</td>
                          <td className="p-4 text-center text-rose-400">{s.refusee}</td>
                          <td className="p-4 text-center text-amber-400">{s.programmee}</td>
                          <td className="p-4 text-center text-orange-400">{s.injoignable}</td>
                          <td className="p-4 text-center text-red-400">{s.faux_numero}</td>
                          <td className="p-4 text-center text-white font-medium">{s.taux}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Vue LIVREURS */}
        {tab === "livreurs" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-xs text-gray-400">
                        {isDeliveryPerson ? "Mes livraisons" : "Livraisons totales"}
                      </p>
                      <p className="text-xl font-bold text-white">
                        {isDeliveryPerson ? myDeliveries.length : livreurStats.reduce((a, s) => a + s.total, 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-xs text-gray-400">Livrées</p>
                      <p className="text-xl font-bold text-emerald-400">
                        {isDeliveryPerson ? myDelivered : livreurStats.reduce((a, s) => a + s.livree, 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-xs text-gray-400">Taux de livraison</p>
                      <p className="text-xl font-bold text-emerald-400">
                        {isDeliveryPerson
                          ? (myDeliveries.length > 0 ? Math.round((myDelivered / myDeliveries.length) * 100) : 0)
                          : (livreurStats.reduce((a, s) => a + s.total, 0) > 0
                            ? Math.round((livreurStats.reduce((a, s) => a + s.livree, 0) / livreurStats.reduce((a, s) => a + s.total, 0)) * 100)
                            : 0)
                        }%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-indigo-500" />
                    <div>
                      <p className="text-xs text-gray-400">Livreurs actifs</p>
                      <p className="text-xl font-bold text-white">
                        {livreurStats.filter((s) => s.total > 0).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {!isDeliveryPerson && (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left p-4 text-gray-400 font-medium">Livreur</th>
                        <th className="text-center p-4 text-gray-400 font-medium">Livraisons</th>
                        <th className="text-center p-4 text-emerald-400 font-medium">Livrées</th>
                        <th className="text-center p-4 text-rose-400 font-medium">Refusées</th>
                        <th className="text-center p-4 text-orange-400 font-medium">Injoign.</th>
                        <th className="text-center p-4 text-red-400 font-medium">Faux N°</th>
                        <th className="text-center p-4 text-gray-400 font-medium">Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={7} className="p-8 text-center text-gray-500">Chargement...</td></tr>
                      ) : livreurStats.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-gray-500">Aucune donnée</td></tr>
                      ) : (
                        livreurStats.map((s) => (
                          <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                            <td className="p-4 text-white font-medium">{s.name}</td>
                            <td className="p-4 text-center text-white">{s.total}</td>
                            <td className="p-4 text-center text-emerald-400">{s.livree}</td>
                            <td className="p-4 text-center text-rose-400">{s.refusee}</td>
                            <td className="p-4 text-center text-orange-400">{s.injoignable}</td>
                            <td className="p-4 text-center text-red-400">{s.faux_numero}</td>
                            <td className="p-4 text-center text-white font-medium">{s.taux}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {isDeliveryPerson && (
              <Card>
                <CardHeader><CardTitle className="text-base">Mes livraisons récentes</CardTitle></CardHeader>
                <CardContent>
                  {myDeliveries.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Aucune livraison sur cette période</p>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {myDeliveries.slice(0, 20).map((o) => (
                        <div key={o.id} className="py-2 flex items-center justify-between text-sm">
                          <span className="text-white">{o.client_name} — {o.city}</span>
                          <span className={o.status === "livrée" ? "text-emerald-400" : "text-gray-500"}>
                            {o.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
