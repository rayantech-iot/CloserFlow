"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

export default function AuthCallback() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#030712]">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-500">Connexion en cours...</p>
      </div>
    </div>
  );
}
