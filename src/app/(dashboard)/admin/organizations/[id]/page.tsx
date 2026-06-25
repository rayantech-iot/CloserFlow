"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Globe, Building2, Users, Shield, UserCheck, UserX } from "lucide-react";
import type { OrganizationRow, TeamRow, ProfileRow, UserRole } from "@/types";

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

export default function OrganizationDetailPage() {
  const { isSuperAdmin, isAdmin, role, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = useState<OrganizationRow | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", country: "" });

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({ userId: "", role: "closer" as UserRole, teamId: "", country: "", email: "", password: "", displayName: "", phone: "" });

  useEffect(() => {
    if (!authLoading && !isSuperAdmin && role !== "admin") {
      router.push("/dashboard");
      return;
    }
    if (!authLoading) fetchAll();
  }, [authLoading, isSuperAdmin, role, router]);

  const fetchAll = async () => {
    const [orgRes, teamsRes, membersRes, allRes] = await Promise.all([
      fetch(`/api/organizations/${orgId}`),
      fetch(`/api/organizations/${orgId}/teams`),
      fetch(`/api/organizations/${orgId}/members`),
      fetch("/api/organizations"),
    ]);
    setOrg(await orgRes.json());
    setTeams(await teamsRes.json());
    setMembers(await membersRes.json());
    if (isSuperAdmin) setAllProfiles(await allRes.json());
    setLoading(false);
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/organizations/${orgId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teamForm),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setTeamForm({ name: "", country: "" });
    setTeamDialogOpen(false);
    fetchAll();
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Supprimer cette équipe ?")) return;
    await fetch(`/api/organizations/${orgId}/teams/${teamId}`, { method: "DELETE" });
    fetchAll();
  };

  const addMember = async () => {
    const res = await fetch(`/api/organizations/${orgId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: memberForm.userId,
        role: memberForm.role,
        teamId: memberForm.teamId || null,
        country: memberForm.country,
      }),
    });
    if (res.ok) { setMemberDialogOpen(false); fetchAll(); }
  };

  const createAndAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: memberForm.email,
        password: memberForm.password,
        displayName: memberForm.displayName,
        phone: memberForm.phone,
        role: memberForm.role,
        country: memberForm.country,
        organizationId: orgId,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setMemberForm({ userId: "", role: "closer", teamId: "", country: "", email: "", password: "", displayName: "", phone: "" });
    setMemberDialogOpen(false);
    fetchAll();
  };

  const updateMember = async (profile: ProfileRow, updates: Record<string, any>) => {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id, ...updates }),
    });
    fetchAll();
  };

  const nonMembers = allProfiles.filter(p => !p.organization_id || p.organization_id !== orgId);

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div>
      <Header title={org?.name || "Organisation"} back="/admin/organizations" />
      <div className="p-4 lg:p-6 space-y-8">
        {/* Équipes */}
        <section>
          <div className="flex items-center justify-between mb-4">
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
                    <Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Pays</label>
                    <Select value={teamForm.country} onValueChange={(v) => setTeamForm({ ...teamForm, country: v })}>
                      <SelectTrigger><SelectValue placeholder="Pays" /></SelectTrigger>
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
          <div className="grid gap-2">
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
          </div>
        </section>

        {/* Membres */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Users className="h-4 w-4" /> Membres ({members.length})
            </h3>
            <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3 w-3" /> Membre</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Ajouter un membre</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  {isSuperAdmin && nonMembers.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Utilisateur existant</label>
                      <Select value={memberForm.userId} onValueChange={(v) => setMemberForm({ ...memberForm, userId: v })}>
                        <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                        <SelectContent>
                          {nonMembers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.display_name} ({p.email})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={addMember} disabled={!memberForm.userId}>Ajouter</Button>
                    </div>
                  )}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-800" /></div>
                    <div className="relative flex justify-center text-xs"><span className="bg-gray-950 px-2 text-gray-500">ou créer un nouveau</span></div>
                  </div>
                  <form onSubmit={createAndAddMember} className="space-y-3">
                    <Input placeholder="Nom" value={memberForm.displayName} onChange={(e) => setMemberForm({ ...memberForm, displayName: e.target.value })} required />
                    <Input type="email" placeholder="Email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} required />
                    <Input type="password" placeholder="Mot de passe" value={memberForm.password} onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })} required />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={memberForm.role} onValueChange={(v) => setMemberForm({ ...memberForm, role: v as UserRole })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="closer">Closer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={memberForm.country} onValueChange={(v) => setMemberForm({ ...memberForm, country: v })}>
                        <SelectTrigger><SelectValue placeholder="Pays" /></SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {teams.length > 0 && (
                      <Select value={memberForm.teamId} onValueChange={(v) => setMemberForm({ ...memberForm, teamId: v })}>
                        <SelectTrigger><SelectValue placeholder="Équipe (optionnel)" /></SelectTrigger>
                        <SelectContent>
                          {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{error}</div>}
                    <Button type="submit" className="w-full">Créer & ajouter</Button>
                  </form>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-2">
            {members.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/10 shrink-0">
                        <Users className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{m.display_name}</span>
                          <Badge variant={m.role === "admin" ? "blue" : "default"} className="shrink-0 text-[10px] px-1.5 py-0">
                            {m.role === "admin" ? "Admin" : "Closer"}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {m.country && <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{m.country}</span>}
                      <Select value={m.role} onValueChange={(v) => updateMember(m, { role: v })}>
                        <SelectTrigger className="h-7 w-7 border-0 bg-transparent">
                          <Shield className="h-3 w-3 text-gray-400" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="closer">Closer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => updateMember(m, { active: !m.active })}>
                        {m.active ? <UserX className="h-3 w-3 text-red-400" /> : <UserCheck className="h-3 w-3 text-green-400" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
