import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAdmin() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const supabase = await getAdmin();
  if (!supabase) return NextResponse.json({ error: "Non configuré" }, { status: 500 });
  const { data } = await supabase.from("organizations").select("*").order("created_at", { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const supabase = await getAdmin();
  if (!supabase) return NextResponse.json({ error: "Non configuré" }, { status: 500 });

  try {
    const { name, slug } = await request.json();
    if (!name || !slug) return NextResponse.json({ error: "name et slug requis" }, { status: 400 });

    const { data, error } = await supabase
      .from("organizations")
      .insert({ name, slug: slug.toLowerCase().replace(/\s+/g, "-"), created_by: null })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
