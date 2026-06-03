import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Batch-translates an array of short strings into a target language using the
// Lovable AI Gateway (Gemini). Returns { translations: string[] } in the same
// order. Safe for chat messages and short UI strings.

const LANG_NAME: Record<string, string> = {
  es: "Spanish", en: "English", de: "German", it: "Italian", fr: "French", pt: "Portuguese",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const { texts, target } = await req.json();
    if (!Array.isArray(texts) || !texts.length) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const targetName = LANG_NAME[String(target)] ?? "English";
    const numbered = texts.map((t: string, i: number) => `[${i + 1}] ${String(t).replace(/\n/g, " \\n ")}`).join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content:
            `You are a professional translator. Translate every numbered line into ${targetName}. ` +
            `Keep emojis, URLs, @mentions, #tags, numbers and code intact. ` +
            `If a line is already in ${targetName}, return it unchanged. ` +
            `Reply ONLY with the same numbered list, one per line, nothing else. ` +
            `Convert " \\n " back to a real newline within the same line.` },
          { role: "user", content: numbered },
        ],
        temperature: 0,
      }),
    });
    if (resp.status === 429 || resp.status === 402) {
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("LAI error", resp.status, errText);
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const map = new Map<number, string>();
    for (const line of lines) {
      const m = line.match(/^\[(\d+)\]\s*(.*)$/);
      if (m) map.set(Number(m[1]) - 1, m[2].replace(/ \\n /g, "\n"));
    }
    const translations = texts.map((t: string, i: number) => map.get(i) ?? t);
    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    console.error("translate error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});