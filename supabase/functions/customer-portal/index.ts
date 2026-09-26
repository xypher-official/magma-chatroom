import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data } = await sb.auth.getUser(token);
    if (!data.user?.email) throw new Error("Inicia sesión primero");
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: data.user.email, limit: 1 });
    if (!customers.data.length) throw new Error("No tienes una membresía todavía");
    const origin = req.headers.get("origin") ?? "https://magma-chatroom.lovable.app";
    const portal = await stripe.billingPortal.sessions.create({ customer: customers.data[0].id, return_url: `${origin}/plus` });
    return new Response(JSON.stringify({ url: portal.url }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[customer-portal]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
