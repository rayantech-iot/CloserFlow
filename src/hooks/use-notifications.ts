"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { OrderRow } from "@/types";
import { useAuth } from "@/providers/auth-provider";

const LS_KEY = "closerflow_last_seen";

export function useNotifications() {
  const { profile } = useAuth();
  const [count, setCount] = useState(0);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [open, setOpen] = useState(false);

  const lastSeen = typeof window !== "undefined"
    ? new Date(parseInt(localStorage.getItem(LS_KEY) || "0"))
    : new Date(0);

  const refresh = useCallback(async () => {
    if (!isSupabaseReady) return;
    const since = lastSeen.getTime() > 0 ? lastSeen.toISOString() : new Date(Date.now() - 86400000).toISOString();
    const { data } = await supabase
      .from("orders")
      .select("id,client_name,status,city,created_at,source")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (data || []) as OrderRow[];
    setOrders(list);
    setCount(list.length);
  }, [profile?.id]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("notif-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  const markRead = () => {
    localStorage.setItem(LS_KEY, Date.now().toString());
    setCount(0);
    setOrders([]);
    setOpen(false);
  };

  return { count, orders, open, setOpen, markRead, refresh };
}
