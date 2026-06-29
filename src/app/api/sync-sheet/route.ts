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

const COLUMN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function letterToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

export async function POST(request: Request) {
  const supabase = getAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  try {
    const { configId } = await request.json();
    if (!configId) {
      return NextResponse.json({ error: "configId requis" }, { status: 400 });
    }

    // 1. Récupérer la config
    const { data: config, error: configError } = await supabase
      .from("sheets_config")
      .select("*")
      .eq("id", configId)
      .single();

    if (configError || !config) {
      return NextResponse.json({ error: "Configuration introuvable" }, { status: 404 });
    }

    // 2. Extraire l'ID du spreadsheet
    const sheetId = extractSheetId(config.sheet_url);
    if (!sheetId) {
      return NextResponse.json({ error: "URL de sheet invalide" }, { status: 400 });
    }

    const gid = config.sheet_gid || extractGid(config.sheet_url);

    // 3. Télécharger le CSV (essaye plusieurs formats d'URL)
    const urlsToTry = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv`,
    ];

    let csvText = "";
    let lastError = "";

    for (const url of urlsToTry) {
      const resp = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/csv, application/csv, text/plain,*/*",
        },
        redirect: "follow",
      });

      if (resp.ok) {
        csvText = await resp.text();
        break;
      }
      const text = await resp.text().catch(() => "");
      lastError = `URL ${url} → HTTP ${resp.status}: ${text.slice(0, 100)}`;
    }

    if (!csvText) {
      return NextResponse.json(
        {
          error: `Impossible de lire le sheet.`,
          detail:
            `Assurez-vous que le sheet est partagé en "Toute personne disposant du lien peut lire".\n` +
            `Si le problème persiste, publiez-le : Fichier > Partager > Publier sur le Web > CSV.\n\n` +
            `Dernière erreur : ${lastError}`,
        },
        { status: 400 }
      );
    }

    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return NextResponse.json({ error: "Le sheet est vide" }, { status: 400 });
    }

    // 4. Supprimer l'en-tête
    const headerRow = rows[0];
    const dataRows = rows.slice(1);

    // 5. Appliquer le mapping des colonnes
    const mapping = (config.column_mapping as Record<string, string>) || {};
    const fieldToCol: Record<string, number> = {};

    for (const [field, colLetter] of Object.entries(mapping)) {
      const colStr = String(colLetter).toUpperCase();
      const idx = letterToIndex(colStr);
      if (idx >= 0) fieldToCol[field] = idx;
    }

    // 6. Convertir les lignes en commandes
    const getVal = (row: string[], field: string): string => {
      const idx = fieldToCol[field];
      return idx !== undefined && idx < row.length ? row[idx] : "";
    };

    const orders: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;
      const clientName = getVal(row, "clientName");
      const phone = getVal(row, "phone");
      const product = getVal(row, "product");

      if (!clientName || !phone) {
        errors.push(`Ligne ${rowNum}: nom ou téléphone manquant, ignorée`);
        continue;
      }

      const sheetRowId = `${sheetId}_${gid}_${rowNum}`;
      const quantity = parseInt(getVal(row, "quantity")) || 1;
      const price = parseFloat(getVal(row, "price").replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
      const rawDate = getVal(row, "orderDate");
      const orderDate = (() => {
        if (!rawDate) return new Date().toISOString();
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) return parsed.toISOString();
        const excelSerial = parseInt(rawDate);
        if (!isNaN(excelSerial) && excelSerial > 59) {
          return new Date(Date.UTC(1900, 0, excelSerial - 1)).toISOString();
        }
        return new Date().toISOString();
      })();

      orders.push({
        client_name: clientName,
        phone: phone.replace(/[\s\-]/g, ""),
        city: getVal(row, "city"),
        address: getVal(row, "address"),
        product,
        quantity,
        price,
        comments: getVal(row, "comments"),
        order_date: orderDate,
        source: `Google Sheets: ${config.name}`,
        status: "nouvelle",
        country: getVal(row, "country") || config.country || "",
        organization_id: config.organization_id || null,
        team_id: config.team_id || null,
        sheet_row_id: sheetRowId,
      });
    }

    if (orders.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        errors,
        message: "Aucune commande valide trouvée",
      });
    }

    // 7. Vérifier les doublons (sheet_row_id déjà existant)
    const sheetRowIds = orders.map((o) => o.sheet_row_id);
    const { data: existing } = await supabase
      .from("orders")
      .select("sheet_row_id")
      .in("sheet_row_id", sheetRowIds);

    const existingSet = new Set(existing?.map((e: any) => e.sheet_row_id) || []);
    let newOrders = orders.filter((o) => !existingSet.has(o.sheet_row_id));
    let skipped = orders.length - newOrders.length;

    // 7b. Déduplication par contenu (même nom + téléphone + produit depuis ce sheet)
    const sourceName = `Google Sheets: ${config.name}`;
    const { data: recent } = await supabase
      .from("orders")
      .select("client_name, phone, product, price")
      .eq("source", sourceName)
      .gte("created_at", new Date(Date.now() - 86400000 * 7).toISOString());

    const recentSet = new Set(
      (recent || []).map((o: any) => `${o.client_name}|${o.phone}|${o.product}|${o.price}`)
    );

    const beforeContentDedup = newOrders.length;
    newOrders = newOrders.filter((o) => !recentSet.has(`${o.client_name}|${o.phone}|${o.product}|${o.price}`));
    skipped += beforeContentDedup - newOrders.length;

    if (newOrders.length === 0) {
      await supabase
        .from("sheets_config")
        .update({ last_synced: new Date().toISOString() })
        .eq("id", configId);

      return NextResponse.json({
        imported: 0,
        skipped,
        errors,
        message: "Tout est déjà à jour",
      });
    }

    // 8. Insérer les nouvelles commandes
    const { error: insertError } = await supabase.from("orders").insert(newOrders);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 9. Logger dans l'historique
    await supabase.from("order_history").insert(
      newOrders.map((o: any) => ({
        order_id: o.id,
        user_name: "Système",
        action: `Commande importée depuis ${config.name}`,
      }))
    );

    // 10. Notifier WhatsApp si configuré
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && newOrders.length > 0) {
      const first = newOrders[0];
      const msg = `🆕 ${newOrders.length} nouvelle(s) commande(s) CloserFlow\n\nEx: ${first.client_name} — ${first.city}\n${first.product} | ${first.price} FCFA\n${first.phone}`;
      fetch(
        `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: process.env.WHATSAPP_GROUP_ID || process.env.WHATSAPP_PHONE_ID,
            type: "text",
            text: { body: msg },
          }),
        }
      ).catch(() => {});
    }

    // 11. Mettre à jour le timestamp de synchro
    await supabase
      .from("sheets_config")
      .update({ last_synced: new Date().toISOString() })
      .eq("id", configId);

    return NextResponse.json({
      imported: newOrders.length,
      skipped,
      errors: errors.slice(0, 20),
      message: `${newOrders.length} commande(s) importée(s) avec succès`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: efface toutes les commandes importées depuis ce sheet (pour réimporter)
export async function DELETE(request: Request) {
  const supabase = getAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  try {
    const { configId } = await request.json();
    if (!configId) {
      return NextResponse.json({ error: "configId requis" }, { status: 400 });
    }

    const { data: config } = await supabase
      .from("sheets_config")
      .select("name, sheet_url")
      .eq("id", configId)
      .single();

    if (!config) {
      return NextResponse.json({ error: "Configuration introuvable" }, { status: 404 });
    }

    const sheetId = extractSheetId(config.sheet_url);
    const prefix = sheetId ? `${sheetId}_` : "";

    // Supprime les commandes dont sheet_row_id commence par l'ID du sheet
    let deletedCount = 0;
    if (prefix) {
      const { data: toDelete } = await supabase
        .from("orders")
        .select("id")
        .like("sheet_row_id", `${prefix}%`);

      if (toDelete && toDelete.length > 0) {
        const ids = toDelete.map((r: any) => r.id);
        // Supprimer l'historique et les notes liés
        await supabase.from("order_history").delete().in("order_id", ids);
        await supabase.from("order_notes").delete().in("order_id", ids);
        const { count } = await supabase.from("orders").delete().in("id", ids);
        deletedCount = count || ids.length;
      }
    }

    // Reset le timestamp
    await supabase
      .from("sheets_config")
      .update({ last_synced: null })
      .eq("id", configId);

    return NextResponse.json({
      deleted: deletedCount,
      message: `${deletedCount} commande(s) supprimée(s). Vous pouvez maintenant resynchroniser.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
