import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, RefreshCw, Check, Loader2, Search, Zap, Server, Eye, EyeOff, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tier = "free" | "limited" | "paid";

interface ProviderDef { key: string; label: string; hint: string }
interface Row {
  provider: string; label: string; api_key: string; base_url: string;
  model: string; enabled: boolean; is_active: boolean;
}
interface ModelInfo { id: string; name: string; tier: Tier; context: number | null; price: string }

const PROVIDERS: ProviderDef[] = [
  { key: "openrouter", label: "OpenRouter", hint: "openrouter.ai/keys — cientos de modelos, muchos GRATIS" },
  { key: "openai", label: "OpenAI", hint: "platform.openai.com/api-keys" },
  { key: "anthropic", label: "Anthropic (Claude)", hint: "console.anthropic.com" },
  { key: "google", label: "Google Gemini", hint: "aistudio.google.com/apikey — capa gratuita" },
  { key: "groq", label: "Groq", hint: "console.groq.com/keys — ultra rápido, capa gratuita" },
  { key: "mistral", label: "Mistral AI", hint: "console.mistral.ai" },
  { key: "deepseek", label: "DeepSeek", hint: "platform.deepseek.com" },
  { key: "together", label: "Together AI", hint: "api.together.xyz" },
  { key: "xai", label: "xAI (Grok)", hint: "console.x.ai" },
  { key: "cerebras", label: "Cerebras", hint: "cloud.cerebras.ai — capa gratuita" },
  { key: "huggingface", label: "Hugging Face", hint: "huggingface.co/settings/tokens — miles de modelos abiertos" },
];

const TIER_STYLE: Record<Tier, string> = {
  free: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  limited: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  paid: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};
const TIER_LABEL: Record<Tier, string> = { free: "GRATIS", limited: "LIMITADO", paid: "PAGO" };

