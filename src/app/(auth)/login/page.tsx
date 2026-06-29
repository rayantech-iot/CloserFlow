"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/providers/auth-provider";
import { loginSchema, type LoginFormData } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function LoginPage() {
  const { login, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onLogin = async (data: LoginFormData) => {
    setError("");
    setLoading(true);
    try {
      await login(data.email, data.password);
      router.push("/dashboard");
    } catch (e: any) {
      const msg = e?.code?.includes("invalid") || e?.message?.includes("Invalid")
        ? "Email ou mot de passe incorrect"
        : e?.code === "auth/too-many-requests"
        ? "Trop de tentatives. Réessayez plus tard."
        : "Une erreur est survenue";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10">
            <Package className="h-6 w-6 text-blue-500" />
          </div>
          <CardTitle className="text-xl">Connexion</CardTitle>
          <CardDescription>Connectez-vous à votre espace CloserFlow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Email</label>
              <Input type="email" placeholder="vous@exemple.com" {...loginForm.register("email")} />
              {loginForm.formState.errors.email && (
                <p className="text-xs text-red-400">{loginForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Mot de passe</label>
              <Input type="password" placeholder="••••••••" {...loginForm.register("password")} />
              {loginForm.formState.errors.password && (
                <p className="text-xs text-red-400">{loginForm.formState.errors.password.message}</p>
              )}
            </div>
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
