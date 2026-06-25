"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { ProfileRow, UserRole } from "@/types";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  role: UserRole | null;
  organizationId: string | null;
  country: string;
  setCountry: (c: string) => void;
  login: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [country, setCountryState] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseReady) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      setProfile(data);
      if (data.country) setCountryState(data.country);
    } else {
      // Nouvel utilisateur (Google OAuth) — créer le profil
      const { data: user } = await supabase.auth.getUser();
      if (user?.user?.email) {
        await fetch("/api/auth/create-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            email: user.user.email,
            displayName: user.user.user_metadata?.full_name || user.user.user_metadata?.name || "",
          }),
        });
        // Recharger le profil
        const { data: newProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (newProfile) {
          setProfile(newProfile);
          if (newProfile.country) setCountryState(newProfile.country);
        }
      }
    }
  };

  const setCountry = useCallback((c: string) => {
    setCountryState(c);
    if (typeof window !== "undefined") {
      localStorage.setItem("closerflow_country", c);
    }
  }, []);

  useEffect(() => {
    if (profile && (profile.role === "admin" || profile.role === "super_admin")) {
      const saved = localStorage.getItem("closerflow_country");
      if (saved) setCountryState(saved);
    }
  }, [profile?.role]);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const refreshProfile = async () => {
    if (user) fetchProfile(user.id);
  };

  const role = profile?.role ?? null;
  const isAdmin = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";
  const organizationId = profile?.organization_id ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        isSuperAdmin,
        role,
        organizationId,
        country,
        setCountry,
        login,
        signInWithGoogle,
        logout,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
