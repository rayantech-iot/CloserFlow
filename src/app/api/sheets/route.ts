import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getAdmin(token: string) {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client.auth.getUser(token).then(({ data, error }) => error ? null : data.user);
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const user = await getAdmin(authHeader.slice(7));
  if (!user) return NextResponse.json({ error: "Token invalide" }, { status: 401 });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from("sheets_config")
      .insert({
        name: body.name,
        sheet_url: body.sheet_url,
        sheet_gid: body.sheet_gid || "0",
        country: body.country || "",
        team_id: body.team_id || null,
        column_mapping: body.column_mapping || {},
        sync_enabled: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const user = await getAdmin(authHeader.slice(7));
  if (!user) return NextResponse.json({ error: "Token invalide" }, { status: 401 });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { id } = await request.json();
    const { error } = await supabase.from("sheets_config").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
