const https = require("https");
const srk = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6bHZiZHJibmJqbnRpbWhvYm5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMyNDMxMiwiZXhwIjoyMDk3OTAwMzEyfQ.Imk4UXQ2ROk3woOulXEaGJ5wZeq-OcWPguLOdyDlDB8";

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "izlvbdrbnbjntimhobna.supabase.co",
      path,
      method,
      headers: { apikey: srk, Authorization: `Bearer ${srk}`, "Content-Type": "application/json" },
    };
    const req = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Try to get columns via rpc/pgexecute
  let r = await request("POST", "/rest/v1/rpc/pgexecute", {
    query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' ORDER BY ordinal_position",
  });
  console.log("pgexecute:", r.status, r.body.substring(0, 3000));

  // Try the raw orders table to see all fields
  r = await request("GET", "/rest/v1/orders?select=id,created_at&limit=1", null);
  console.log("orders fields:", r.status, r.body.substring(0, 3000));
}

main();
