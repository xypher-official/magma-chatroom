import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generates and verifies one-time email codes for users. Stores codes in
// public.email_verifications. If a Lovable email infra is available we should
// enqueue the code there; otherwise we return it in `dev_code` so it can be
// surfaced in a toast during development.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: corsHeaders });

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "not logged in" }), { status: 401, headers: corsHeaders });

  const admin = createClient(url, service);
  const body = await req.json().catch(() => ({}));
  const action = body.action as "send" | "verify";

  try {
    if (action === "send") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: "Correo inválido" }), { status: 400, headers: corsHeaders });
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 15 * 60_000).toISOString();
      await admin.from("email_verifications").insert({
        user_id: user.id, email, code, expires_at: expires,
      });
      await admin.from("profiles").update({ email, email_verified_at: null }).eq("user_id", user.id);

      // TODO: when email infra is configured, enqueue here instead of returning dev_code.
      return new Response(JSON.stringify({ ok: true, dev_code: code }), { headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    if (action === "verify") {
      const code = String(body.code ?? "").trim();
      // Fetch the most recent unconsumed codes for the user and match in JS.
      // This is tolerant to StrictMode double-inserts and trimming issues.
      const { data: rows } = await admin.from("email_verifications")
        .select("id, email, code, expires_at, consumed_at")
        .eq("user_id", user.id)
        .is("consumed_at", null)
        .order("created_at", { ascending: false }).limit(5);
      const row = (rows ?? []).find((r) => String(r.code).trim() === code);
      if (!row) {
        console.log("verify miss", { user: user.id, got: code, have: (rows ?? []).map(r => r.code) });
        return new Response(JSON.stringify({ error: "Código inválido" }), { status: 400, headers: corsHeaders });
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "Código expirado" }), { status: 400, headers: corsHeaders });
      }
      await admin.from("email_verifications").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
      await admin.from("profiles").update({ email: row.email, email_verified_at: new Date().toISOString() }).eq("user_id", user.id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    if (action === "challenge") {
      // Login second factor: produce a fresh code without showing existing email
      const { data: prof } = await admin.from("profiles")
        .select("email, email_verified_at").eq("user_id", user.id).maybeSingle();
      if (!prof?.email || !prof.email_verified_at) {
        return new Response(JSON.stringify({ required: false }), { headers: { ...corsHeaders, "content-type": "application/json" } });
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 15 * 60_000).toISOString();
      await admin.from("email_verifications").insert({
        user_id: user.id, email: prof.email, code, expires_at: expires,
      });
      return new Response(JSON.stringify({ required: true, hint: prof.email.replace(/(^.).+(@.+$)/, "$1***$2"), dev_code: code }),
        { headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});