const AiProvidersPanel = () => {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [open, setOpen] = useState<string | null>("openrouter");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<Record<string, ModelInfo[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<Tier | "all">("all");

  const load = async () => {
    const { data } = await supabase.from("ai_providers").select("*");
    const map: Record<string, Row> = {};
    (data ?? []).forEach((r: any) => { map[r.provider] = r; });
    setRows(map);
  };
  useEffect(() => { load(); }, []);

  const rowOf = (p: ProviderDef): Row =>
    rows[p.key] ?? { provider: p.key, label: p.label, api_key: "", base_url: "", model: "", enabled: false, is_active: false };

  const patch = (key: string, part: Partial<Row>) =>
    setRows((r) => ({ ...r, [key]: { ...rowOf(PROVIDERS.find((p) => p.key === key)!), ...r[key], ...part } }));

  const save = async (p: ProviderDef, extra: Partial<Row> = {}) => {
    const row = { ...rowOf(p), ...extra };
    setSaving(p.key);
    const { error } = await supabase.from("ai_providers").upsert({
      provider: p.key, label: p.label, api_key: row.api_key, base_url: row.base_url,
      model: row.model, enabled: row.enabled, is_active: row.is_active,
    }, { onConflict: "provider" });
    setSaving(null);
    if (error) { toast.error(error.message); return false; }
    await load();
    return true;
  };

  const activate = async (p: ProviderDef, model: string) => {
    const row = rowOf(p);
    if (!row.api_key) { toast.error("Primero pega tu API key"); return; }
    setSaving(p.key);
    await supabase.from("ai_providers").update({ is_active: false }).neq("provider", p.key);
    const { error } = await supabase.from("ai_providers").upsert({
      provider: p.key, label: p.label, api_key: row.api_key, base_url: row.base_url,
      model, enabled: true, is_active: true,
    }, { onConflict: "provider" });
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    await load();
    toast.success(`MAGAI ahora usa ${p.label} · ${model}`);
  };

  const fetchModels = async (p: ProviderDef) => {
    const row = rowOf(p);
    if (!row.api_key) { toast.error("Pega tu API key primero"); return; }
    setLoading(p.key);
    await save(p);
    const { data, error } = await supabase.functions.invoke("ai-models", {
      body: { provider: p.key, api_key: row.api_key, base_url: row.base_url },
    });
    setLoading(null);
    if (error || data?.error) { toast.error(data?.error ?? error?.message ?? "No se pudieron cargar los modelos"); return; }
    setModels((m) => ({ ...m, [p.key]: data.models as ModelInfo[] }));
    toast.success(`${data.count} modelos cargados de ${p.label}`);
  };

  const removeKey = async (p: ProviderDef) => {
    await supabase.from("ai_providers").delete().eq("provider", p.key);
    setModels((m) => ({ ...m, [p.key]: [] }));
    await load();
    toast.success(`Clave de ${p.label} eliminada`);
  };

  const activeRow = useMemo(() => Object.values(rows).find((r) => r.is_active && r.enabled), [rows]);

  const visibleModels = (key: string) => {
    const list = models[key] ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((m) =>
      (tierFilter === "all" || m.tier === tierFilter) &&
      (!q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    ).slice(0, 120);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Server size={16} className="text-primary" /> Motor de MAGAI
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {activeRow
            ? <>Activo: <span className="text-primary font-medium">{activeRow.label || activeRow.provider}</span> · <span className="font-mono">{activeRow.model}</span></>
            : "Sin proveedor propio: MAGAI usa el motor incluido por defecto."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar modelo…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
        {(["all", "free", "limited", "paid"] as const).map((t) => (
          <button key={t} onClick={() => setTierFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              tierFilter === t
                ? t === "all" ? "border-primary bg-primary/15 text-primary" : TIER_STYLE[t as Tier]
                : "border-border text-muted-foreground hover:text-foreground"
            }`}>
            {t === "all" ? "TODOS" : TIER_LABEL[t as Tier]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((p) => {
          const row = rowOf(p);
          const isOpen = open === p.key;
          return (
            <div key={p.key} className="rounded-2xl border border-border bg-background/60 overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : p.key)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors">
                <div className="w-9 h-9 rounded-xl magma-gradient flex items-center justify-center shrink-0">
                  <Zap size={16} className="text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{p.label}</span>
                    {row.is_active && row.enabled && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">ACTIVO</span>
                    )}
                    {row.api_key && !row.is_active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">clave guardada</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{row.model || p.hint}</p>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="p-3 space-y-3">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type={reveal[p.key] ? "text" : "password"}
                            value={row.api_key}
                            onChange={(e) => patch(p.key, { api_key: e.target.value })}
                            placeholder={`API key de ${p.label}`}
                            className="w-full pl-9 pr-9 py-2 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50 font-mono"
                          />
                          <button onClick={() => setReveal((r) => ({ ...r, [p.key]: !r[p.key] }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                            {reveal[p.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <button onClick={() => fetchModels(p)} disabled={loading === p.key}
                          className="px-3 rounded-xl magma-gradient text-primary-foreground text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                          {loading === p.key ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          Modelos
                        </button>
                        {row.api_key && (
                          <button onClick={() => removeKey(p)} className="px-3 rounded-xl bg-destructive/15 text-destructive">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <input
                        value={row.base_url}
                        onChange={(e) => patch(p.key, { base_url: e.target.value })}
                        onBlur={() => save(p)}
                        placeholder="Base URL personalizada (opcional)"
                        className="w-full px-3 py-2 rounded-xl bg-input border border-border text-foreground text-xs outline-none font-mono"
                      />

                      {(models[p.key]?.length ?? 0) > 0 ? (
                        <div className="max-h-64 overflow-y-auto scrollbar-magma space-y-1.5 pr-1">
                          {visibleModels(p.key).map((m) => (
                            <button key={m.id} onClick={() => activate(p, m.id)} disabled={saving === p.key}
                              className={`w-full flex items-center gap-2 p-2 rounded-xl border text-left transition-colors ${
                                row.model === m.id && row.is_active
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:bg-muted/50"
                              }`}>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${TIER_STYLE[m.tier]}`}>
                                {TIER_LABEL[m.tier]}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-xs font-medium text-foreground truncate">{m.name}</span>
                                <span className="block text-[10px] text-muted-foreground font-mono truncate">
                                  {m.id}{m.context ? ` · ${m.context.toLocaleString()} ctx` : ""}
                                </span>
                              </span>
                              {row.model === m.id && row.is_active && <Check size={14} className="text-primary shrink-0" />}
                            </button>
                          ))}
                          {visibleModels(p.key).length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-3">Ningún modelo coincide con el filtro.</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Pega tu clave y pulsa <strong>Modelos</strong> para ver los modelos GRATIS · LIMITADOS · PAGO.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AiProvidersPanel;
