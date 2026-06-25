"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { OrderStatus } from "@/types";
import type { OrderRow } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

function toCamelCase(o: OrderRow) {
  return { ...o, orderDate: o.order_date, clientName: o.client_name, claimedByName: "", claimedBy: o.claimed_by };
}

export function useOrders(statusFilter?: OrderStatus | "all") {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseReady) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    query.then(({ data }) => {
      setOrders((data || []) as OrderRow[]);
      setLoading(false);
    });

    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          let q = supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false });
          if (statusFilter && statusFilter !== "all") {
            q = q.eq("status", statusFilter);
          }
          q.then(({ data }) => setOrders((data || []) as OrderRow[]));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [statusFilter]);

  return { orders, loading };
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data: orderData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !orderData) throw new Error("Commande introuvable");
      const order = orderData as OrderRow;

      const { data: history } = await supabase
        .from("order_history")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: false });

      const { data: notes } = await supabase
        .from("order_notes")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: false });

      return { ...order, order_history: history || [], order_notes: notes || [] };
    },
    enabled: !!id && isSupabaseReady,
  });
}

export function useClaimOrder() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!profile) throw new Error("Non autorisé");

      const { data: orderData } = await supabase
        .from("orders")
        .select("claimed_by, status")
        .eq("id", orderId)
        .single();

      const order = orderData as { claimed_by: string | null; status: string } | null;
      if (!order) throw new Error("Commande introuvable");
      if (order.claimed_by && order.claimed_by !== profile.id) {
        throw new Error("Cette commande est déjà prise en charge");
      }

      const { error } = await supabase
        .from("orders")
        .update({
          claimed_by: profile.id,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      await supabase.from("order_history").insert({
        order_id: orderId,
        user_id: profile.id,
        user_name: profile.display_name,
        action: `${profile.display_name} prend en charge la commande`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const { profile, isAdmin } = useAuth();

  return useMutation({
    mutationFn: async ({
      orderId,
      newStatus,
    }: {
      orderId: string;
      newStatus: OrderStatus;
    }) => {
      if (!profile) throw new Error("Non autorisé");

      const { data: orderData } = await supabase
        .from("orders")
        .select("claimed_by, status")
        .eq("id", orderId)
        .single();

      const order = orderData as { claimed_by: string | null; status: string } | null;
      if (!order) throw new Error("Commande introuvable");

      if (!isAdmin) {
        if (order.claimed_by && order.claimed_by !== profile.id) {
          throw new Error("Vous ne pouvez pas modifier cette commande");
        }
        if (["livrée", "refusée", "annulée"].includes(order.status)) {
          throw new Error("Cette commande est verrouillée");
        }
      }

      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      await supabase.from("order_history").insert({
        order_id: orderId,
        user_id: profile.id,
        user_name: profile.display_name,
        action: `${profile.display_name} change le statut en "${newStatus}"`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useAddNote() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      orderId,
      content,
    }: {
      orderId: string;
      content: string;
    }) => {
      if (!profile) throw new Error("Non autorisé");

      const { error } = await supabase.from("order_notes").insert({
        order_id: orderId,
        user_id: profile.id,
        user_name: profile.display_name,
        content,
      });

      if (error) throw error;

      await supabase.from("order_history").insert({
        order_id: orderId,
        user_id: profile.id,
        user_name: profile.display_name,
        action: `${profile.display_name} ajoute une note`,
        details: content.substring(0, 100),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useSearchOrders(query: string) {
  return useQuery({
    queryKey: ["search-orders", query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data } = await supabase.rpc("search_orders", { search_query: query });
      return (data || []) as OrderRow[];
    },
    enabled: query.length > 0,
  });
}
