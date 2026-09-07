import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Tier = "free" | "limited" | "paid";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Default tier when a provider gives no pricing info.
const DEFAULT_TIER: Record<string, Tier> = {
  openrouter: "paid",
  openai: "paid",
  anthropic: "paid",
  google: "limited",
  groq: "limited",
  mistral: "limited",
  deepseek: "paid",
  together: "paid",
  xai: "paid",
  cerebras: "limited",
};

async function fetchModels(provider: string, apiKey: string, baseUrl: string) {
  const key = apiKey.trim();
  if (!key) throw new Error("Falta la API key");

  if (provider === "openrouter") {
    const r = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    return (d.data ?? []).map((m: any) => {
      const p = Number(m?.pricing?.prompt ?? 0);
      const c = Number(m?.pricing?.completion ?? 0);
      const free = String(m.id).endsWith(":free") || (p === 0 && c === 0);
      const tier: Tier = free ? "free" : "paid";
      return {
        id: m.id,
        name: m.name ?? m.id,
        tier,
        context: m.context_length ?? null,
        price: free ? "0" : `${p} / ${c} por token`,
      };
    });
  }

  if (provider === "google") {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    return (d.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: any) => {
        const id = String(m.name).replace(/^models\//, "");
        const tier: Tier = /flash|lite|gemma/i.test(id) ? "free" : "limited";
        return { id, name: m.displayName ?? id, tier, context: m.inputTokenLimit ?? null, price: "" };
      });
  }

  if (provider === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=200", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    return (d.data ?? []).map((m: any) => ({ id: m.id, name: m.display_name ?? m.id, tier: "paid" as Tier, context: null, price: "" }));
  }

  // OpenAI-compatible /models endpoints
  const bases: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    groq: "https://api.groq.com/openai/v1",
    mistral: "https://api.mistral.ai/v1",
    deepseek: "https://api.deepseek.com/v1",
    together: "https://api.together.xyz/v1",
    xai: "https://api.x.ai/v1",
    cerebras: "https://api.cerebras.ai/v1",
  };
  const base = (baseUrl || bases[provider] || "").replace(/\/+$/, "");
  if (!base) throw new Error(`Proveedor desconocido: ${provider}`);

  const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`${provider} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const list = Array.isArray(d) ? d : (d.data ?? d.models ?? []);
  return list.map((m: any) => {
    const id = m.id ?? m.name ?? String(m);
    const pricing = m.pricing ?? {};
    const hasPrice = Number(pricing.input ?? pricing.prompt ?? 0) > 0 || Number(pricing.output ?? pricing.completion ?? 0) > 0;
    let tier: Tier = DEFAULT_TIER[provider] ?? "paid";
    if (hasPrice) tier = "paid";
    else if (/free/i.test(String(id))) tier = "free";
    return {
      id,
      name: m.display_name ?? m.name ?? id,
      tier,
      context: m.context_length ?? m.context_window ?? null,
      price: hasPrice ? `${pricing.input ?? pricing.prompt} / ${pricing.output ?? pricing.completion}` : "",
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData } = await userClient.auth.getUser();
    const me = userData.user;
    if (!me) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const provider = String(body.provider ?? "").trim();
    if (!provider) return json({ error: "provider requerido" }, 400);

    let apiKey = String(body.api_key ?? "");
    let baseUrl = String(body.base_url ?? "");
    if (!apiKey) {
      // Only admins may read the stored provider keys.
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", me.id).eq("role", "admin").maybeSingle();
      if (!roleRow) return json({ error: "Pon tu propia API key" }, 403);
      const { data: row } = await admin.from("ai_providers").select("api_key, base_url").eq("provider", provider).maybeSingle();
      apiKey = row?.api_key ?? "";
      baseUrl = baseUrl || (row?.base_url ?? "");
    }


    const models = await fetchModels(provider, apiKey, baseUrl);
    models.sort((a: any, b: any) => {
      const order: Record<string, number> = { free: 0, limited: 1, paid: 2 };
      return (order[a.tier] - order[b.tier]) || String(a.id).localeCompare(String(b.id));
    });
    return json({ provider, count: models.length, models });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
