"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/providers/auth-provider";
import { loginSchema, registerSchema, type LoginFormData, type RegisterFormData } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Building2 } from "lucide-react";

export default function LoginPage() {
  const { login, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
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

  const onRegister = async (data: RegisterFormData) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error); return; }
      await login(data.email, data.password);
      router.push("/dashboard");
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10">
            {mode === "login" ? (
              <Package className="h-6 w-6 text-blue-500" />
            ) : (
              <Building2 className="h-6 w-6 text-blue-500" />
            )}
          </div>
          <CardTitle className="text-xl">
            {mode === "login" ? "Connexion" : "Créer votre organisation"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Connectez-vous à votre espace CloserFlow"
              : "Inscrivez-vous et devenez administrateur"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs */}
          <div className="flex rounded-lg bg-gray-900 p-1">
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                mode === "login" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                mode === "register" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Login form */}
          {mode === "login" && (
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
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-[#030712] px-2 text-gray-500">ou</span></div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => signInWithGoogle()}>
                <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuer avec Google
              </Button>
              <div className="text-center">
                <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  Mot de passe oublié ?
                </Link>
              </div>
            </form>
          )}

          {/* Register form */}
          {mode === "register" && (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Nom de l'organisation</label>
                <Input placeholder="Ex: Boutique Rose Éternelle" {...registerForm.register("organizationName")} />
                {registerForm.formState.errors.organizationName && (
                  <p className="text-xs text-red-400">{registerForm.formState.errors.organizationName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Votre nom</label>
                <Input placeholder="Ex: Clara" {...registerForm.register("displayName")} />
                {registerForm.formState.errors.displayName && (
                  <p className="text-xs text-red-400">{registerForm.formState.errors.displayName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Email</label>
                <Input type="email" placeholder="vous@exemple.com" {...registerForm.register("email")} />
                {registerForm.formState.errors.email && (
                  <p className="text-xs text-red-400">{registerForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Mot de passe</label>
                <Input type="password" placeholder="••••••••" {...registerForm.register("password")} />
                {registerForm.formState.errors.password && (
                  <p className="text-xs text-red-400">{registerForm.formState.errors.password.message}</p>
                )}
              </div>
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Création..." : "Créer mon organisation"}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-[#030712] px-2 text-gray-500">ou</span></div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => signInWithGoogle()}>
                <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuer avec Google
              </Button>
            </form>)}
        </CardContent>
      </Card>
    </div>
  );
}
