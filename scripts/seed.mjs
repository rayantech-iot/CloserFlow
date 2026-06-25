// Script de seed pour test - exécute avec : node scripts/seed.mjs
// Prérequis : la migration 00003 doit être exécutée.

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Charger .env.local
const envPath = resolve(__dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Impossible de charger les variables d'environnement depuis .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
});

async function createUser(email, password, displayName, role, country, organizationId) {
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) {
    if (authError.message?.includes("already")) {
      console.log(`  ↳ ${email} existe déjà, mise à jour du profil...`);
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();
      if (existing) {
        await supabase
          .from("profiles")
          .update({ role, country, organization_id: organizationId, display_name: displayName })
          .eq("id", existing.id);
        return existing.id;
      }
      return null;
    }
    console.error(`  ✗ ${email}: ${authError.message}`);
    return null;
  }

  const userId = authUser.user.id;
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    email,
    display_name: displayName,
    role,
    phone: "",
    country: country || "",
    organization_id: organizationId || null,
    active: true,
  });

  if (profileError) {
    console.error(`  ✗ ${email} (profil): ${profileError.message}`);
    await supabase.auth.admin.deleteUser(userId);
    return null;
  }

  console.log(`  ✓ ${email} (${role})`);
  return userId;
}

async function seed() {
  console.log("\n🌱 Création des données de test...\n");

  // --- 1. Créer les organisations ---
  console.log("=== Organisations ===");

  const { data: org1, error: e1 } = await supabase
    .from("organizations")
    .upsert({ name: "Boutique Clara", slug: "boutique-clara" }, { onConflict: "slug" })
    .select()
    .single();
  if (e1) { console.error("Erreur org1:", e1.message); process.exit(1); }
  console.log(`  ✓ ${org1.name}`);

  const { data: org2, error: e2 } = await supabase
    .from("organizations")
    .upsert({ name: "Tech Shop Mali", slug: "tech-shop-mali" }, { onConflict: "slug" })
    .select()
    .single();
  if (e2) { console.error("Erreur org2:", e2.message); process.exit(1); }
  console.log(`  ✓ ${org2.name}`);

  const { data: org3, error: e3 } = await supabase
    .from("organizations")
    .upsert({ name: "Distrib Express", slug: "distrib-express" }, { onConflict: "slug" })
    .select()
    .single();
  if (e3) { console.error("Erreur org3:", e3.message); process.exit(1); }
  console.log(`  ✓ ${org3.name}`);

  const orgs = [org1, org2, org3];

  // --- 2. Créer les utilisateurs ---
  console.log("\n=== Utilisateurs ===");

  // Super admin (admin existant promu)
  // On skip car l'utilisateur doit le faire manuellement depuis le SQL editor

  // Org 1 - Boutique Clara
  const admin1 = await createUser("clara@test.com", "password123", "Clara", "admin", "", org1.id);
  await createUser("abdou@test.com", "password123", "Abdou", "closer", "Côte d'Ivoire", org1.id);
  await createUser("fatou@test.com", "password123", "Fatou", "closer", "Sénégal", org1.id);

  // Org 2 - Tech Shop Mali
  const admin2 = await createUser("modibo@test.com", "password123", "Modibo", "admin", "", org2.id);
  await createUser("amadou@test.com", "password123", "Amadou", "closer", "Mali", org2.id);
  await createUser("mariam@test.com", "password123", "Mariam", "closer", "Burkina Faso", org2.id);

  // Org 3 - Distrib Express
  const admin3 = await createUser("jean@test.com", "password123", "Jean", "admin", "", org3.id);
  await createUser("paul@test.com", "password123", "Paul", "closer", "Cameroun", org3.id);
  await createUser("sylvie@test.com", "password123", "Sylvie", "closer", "Gabon", org3.id);

  // --- 3. Créer les équipes ---
  console.log("\n=== Équipes ===");

  const teamData = [
    { name: "Équipe Abidjan", orgIdx: 0, country: "Côte d'Ivoire" },
    { name: "Équipe Dakar", orgIdx: 0, country: "Sénégal" },
    { name: "Équipe Bamako", orgIdx: 1, country: "Mali" },
    { name: "Équipe Ouagadougou", orgIdx: 1, country: "Burkina Faso" },
    { name: "Équipe Douala", orgIdx: 2, country: "Cameroun" },
    { name: "Équipe Libreville", orgIdx: 2, country: "Gabon" },
  ];

  const teams = [];
  for (const t of teamData) {
    const { data: team } = await supabase
      .from("teams")
      .insert({
        name: t.name,
        organization_id: orgs[t.orgIdx].id,
        country: t.country,
      })
      .select()
      .single();
    teams.push(team);
    console.log(`  ✓ ${team.name} (${orgs[t.orgIdx].name})`);
  }

  // --- 4. Assigner les closers à leurs équipes ---
  console.log("\n=== Assignation closer → équipe ===");

  const assignments = [
    { email: "abdou@test.com", teamIdx: 0 },
    { email: "fatou@test.com", teamIdx: 1 },
    { email: "amadou@test.com", teamIdx: 2 },
    { email: "mariam@test.com", teamIdx: 3 },
    { email: "paul@test.com", teamIdx: 4 },
    { email: "sylvie@test.com", teamIdx: 5 },
  ];

  for (const a of assignments) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", a.email)
      .single();
    if (profile) {
      await supabase.from("profiles").update({ team_id: teams[a.teamIdx].id }).eq("id", profile.id);
      console.log(`  ✓ ${a.email} → ${teams[a.teamIdx].name}`);
    }
  }

  // --- 5. Créer quelques commandes test par org ---
  console.log("\n=== Commandes test ===");

  const testOrders = [
    {
      client_name: "Kouamé Alexis",
      phone: "+2250101020304",
      city: "Abidjan",
      address: "Cocody Angré",
      product: "Robe africaine wax",
      quantity: 2,
      price: 25000,
      country: "Côte d'Ivoire",
      organization_id: org1.id,
      status: "nouvelle",
    },
    {
      client_name: "Diallo Mariam",
      phone: "+221770010203",
      city: "Dakar",
      address: "Mermoz",
      product: "Sac en pagne",
      quantity: 1,
      price: 15000,
      country: "Sénégal",
      organization_id: org1.id,
      status: "nouvelle",
    },
    {
      client_name: "Traoré Sékou",
      phone: "+22370112233",
      city: "Bamako",
      address: "Hamdallaye",
      product: "Ordinateur portable",
      quantity: 1,
      price: 350000,
      country: "Mali",
      organization_id: org2.id,
      status: "confirmée",
    },
    {
      client_name: "Ouédraogo Salif",
      phone: "+22670223344",
      city: "Ouagadougou",
      address: "Zone du Bois",
      product: "Casque audio",
      quantity: 3,
      price: 45000,
      country: "Burkina Faso",
      organization_id: org2.id,
      status: "nouvelle",
    },
    {
      client_name: "Nkoulou Simon",
      phone: "+237691122334",
      city: "Douala",
      address: "Bonanjo",
      product: "Télévision 43\"",
      quantity: 1,
      price: 250000,
      country: "Cameroun",
      organization_id: org3.id,
      status: "programmée",
    },
    {
      client_name: "Mba Rose",
      phone: "+24174112233",
      city: "Libreville",
      address: "Glass",
      product: "Climatiseur mobile",
      quantity: 2,
      price: 180000,
      country: "Gabon",
      organization_id: org3.id,
      status: "nouvelle",
    },
  ];

  // Vérifier les doublons
  const clientNames = testOrders.map((o) => o.client_name);
  const { data: existingOrders } = await supabase
    .from("orders")
    .select("client_name")
    .in("client_name", clientNames);

  const existingNames = new Set(existingOrders?.map((o) => o.client_name) || []);
  const toInsert = testOrders.filter((o) => !existingNames.has(o.client_name));

  for (const o of toInsert) {
    const { error } = await supabase.from("orders").insert({
      ...o,
      source: "Seed test",
      order_date: new Date().toISOString(),
    });
    if (!error) console.log(`  ✓ ${o.client_name} (${o.country})`);
  }

  if (toInsert.length === 0) {
    console.log("  ↳ Commandes déjà existantes, ignorées");
  }

  // --- 6. Résumé ---
  console.log("\n" + "=".repeat(50));
  console.log("🎉 DONNÉES DE TEST CRÉÉES !");
  console.log("=".repeat(50));

  for (const org of orgs) {
    const { count: teamCount } = await supabase
      .from("teams")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.id);

    const { count: userCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.id);

    const { count: orderCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.id);

    console.log(`\n  ${org.name}`);
    console.log(`    ${teamCount} équipe(s) · ${userCount} membre(s) · ${orderCount} commande(s)`);
  }

  console.log("\n📋 Identifiants de connexion :");
  console.log("  ┌──────────────────────┬──────────────────┬──────────────────┐");
  console.log("  │ Email                │ Mot de passe     │ Rôle             │");
  console.log("  ├──────────────────────┼──────────────────┼──────────────────┤");
  console.log("  │ clara@test.com       │ password123      │ Admin (Clara)    │");
  console.log("  │ abdou@test.com       │ password123      │ Closer (CI)      │");
  console.log("  │ fatou@test.com       │ password123      │ Closer (SN)      │");
  console.log("  ├──────────────────────┼──────────────────┼──────────────────┤");
  console.log("  │ modibo@test.com      │ password123      │ Admin (Tech)     │");
  console.log("  │ amadou@test.com      │ password123      │ Closer (Mali)    │");
  console.log("  │ mariam@test.com      │ password123      │ Closer (BF)      │");
  console.log("  ├──────────────────────┼──────────────────┼──────────────────┤");
  console.log("  │ jean@test.com        │ password123      │ Admin (Distrib)  │");
  console.log("  │ paul@test.com        │ password123      │ Closer (Cameroun)│");
  console.log("  │ sylvie@test.com      │ password123      │ Closer (Gabon)   │");
  console.log("  └──────────────────────┴──────────────────┴──────────────────┘");
  console.log("\n⚠️  N'oublie pas de promouvoir ton compte en super_admin :");
  console.log("  Dans Supabase SQL Editor :");
  console.log("  UPDATE profiles SET role = 'super_admin' WHERE email = 'TON_EMAIL';");
  console.log();
}

seed().catch(console.error);
