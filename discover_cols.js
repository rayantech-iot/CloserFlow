const https = require("https");

async function login() {
  const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6bHZiZHJibmJqbnRpbWhvYm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjQzMTIsImV4cCI6MjA5NzkwMDMxMn0.h9WPfvGob_CHY-VknU8Yfxl4bi5vj1L504UPcmLmoSs";
  return new Promise((resolve) => {
    const d1 = JSON.stringify({ email: "admin@closerflow.com", password: "CloserFlow@2026!", gotrue_meta_security: {} });
    const req = https.request(
      { hostname: "izlvbdrbnbjntimhobna.supabase.co", path: "/auth/v1/token?grant_type=password", method: "POST",
        headers: { "Content-Type": "application/json", apikey: anon, "Content-Length": Buffer.byteLength(d1) } },
      (res) => { let d = ""; res.on("data", (c) => d += c); res.on("end", () => resolve(JSON.parse(d))); }
    );
    req.write(d1);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve) => {
    const req = https.get(
      { hostname: "izlvbdrbnbjntimhobna.supabase.co", path, headers: { apikey: token, Authorization: `Bearer ${token}` } },
      (res) => { let d = ""; res.on("data", (c) => d += c); res.on("end", () => resolve({ status: res.statusCode, body: d })); }
    );
    req.end();
  });
}

async function main() {
  const auth = await login();
  const token = auth.access_token;
  if (!token) { console.log("Auth failed:", auth); return; }

  // Try various column combos
  const tests = [
    "id",
    "id,created_at",
    "id,order_number",
    "id,reference",
    "id,name",
    "id,customer",
    "id,client",
    "id,status",
    "id,amount",
    "id,total",
    "id,country",
    "id,team_id",
    "id,assigned_to",
    "id,user_id",
  ];
  for (const cols of tests) {
    const r = await get(`/rest/v1/orders?select=${cols}&limit=1`, token);
    if (r.status === 200) {
      console.log(`OK: ${cols} => ${r.body.substring(0, 200)}`);
    } else {
      console.log(`FAIL: ${cols} => ${r.body.substring(0, 150)}`);
    }
  }
}
main();
