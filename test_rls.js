const k = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6bHZiZHJibmJqbnRpbWhvYm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjQzMTIsImV4cCI6MjA5NzkwMDMxMn0.h9WPfvGob_CHY-VknU8Yfxl4bi5vj1L504UPcmLmoSs";
const https = require("https");

function login() {
  return new Promise(r => {
    const d1 = JSON.stringify({email:"admin@closerflow.com",password:"CloserFlow@2026!",gotrue_meta_security:{}});
    const req = https.request({hostname:"izlvbdrbnbjntimhobna.supabase.co",path:"/auth/v1/token?grant_type=password",method:"POST",headers:{"Content-Type":"application/json",apikey:k,"Content-Length":Buffer.byteLength(d1)}});
    req.on("response",res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>r(JSON.parse(d)))});
    req.write(d1);req.end();
  });
}

function get(path, token) {
  return new Promise(r => {
    const req = https.get({hostname:"izlvbdrbnbjntimhobna.supabase.co",path,headers:{apikey:k,Authorization:"Bearer "+token}},res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>r({s:res.statusCode,b:d}))});
    req.end();
  });
}

async function main() {
  const a = await login();
  if(!a.access_token){console.log("FAIL");return;}
  const t = a.access_token;

  // 1. sheets with no filter
  let r = await get("/rest/v1/sheets_config?select=id,name,country", t);
  console.log("sheets all:", r.s, r.b.substring(0,500));

  // 2. sheets by created_by filter
  r = await get("/rest/v1/sheets_config?select=id,name,country&created_by=eq.e7d4f294-7a14-45eb-a2b8-a710ef2e97c9", t);
  console.log("sheets by user:", r.s, r.b.substring(0,500));

  // 3. sheets with count
  r = await get("/rest/v1/sheets_config?select=id&limit=0", t);
  console.log("sheets count:", r.s, r.b.substring(0,200));

  // 4. What about orders count?
  r = await get("/rest/v1/orders?select=id&limit=0", t);
  console.log("orders count:", r.s, r.b.substring(0,500));
}
main();
