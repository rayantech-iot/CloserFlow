import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseReady = !!(supabaseUrl && supabaseAnonKey);

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

function noopChain(): any {
  const fn: any = () => noopChain();
  return new Proxy(fn, {
    get: (_, prop) => {
      if (prop === "then") return (res: any) => Promise.resolve({ data: [], error: null }).then(res);
      return noopChain();
    },
  });
}

function buildFallback(): SupabaseClient {
  const noopAuth = {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: () => Promise.resolve({ error: new Error("Supabase non configuré") }),
    signOut: () => Promise.resolve({ error: null }),
    resetPasswordForEmail: () => Promise.resolve({ error: new Error("Supabase non configuré") }),
  };

  return new Proxy({} as any, {
    get: (_: any, prop: string) => {
      if (prop === "auth") return noopAuth;
      if (prop === "channel") return () => ({ subscribe: () => {}, unsubscribe: () => {} });
      if (prop === "removeChannel") return () => {};
      if (prop === "from") return () => noopChain();
      if (prop === "rpc") return () => Promise.resolve({ data: null, error: null });
      return () => Promise.resolve({ data: null, error: null });
    },
  }) as SupabaseClient;
}

export const supabase: SupabaseClient = getClient() || buildFallback();
