"use client";

import { useAuth } from "@/providers/auth-provider";

export function useCountryFilter() {
  const { isAdmin, country, profile } = useAuth();

  const apply = <T extends { country?: string }>(items: T[]): T[] => {
    if (isAdmin && !country) return items;
    if (isAdmin && country) return items.filter((i) => i.country === country);
    if (!isAdmin && profile?.country) return items.filter((i) => !i.country || i.country === profile.country);
    return items;
  };

  const query = <T extends Record<string, any>>(qb: T): T => {
    if (isAdmin && country) return { ...qb, eq: (qb as any).eq ? qb : qb, filter: `country=eq.${country}` } as any;
    if (!isAdmin && profile?.country) return { ...qb, filter: `country=eq.${profile.country}` } as any;
    return qb;
  };

  return { apply, countryFilter: isAdmin ? country : profile?.country || "", isAdmin };
}
