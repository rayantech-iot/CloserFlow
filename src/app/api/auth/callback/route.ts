import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Créer le profil si nouveau utilisateur
        const adminClient = createClient(supabaseUrl || "", serviceRoleKey || "", {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: existing } = await adminClient
          .from("profiles")
          .select("id")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!existing) {
          const displayName =
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email?.split("@")[0] ||
            "";

          await adminClient.from("profiles").insert({
            id: session.user.id,
            email: session.user.email || "",
            display_name: displayName,
            role: "admin",
            active: true,
            country: "",
          });
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
