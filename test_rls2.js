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

function req(method, path, body, token) {
  return new Promise(r => {
    const opts = {hostname:"izlvbdrbnbjntimhobna.supabase.co",path,method,headers:{"Content-Type":"application/json",apikey:k,Authorization:"Bearer "+token}};
    const h = https.request(opts,res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>r({s:res.statusCode,b:d}))});
    if(body) h.write(JSON.stringify(body));
    h.end();
  });
}

async function main() {
  const a = await login();
  if(!a.access_token){console.log("FAIL");return;}
  const t = a.access_token;

  // 1. Check if pg_policies table returns anything via rpc
  let r = await req("POST", "/rest/v1/rpc/pgexecute", {query: "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename='sheets_config' ORDER BY policyname"}, t);
  console.log("pg_policies:", r.s, r.b);

  // 2. Try INSERT into sheets_config directly via RLS
  r = await req("POST", "/rest/v1/sheets_config", {
    name: "test rls",
    sheet_url: "https://docs.google.com/spreadsheets/d/test",
    sheet_gid: "0",
    country: "test",
    created_by: "e7d4f294-7a14-45eb-a2b8-a710ef2e97c9"
  }, t);
  console.log("insert:", r.s, r.b.substring(0,500));
}
main();
