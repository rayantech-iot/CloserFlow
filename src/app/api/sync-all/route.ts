import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdmin() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function extractGid(url: string): string {
  const match = url.match(/[?&]gid=(\d+)/);
  return match ? match[1] : "0";
}

const COLUMN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function letterToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  const row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (current.length > 0 || row.length > 0) {
        row.push(current.trim());
        current = "";
        if (row.some((c) => c.length > 0)) rows.push(row);
        row.length = 0;
      }
      if (ch === "\r" && next === "\n") i++;
    } else {
      current += ch;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows;
}

async function tryFetchCSV(sheetId: string, gid: string): Promise<string | null> {
  const urls = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv`,
  ];

  for (const url of urls) {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/csv, application/csv, text/plain,*/*",
      },
      redirect: "follow",
    });

    if (resp.ok) return await resp.text();
  }
  return null;
}

async function syncSheet(supabase: any, config: any): Promise<string> {
  const sheetId = extractSheetId(config.sheet_url);
  if (!sheetId) return `${config.name}: URL invalide`;

  const gid = config.sheet_gid || extractGid(config.sheet_url);
  const csvText = await tryFetchCSV(sheetId, gid);
  if (!csvText) return `${config.name}: inaccessible`;

  const rows = parseCSV(csvText);
  if (rows.length < 2) return `${config.name}: vide`;

  const dataRows = rows.slice(1);
  const mapping = (config.column_mapping as Record<string, string>) || {};
  const fieldToCol: Record<string, number> = {};

  for (const [field, colLetter] of Object.entries(mapping)) {
    const colStr = String(colLetter).toUpperCase();
    const idx = letterToIndex(colStr);
    if (idx >= 0) fieldToCol[field] = idx;
  }

  const getVal = (row: string[], field: string): string => {
    const idx = fieldToCol[field];
    return idx !== undefined && idx < row.length ? row[idx] : "";
  };

  const orders: any[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const clientName = getVal(row, "clientName");
    const phone = getVal(row, "phone");
    if (!clientName || !phone) continue;

    const sheetRowId = `${sheetId}_${gid}_${i + 2}`;
    const quantity = parseInt(getVal(row, "quantity")) || 1;
    const price = parseFloat(getVal(row, "price").replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;

      orders.push({
      client_name: clientName,
      phone: phone.replace(/[\s\-]/g, ""),
      city: getVal(row, "city"),
      address: getVal(row, "address"),
      product: getVal(row, "product"),
      quantity,
      price,
      comments: getVal(row, "comments"),
      order_date: (() => {
        const raw = getVal(row, "orderDate");
        if (!raw) return new Date().toISOString();
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d.toISOString();
        const n = parseInt(raw);
        if (!isNaN(n) && n > 59) return new Date(Date.UTC(1900, 0, n - 1)).toISOString();
        return new Date().toISOString();
      })(),
      source: `Google Sheets: ${config.name}`,
      status: "nouvelle",
      country: getVal(row, "country") || config.country || "",
      organization_id: config.organization_id || null,
      team_id: config.team_id || null,
      sheet_row_id: sheetRowId,
    });
  }

  if (orders.length === 0) return `${config.name}: aucune commande valide`;

  const sheetRowIds = orders.map((o: any) => o.sheet_row_id);
  const { data: existing } = await supabase
    .from("orders")
    .select("sheet_row_id")
    .in("sheet_row_id", sheetRowIds);

  const existingSet = new Set(existing?.map((e: any) => e.sheet_row_id) || []);
  const newOrders = orders.filter((o: any) => !existingSet.has(o.sheet_row_id));

  if (newOrders.length === 0) {
    await supabase
      .from("sheets_config")
      .update({ last_synced: new Date().toISOString() })
      .eq("id", config.id);
    return `${config.name}: déjà à jour`;
  }

  await supabase.from("orders").insert(newOrders);
  await supabase
    .from("sheets_config")
    .update({ last_synced: new Date().toISOString() })
    .eq("id", config.id);

  return `${config.name}: ${newOrders.length} commande(s) importée(s)`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const query = new URL(request.url).searchParams;
  const token = query.get("token");

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const isValid = authHeader === `Bearer ${cronSecret}` || token === cronSecret;
    if (!isValid) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  }

  const supabase = getAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const { data: configs, error } = await supabase
    .from("sheets_config")
    .select("*");

  if (error || !configs?.length) {
    return NextResponse.json({ synced: 0, errors: error?.message || "Aucune configuration" });
  }

  const results = await Promise.all(configs.map((c: any) => syncSheet(supabase, c)));

  return NextResponse.json({ synced: configs.length, results });
}
