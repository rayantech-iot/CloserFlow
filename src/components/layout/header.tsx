"use client";

import { useAuth } from "@/providers/auth-provider";
import { Bell, ArrowLeft, X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";
import { getTimeAgo } from "@/lib/utils";

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  title?: string;
  back?: string;
}

export function Header({ searchQuery, onSearchChange, showSearch, title, back }: HeaderProps) {
  const { profile } = useAuth();
  const { count, orders, open, setOpen, markRead } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpen]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl px-4 lg:px-6">
      {back && (
        <Link href={back}>
          <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      )}
      {title && (
        <h1 className="text-base lg:text-lg font-semibold text-white truncate">{title}</h1>
      )}
      {showSearch && (
        <div className="relative flex-1 max-w-xs lg:max-w-md">
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-3 h-9 text-sm"
          />
        </div>
      )}
      <div className="flex-1 min-w-0" />

      <div className="relative" ref={panelRef}>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative" onClick={() => setOpen(!open)}>
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-medium text-white">Notifications</span>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <button onClick={markRead} className="text-xs text-blue-400 hover:text-blue-300">
                    Tout marquer lu
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {orders.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">Aucune notification</div>
              ) : (
                orders.map((o) => (
                  <Link key={o.id} href={`/orders/${o.id}`} onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 last:border-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 shrink-0 mt-0.5">
                      <Package className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{o.client_name}</p>
                      <p className="text-xs text-gray-500 truncate">{o.city} — {o.source || "Import"}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{getTimeAgo(o.created_at)}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="hidden lg:inline text-gray-400">{profile?.display_name}</span>
        <span className="rounded-md bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
          {profile?.role === "admin" ? "Admin" : profile?.role === "delivery_person" ? "Livreur" : "Closer"}
        </span>
      </div>
    </header>
  );
}
