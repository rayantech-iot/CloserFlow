"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { CloserStatsEntry } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Users, Globe, Clock } from "lucide-react";

function getDefaultDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export default function StatsPage() {
  const { isAdmin, isSuperAdmin, country, organizationId } = useAuth();
  const router = useRouter();
  const [closerStats, setCloserStats] = useState<CloserStatsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(getDefaultDates().from);
  const [dateTo, setDateTo] = useState(getDefaultDates().to);

  useEffect(() => {
    if (!isAdmin) { router.push("/dashboard"); return; }
    if (!isSupabaseReady) return;

    const fetchStats = async () => {
      const params: any = {};
      if (country) params.target_country = country;
      if (dateFrom) params.date_from = new Date(dateFrom).toISOString();
      if (dateTo) params.date_to = new Date(dateTo + "T23:59:59").toISOString();

      const { data } = await supabase.rpc("get_closer_stats", params);
      let results = (data || []) as CloserStatsEntry[];

      // Filtrer par organisation (sauf super admin)
      if (!isSuperAdmin && organizationId) {
        const { data: orgProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("organization_id", organizationId);
        const orgUserIds = new Set(orgProfiles?.map((p: any) => p.id) || []);
        results = results.filter((s) => orgUserIds.has(s.user_id));
      }

      setCloserStats(results);
      setLoading(false);
    };
    fetchStats();
  }, [isAdmin, router, isSuperAdmin, organizationId, country, dateFrom, dateTo]);

  const exportCSV = () => {
    const headers = ["Closer", "Pays", "Total", "Livrées", "Refusées", "Programmées", "Injoignables", "Taux liv.", "Temps moyen (h)"];
    const rows = closerStats.map((s) => [
      s.display_name, s.country, s.total_claimed, s.livree, s.refusee,
      s.programmee, s.injoignable, `${s.taux_livraison}%`, s.avg_closing_time_hours,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "statistiques-closers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = closerStats.reduce(
    (acc, s) => ({
      total: acc.total + s.total_claimed,
      livree: acc.livree + s.livree,
      refusee: acc.refusee + s.refusee,
    }),
    { total: 0, livree: 0, refusee: 0 }
  );

  return (
    <div>
      <Header title="Statistiques" />
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base lg:text-lg font-medium text-white">
            {country ? `Équipe ${country}` : "Tous les pays"}
          </h2>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total commandes</p>
                  <p className="text-xl font-bold text-white">{totals.total}</p>
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
                  <p className="text-xl font-bold text-white">{closerStats.filter((s) => s.total_claimed > 0).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <Globe className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Taux livraison</p>
                  <p className="text-xl font-bold text-emerald-400">
                    {totals.total > 0 ? Math.round((totals.livree / totals.total) * 100) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Temps moyen</p>
                  <p className="text-xl font-bold text-white">
                    {closerStats.length > 0
                      ? Math.round(closerStats.reduce((a, s) => a + s.avg_closing_time_hours, 0) / closerStats.length)
                      : 0}h
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Du</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Au</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white" />
          </div>
          <Button variant="outline" size="sm"
            onClick={() => { const d = getDefaultDates(); setDateFrom(d.from); setDateTo(d.to); }}>
            Ce mois
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 7);
              setDateFrom(d.toISOString().slice(0, 10));
              setDateTo(new Date().toISOString().slice(0, 10));
            }}>
            7 jours
          </Button>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 text-gray-400 font-medium">Closer</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Pays</th>
                  <th className="text-center p-4 text-gray-400 font-medium">Total</th>
                  <th className="text-center p-4 text-emerald-400 font-medium">Livrées</th>
                  <th className="text-center p-4 text-rose-400 font-medium">Refusées</th>
                  <th className="text-center p-4 text-amber-400 font-medium">Prog.</th>
                  <th className="text-center p-4 text-orange-400 font-medium">Injoign.</th>
                  <th className="text-center p-4 text-gray-400 font-medium">Taux liv.</th>
                  <th className="text-center p-4 text-gray-400 font-medium">Temps moy.</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="p-8 text-center text-gray-500">Chargement...</td></tr>
                ) : closerStats.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-gray-500">Aucune donnée</td></tr>
                ) : (
                  closerStats.map((s) => (
                    <tr key={s.user_id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                      <td className="p-4 text-white font-medium">{s.display_name}</td>
                      <td className="p-4"><span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-300">{s.country || "-"}</span></td>
                      <td className="p-4 text-center text-white">{s.total_claimed}</td>
                      <td className="p-4 text-center text-emerald-400">{s.livree}</td>
                      <td className="p-4 text-center text-rose-400">{s.refusee}</td>
                      <td className="p-4 text-center text-amber-400">{s.programmee}</td>
                      <td className="p-4 text-center text-orange-400">{s.injoignable}</td>
                      <td className="p-4 text-center text-white">{s.taux_livraison}%</td>
                      <td className="p-4 text-center text-gray-400">{s.avg_closing_time_hours > 0 ? `${s.avg_closing_time_hours}h` : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
