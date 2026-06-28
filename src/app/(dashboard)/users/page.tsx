"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { ProfileRow, UserRole, TeamRow } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserCheck, UserX, Shield, Mail, Globe, Trash2, Users } from "lucide-react";

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

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", country: "" });

  useEffect(() => {
    if (!isAdmin) { router.push("/dashboard"); return; }
    fetchData();
  }, [isAdmin, router]);

  const fetchData = async () => {
    if (!isSupabaseReady) return;
    const { data: pData } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setProfiles(pData || []);
    const { data: tData } = await supabase.from("teams").select("*").order("created_at");
    setTeams(tData || []);
    setLoading(false);
  };

  const [form, setForm] = useState({ email: "", password: "", displayName: "", phone: "", country: "", teamId: "" });
  const [role, setRole] = useState<UserRole>("closer");
  const [submitting, setSubmitting] = useState(false);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, role }),
    });

    const data = await res.json();
    setSubmitting(false);

      if (!res.ok) {
      setError(data.error);
      return;
    }

    setForm({ email: "", password: "", displayName: "", phone: "", country: "", teamId: "" });
    setDialogOpen(false);
    fetchData();
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const { error } = await supabase.from("teams").insert(teamForm);
    if (error) { setError(error.message); return; }
    setTeamForm({ name: "", country: "" });
    setTeamDialogOpen(false);
    fetchData();
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Supprimer cette équipe ?")) return;
    await supabase.from("teams").delete().eq("id", teamId);
    fetchData();
  };

  const toggleActive = async (profile: ProfileRow) => {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id, active: !profile.active }),
    });
    fetchData();
  };

  const changeRole = async (profile: ProfileRow) => {
    const roles: UserRole[] = ["admin", "closer", "delivery_person"];
    const idx = roles.indexOf(profile.role);
    const newRole = roles[(idx + 1) % roles.length];
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id, role: newRole }),
    });
    fetchData();
  };

  const changeCountry = async (profile: ProfileRow, newCountry: string) => {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id, country: newCountry }),
    });
    fetchData();
  };

  return (
    <div>
      <Header title="Gestion des utilisateurs" />
      <div className="p-4 lg:p-6 space-y-6">

        {/* Équipes */}
        {isAdmin && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Globe className="h-4 w-4" /> Équipes ({teams.length})
              </h3>
              <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-3 w-3" /> Équipe</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nouvelle équipe</DialogTitle></DialogHeader>
                  <form onSubmit={createTeam} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Nom</label>
                      <Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} required placeholder="Ex: Équipe CI" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Pays</label>
                      <Select value={teamForm.country} onValueChange={(v) => setTeamForm({ ...teamForm, country: v })}>
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
            <div className="grid gap-2 mb-4">
              {teams.map((team) => (
                <Card key={team.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-blue-400" />
                      <span className="text-sm text-white">{team.name}</span>
                      {team.country && <Badge variant="default" className="text-xs">{team.country}</Badge>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteTeam(team.id)}>
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {teams.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Aucune équipe. Créez votre première équipe !</p>
              )}
            </div>
          </section>
        )}

        {/* Membres */}
        <div className="flex items-center justify-between">
          <h2 className="text-base lg:text-lg font-medium text-white">
            {profiles.length} membre{profiles.length !== 1 ? "s" : ""}
          </h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Ajouter</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvel utilisateur</DialogTitle></DialogHeader>
              <form onSubmit={createUser} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Nom</label>
                  <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Email</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Mot de passe</label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Téléphone</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Pays / Équipe</label>
                  <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un pays" /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {teams.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Équipe</label>
                  <Select value={form.teamId} onValueChange={(v) => {
                    const team = teams.find(t => t.id === v);
                    setForm({ ...form, teamId: v, country: team?.country || form.country });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Aucune équipe" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucune équipe</SelectItem>
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.country ? ` (${t.country})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Rôle</label>
                  <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="closer">Closer</SelectItem>
                      <SelectItem value="delivery_person">Livreur</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{error}</div>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Création..." : "Créer l'utilisateur"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {profiles.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/10 shrink-0">
                      <Mail className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white truncate">{p.display_name}</span>
                        <Badge variant={p.role === "super_admin" ? "blue" : p.role === "admin" ? "blue" : p.role === "delivery_person" ? "default" : "default"} className="shrink-0">
                          {p.role === "super_admin" ? "Super Admin" : p.role === "admin" ? "Admin" : p.role === "delivery_person" ? "Livreur" : "Closer"}
                        </Badge>
                        {!p.active && <Badge variant="red" className="shrink-0">Inactif</Badge>}
                        {p.country && (
                          <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded shrink-0">{p.country}</span>
                        )}
                        {p.team_id && teams.find(t => t.id === p.team_id) && (
                          <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded shrink-0">
                            <Globe className="h-3 w-3 inline mr-1 -mt-0.5" />
                            {teams.find(t => t.id === p.team_id)!.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 truncate">{p.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.role !== "super_admin" && (
                      <Select value={p.country} onValueChange={(v) => changeCountry(p, v)}>
                        <SelectTrigger className="h-8 w-8 border-0 bg-transparent">
                          <Globe className="h-4 w-4 text-gray-400" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => changeRole(p)}>
                      <Shield className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(p)}>
                      {p.active ? <UserX className="h-4 w-4 text-red-400" /> : <UserCheck className="h-4 w-4 text-green-400" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
