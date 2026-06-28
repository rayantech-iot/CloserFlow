import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getAdminClient = () => {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

export async function POST(request: Request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }
  try {
    const { email, password, displayName, role, phone, country, teamId } = await request.json();

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authUser.user) {
      if (authError?.message?.includes("already")) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
      }
      return NextResponse.json({ error: authError?.message || "Erreur de création" }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authUser.user.id,
      email,
      display_name: displayName,
      role: role || "closer",
      phone: phone || "",
      country: country || "",
      organization_id: null,
      team_id: teamId || null,
      active: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId: authUser.user.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }
  try {
    const { userId, displayName, role, active, country, teamId } = await request.json();
    const updates: any = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = active;
    if (country !== undefined) updates.country = country;
    if (teamId !== undefined) updates.team_id = teamId || null;

    const { error } = await supabaseAdmin.from("profiles").update(updates).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
