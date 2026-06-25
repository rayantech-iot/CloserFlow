"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, Users, ChevronRight, Globe } from "lucide-react";
import Link from "next/link";
import type { OrganizationRow } from "@/types";

export default function AdminOrganizationsPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.push("/dashboard");
      return;
    }
    if (isSuperAdmin) fetchOrgs();
  }, [isSuperAdmin, authLoading, router]);

  const fetchOrgs = async () => {
    const res = await fetch("/api/organizations");
    const data = await res.json();
    setOrgs(data);
    setLoading(false);
  };

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setForm({ name: "", slug: "" });
    setDialogOpen(false);
    fetchOrgs();
  };

  return (
    <div>
      <Header title="Organisations" />
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base lg:text-lg font-medium text-white">
            {orgs.length} organisation{orgs.length !== 1 ? "s" : ""}
          </h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nouvelle organisation</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer une organisation</DialogTitle></DialogHeader>
              <form onSubmit={createOrg} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Nom</label>
                  <Input value={form.name} onChange={(e) => {
                    const n = e.target.value;
                    setForm({ name: n, slug: n.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") });
                  }} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Slug (identifiant unique)</label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
                </div>
                {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{error}</div>}
                <Button type="submit" className="w-full">Créer</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {orgs.map((org) => (
            <Link key={org.id} href={`/admin/organizations/${org.id}`}>
              <Card className="cursor-pointer hover:border-blue-500/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/10 shrink-0">
                        <Building2 className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-white">{org.name}</span>
                        <p className="text-xs text-gray-500">/{org.slug}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
