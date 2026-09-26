import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const PRODUCT_ID = "prod_VKfCNVN3MmYuzA";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data } = await sb.auth.getUser(token);
    const user = data.user;
    if (!user?.email) return json({ subscribed: false });
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (!customers.data.length) return json({ subscribed: false });
    const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 10 });
    const sub = subs.data.find((s) => s.items.data.some((i) => i.price.product === PRODUCT_ID));
    if (!sub) return json({ subscribed: false });
    const end = (sub as any).current_period_end ?? sub.items.data[0]?.current_period_end;
    return json({ subscribed: true, subscription_end: end ? new Date(end * 1000).toISOString() : null });
  } catch (e) {
    console.error("[check-subscription]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
