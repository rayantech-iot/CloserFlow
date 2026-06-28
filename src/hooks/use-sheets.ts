"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { SheetsConfigRow } from "@/types";

async function getToken(): Promise<string> {
  const session = await supabase.auth.getSession();
  return session?.data?.session?.access_token || "";
}

export function useSheetsConfigs() {
  return useQuery({
    queryKey: ["sheets-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("sheets_config").select("*").order("created_at", { ascending: false });
      return (data || []) as SheetsConfigRow[];
    },
    enabled: isSupabaseReady,
  });
}

export function useAddSheetConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: {
      name: string;
      sheet_url: string;
      sheet_gid?: string;
      country?: string;
      column_mapping?: Record<string, string>;
      team_id?: string;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Non authentifié");

      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets-configs"] });
    },
  });
}

export function useDeleteSheetConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Non authentifié");

      const res = await fetch("/api/sheets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets-configs"] });
    },
  });
}

export function useSyncSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: string) => {
      const res = await fetch("/api/sync-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["sheets-configs"] });
    },
  });
}
