"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Inbox,
  BarChart3,
  Users,
  UserCircle,
  LogOut,
  X,
  FileSpreadsheet,
  Menu,
  Globe,
  Truck,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin, role, logout, profile, country, setCountry } = useAuth();
  const isCloser = role === "closer";
  const isDeliveryPerson = role === "delivery_person";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    if (!isAdmin || !isSupabaseReady) return;
    supabase
      .from("orders")
      .select("country")
      .not("country", "eq", "")
      .then(({ data }) => {
        if (!data) return;
        const unique = [...new Set(data.map((r: any) => r.country).filter(Boolean))] as string[];
        setCountries(unique.sort());
      });
  }, [isAdmin]);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, show: true },
    { name: "Commandes", href: "/orders", icon: Package, show: isAdmin || isCloser },
    { name: "Boîte de réception", href: "/inbox", icon: Inbox, show: isCloser },
    { name: "À rappeler", href: "/reminders", icon: Phone, show: isCloser },
    { name: "Livraisons", href: "/deliveries", icon: Truck, show: isAdmin || isDeliveryPerson },
    { name: "Google Sheets", href: "/sheets", icon: FileSpreadsheet, show: isAdmin },
    { name: "Équipes", href: "/teams", icon: Globe, show: isAdmin },
    { name: "Statistiques", href: "/stats", icon: BarChart3, show: isAdmin || isCloser },
    { name: "Utilisateurs", href: "/users", icon: Users, show: isAdmin },
    { name: "Profil", href: "/profile", icon: UserCircle, show: true },
  ];

  const links = navigation.filter((item) => item.show);

  const NavItems = ({ mobile }: { mobile?: boolean }) => (
    <>
      {links.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-blue-600/10 text-blue-400"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200",
              mobile && "text-base py-3"
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-gray-800 bg-gray-950 transition-transform duration-300 w-64",
          "lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-gray-800 px-4">
          <span className="text-lg font-bold tracking-tight text-white">
            Closer<span className="text-blue-500">Flow</span>
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavItems mobile />
        </nav>
        <div className="border-t border-gray-800 p-3 space-y-2">
          {isAdmin && countries.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
              <Globe className="h-4 w-4 shrink-0" />
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-gray-200 text-sm cursor-pointer"
              >
                <option value="">Tous les pays</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          {!isAdmin && country && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
              <Globe className="h-3 w-3" />
              Équipe : {country}
            </div>
          )}
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-gray-400 hover:text-red-400"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className="ml-3">Déconnexion</span>
          </Button>
        </div>
      </aside>

      <aside className="fixed left-0 top-0 z-30 hidden h-screen flex-col border-r border-gray-800 bg-gray-950/95 backdrop-blur-xl w-60 lg:flex">
        <div className="flex h-14 items-center border-b border-gray-800 px-4">
          <span className="text-lg font-bold tracking-tight text-white">
            Closer<span className="text-blue-500">Flow</span>
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          <NavItems />
        </nav>
        <div className="border-t border-gray-800 p-2 space-y-1">
          {isAdmin && countries.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 rounded-lg hover:bg-gray-800/30">
              <Globe className="h-4 w-4 shrink-0" />
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-gray-200 text-sm cursor-pointer"
              >
                <option value="">Tous les pays</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          {!isAdmin && country && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
              <Globe className="h-3 w-3" />
              Équipe : {country}
            </div>
          )}
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-gray-400 hover:text-red-400"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className="ml-3">Déconnexion</span>
          </Button>
        </div>
      </aside>

      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-3.5 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-gray-300 lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
    </>
  );
}
