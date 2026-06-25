import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAdmin() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getAdmin();
  if (!supabase) return NextResponse.json({ error: "Non configuré" }, { status: 500 });

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("organization_id", id)
    .order("created_at", { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getAdmin();
  if (!supabase) return NextResponse.json({ error: "Non configuré" }, { status: 500 });

  try {
    const { userId, role, teamId, country } = await request.json();
    if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 });

    const update: Record<string, any> = { organization_id: id };
    if (role) update.role = role;
    if (teamId !== undefined) update.team_id = teamId || null;
    if (country !== undefined) update.country = country || "";

    const { data, error } = await supabase.from("profiles").update(update).eq("id", userId).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
