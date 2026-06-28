"use client";

import { useAuth } from "@/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { OrderRow } from "@/types";
import { User, Mail, Shield, Calendar, Package, CheckCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ total: 0, livree: 0 });

  useEffect(() => {
    if (!profile?.id || !isSupabaseReady) return;

    const fetchStats = async () => {
      const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("claimed_by", profile.id);

      if (data) {
        const orders = data as Pick<OrderRow, "status">[];
        setStats({
          total: orders.length,
          livree: orders.filter((o) => o.status === "livrée").length,
        });
      }
    };
    fetchStats();
  }, [profile?.id]);

  return (
    <div>
      <Header title="Profil" />
      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 lg:h-16 lg:w-16 items-center justify-center rounded-2xl bg-blue-600/10 shrink-0">
                <User className="h-7 w-7 lg:h-8 lg:w-8 text-blue-500" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg lg:text-xl truncate">{profile?.display_name}</CardTitle>
                <p className="text-sm text-gray-400 truncate">{profile?.email}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <div className="p-3 rounded-lg bg-gray-800/30">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <Shield className="h-4 w-4" /> Rôle
                </div>
                <p className="font-medium text-white capitalize">
                  {profile?.role === "admin" ? "Administrateur" : "Closer"}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gray-800/30">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <Calendar className="h-4 w-4" /> Membre depuis
                </div>
                <p className="font-medium text-white">
                  {profile?.created_at ? formatDate(profile.created_at) : "-"}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gray-800/30">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <Package className="h-4 w-4" /> Commandes traitées
                </div>
                <p className="font-medium text-white">{stats.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-800/30">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <CheckCircle className="h-4 w-4" /> Livrées
                </div>
                <p className="font-medium text-white">{stats.livree}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
