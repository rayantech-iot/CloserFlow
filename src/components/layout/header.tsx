"use client";

import { useAuth } from "@/providers/auth-provider";
import { Bell, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  title?: string;
  back?: string;
}

export function Header({
  searchQuery,
  onSearchChange,
  showSearch,
  title,
  back,
}: HeaderProps) {
  const { profile } = useAuth();

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
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Bell className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 text-sm">
        <span className="hidden lg:inline text-gray-400">{profile?.display_name}</span>
        <span className="rounded-md bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
          {profile?.role === "admin" ? "Admin" : profile?.role === "delivery_person" ? "Livreur" : "Closer"}
        </span>
      </div>
    </header>
  );
}
