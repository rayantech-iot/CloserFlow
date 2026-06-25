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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; teamId: string }> }) {
  const { id: orgId, teamId } = await params;
  const supabase = await getAdmin();
  if (!supabase) return NextResponse.json({ error: "Non configuré" }, { status: 500 });

  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from("teams")
      .update(body)
      .eq("id", teamId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; teamId: string }> }) {
  const { id: orgId, teamId } = await params;
  const supabase = await getAdmin();
  if (!supabase) return NextResponse.json({ error: "Non configuré" }, { status: 500 });

  const { error } = await supabase.from("teams").delete().eq("id", teamId).eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
