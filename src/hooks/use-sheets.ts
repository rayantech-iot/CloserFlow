"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import type { SheetsConfigRow } from "@/types";

export function useSheetsConfigs() {
  const { isSuperAdmin, organizationId } = useAuth();

  return useQuery({
    queryKey: ["sheets-configs", organizationId],
    queryFn: async () => {
      let query = supabase.from("sheets_config").select("*");
      // Admin org ne voit que ses sheets
      if (!isSuperAdmin && organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      const { data } = await query.order("created_at", { ascending: false });
      return (data || []) as SheetsConfigRow[];
    },
    enabled: isSupabaseReady,
  });
}

export function useAddSheetConfig() {
  const queryClient = useQueryClient();
  const { profile, organizationId } = useAuth();

  return useMutation({
    mutationFn: async (config: {
      name: string;
      sheet_url: string;
      sheet_gid?: string;
      country?: string;
      column_mapping?: Record<string, string>;
      organization_id?: string | null;
      team_id?: string;
    }) => {
      if (!profile) throw new Error("Non autorisé");

      const { data, error } = await supabase
        .from("sheets_config")
        .insert({
          name: config.name,
          sheet_url: config.sheet_url,
          sheet_gid: config.sheet_gid || "0",
          country: config.country || "",
          organization_id: config.organization_id ?? organizationId ?? null,
          team_id: config.team_id || null,
          column_mapping: config.column_mapping || {
            clientName: "A",
            phone: "B",
            city: "C",
            address: "D",
            product: "E",
            quantity: "F",
            price: "G",
            comments: "H",
            orderDate: "I",
            country: "J",
          },
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;
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
      const { error } = await supabase.from("sheets_config").delete().eq("id", id);
      if (error) throw error;
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
