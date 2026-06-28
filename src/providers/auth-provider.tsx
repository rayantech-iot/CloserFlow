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
  role: UserRole | null;
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

  const fetchProfile = async (userId: string) => {
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) return null;

    const res = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data) {
        setProfile(data);
        if (data.country) setCountryState(data.country);
        return data;
      }
    }

    // Nouvel utilisateur (Google OAuth) — créer le profil
    const { data: user } = await supabase.auth.getUser();
    if (user?.user?.email) {
      const res = await fetch("/api/auth/create-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email: user.user.email,
          displayName: user.user.user_metadata?.full_name || user.user.user_metadata?.name || "",
        }),
      });
      if (res.ok) {
        const session2 = await supabase.auth.getSession();
        const token2 = session2?.data?.session?.access_token;
        if (token2) {
          const res2 = await fetch("/api/profile", {
            headers: { Authorization: `Bearer ${token2}` },
          });
          if (res2.ok) {
            const newProfile = await res2.json();
            if (newProfile) {
              setProfile(newProfile);
              if (newProfile.country) setCountryState(newProfile.country);
              return newProfile;
            }
          }
        }
      }
    }
    return null;
  };

  useEffect(() => {
    if (!isSupabaseReady) {
      setLoading(false);
      return;
    }

    let resolved = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await fetchProfile(u.id);

      const hasAuthParams =
        window.location.hash.includes("access_token") ||
        window.location.search.includes("code=");
      if (!hasAuthParams || u) {
        setLoading(false);
        resolved = true;
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await fetchProfile(u.id);
      else setProfile(null);
      if (!resolved) {
        setLoading(false);
        resolved = true;
      }
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        setLoading(false);
        resolved = true;
      }
    }, 15000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const setCountry = useCallback((c: string) => {
    setCountryState(c);
    if (typeof window !== "undefined") {
      localStorage.setItem("closerflow_country", c);
    }
  }, []);

  useEffect(() => {
    if (profile && profile.role === "admin") {
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
  const isAdmin = role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        role,
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
