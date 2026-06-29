"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { TeamRow } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Globe, Trash2, Users, UserCheck } from "lucide-react";

const COUNTRIES = [
  "Afrique du Sud", "Algérie", "Angola", "Bénin", "Botswana", "Burkina Faso",
  "Burundi", "Cameroun", "Cap-Vert", "Comores", "Congo", "Côte d'Ivoire",
  "Djibouti", "Égypte", "Érythrée", "Eswatini", "Éthiopie", "Gabon",
  "Gambie", "Ghana", "Guinée", "Guinée-Bissau", "Guinée équatoriale",
  "Kenya", "Lesotho", "Liberia", "Libye", "Madagascar", "Malawi", "Mali",
  "Maroc", "Maurice", "Mauritanie", "Mozambique", "Namibie", "Niger",
  "Nigeria", "Ouganda", "RCA", "RDC", "Rwanda", "Sao Tomé-et-Principe",
  "Sénégal", "Seychelles", "Sierra Leone", "Somalie", "Soudan",
  "Soudan du Sud", "Tanzanie", "Tchad", "Togo", "Tunisie", "Zambie",
  "Zimbabwe", "France", "Autre",
];

export default function TeamsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", country: "" });

  useEffect(() => {
    if (!isAdmin) { router.push("/dashboard"); return; }
    fetchData();
  }, [isAdmin, router]);

  const fetchData = async () => {
    if (!isSupabaseReady) return;
    const { data: tData } = await supabase.from("teams").select("*").order("created_at");
    setTeams(tData || []);
    const { data: pData } = await supabase.from("profiles").select("id,display_name,role,team_id,country,active").order("display_name");
    setMembers(pData || []);
    setLoading(false);
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const { error } = await supabase.from("teams").insert(form);
    if (error) { setError(error.message); return; }
    setForm({ name: "", country: "" });
    setDialogOpen(false);
    fetchData();
  };

  const deleteTeam = async (teamId: string) => {
    await supabase.from("teams").delete().eq("id", teamId);
    fetchData();
  };

  const removeFromTeam = async (userId: string) => {
    await supabase.from("profiles").update({ team_id: null }).eq("id", userId);
    fetchData();
  };

  const teamMembers = (teamId: string) =>
    members.filter((m) => m.team_id === teamId && m.active !== false);

  const unassigned = members.filter((m) => !m.team_id && m.active !== false && m.role !== "admin");

  return (
    <div>
      <Header title="Gestion des équipes" />
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base lg:text-lg font-medium text-white">{teams.length} équipe{teams.length !== 1 ? "s" : ""}</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Équipe</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvelle équipe</DialogTitle></DialogHeader>
              <form onSubmit={createTeam} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Nom</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ex: Équipe CI" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Pays</label>
                  <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{error}</div>}
                <Button type="submit" className="w-full">Créer</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 bg-gray-900/50 rounded-xl animate-pulse" />)}</div>
        ) : teams.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-1">Aucune équipe</h3>
            <p className="text-sm text-gray-600">Créez votre première équipe pour organiser vos closers et livreurs</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => {
              const tm = teamMembers(team.id);
              return (
                <Card key={team.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-blue-400" />
                        <span className="font-medium text-white">{team.name}</span>
                        {team.country && <Badge variant="default" className="text-xs">{team.country}</Badge>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteTeam(team.id)}>
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {tm.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">Aucun membre</p>
                      ) : (
                        tm.map((m) => (
                          <div key={m.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-800/30">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserCheck className="h-3 w-3 text-green-400 shrink-0" />
                              <span className="text-sm text-gray-200 truncate">{m.display_name}</span>
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                {m.role === "delivery_person" ? "Livreur" : "Closer"}
                              </Badge>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 w-6" onClick={() => removeFromTeam(m.id)}>
                              <Trash2 className="h-3 w-3 text-gray-500" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                    {unassigned.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-800">
                        <p className="text-xs text-gray-500 mb-1">Ajouter un membre :</p>
                        <select
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200"
                          onChange={async (e) => {
                            if (!e.target.value) return;
                            await supabase.from("profiles").update({ team_id: team.id }).eq("id", e.target.value);
                            fetchData();
                          }}
                          value=""
                        >
                          <option value="">Choisir...</option>
                          {unassigned.map((m) => (
                            <option key={m.id} value={m.id}>{m.display_name} ({m.role === "delivery_person" ? "Livreur" : "Closer"})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
