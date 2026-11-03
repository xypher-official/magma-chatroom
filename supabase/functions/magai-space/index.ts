import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { askMiniCPM, isOwnedMediaUrl, uploadSpaceFile, SpaceError, SPACE_ID, SPACE_MODEL } from "../_shared/minicpm-space.ts";
import { MAGAI_SYSTEM } from "../_shared/magai-prompt.ts";

const Body = z.object({
  privacy_consent: z.literal(true),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]), content: z.string().min(1).max(24000),
    attachments: z.array(z.object({ url: z.string().url().max(2000), kind: z.enum(["image", "video", "audio", "file", "watch"]), name: z.string().max(255) })).max(6).optional(),
  })).min(1).max(120),
}).refine((body) => body.messages.at(-1)?.role === "user", "Falta una pregunta del usuario");

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const backendUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!backendUrl || !anonKey) throw new SpaceError("No se pudo iniciar el asistente.");
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Inicia sesión para usar MAGAI." }, 401);
    const client = createClient(backendUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: auth, error: authError } = await client.auth.getClaims(authorization.slice(7));
    if (authError || !auth?.claims?.sub) return json({ error: "Inicia sesión para usar MAGAI." }, 401);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Pregunta inválida o falta aceptar el aviso de privacidad." }, 400);
    const messages = parsed.data.messages;
    const latest = messages.at(-1);
    if (!latest) return json({ error: "Falta una pregunta." }, 400);
    const attachments = latest.attachments ?? [];
    if (attachments.some((a) => !isOwnedMediaUrl(a.url, backendUrl, auth.claims.sub))) return json({ error: "Solo puedes adjuntar tus propios archivos subidos." }, 400);
    const media = attachments.filter((a) => a.kind === "image" || a.kind === "video");
    if (media.filter((a) => a.kind === "video").length > 1 || (media.some((a) => a.kind === "video") && media.some((a) => a.kind === "image"))) {
      return json({ error: "MiniCPM acepta imágenes o un video por pregunta, no ambos a la vez." }, 400);
    }
    const cost = latest.content.length > 400 || attachments.length > 0 || messages.length > 9 ? 3 : 1;
    const { data: used, error: usageError } = await client.rpc("magai_consume", { _cost: cost });
    if (usageError) throw new SpaceError("No se pudo comprobar el uso del asistente.");
    if (used === -1) {
      const { data: blockedUntil } = await client.rpc("magai_blocked_until");
      return json({ error: "Uso intensivo detectado. MAGAI se pausa 24 horas.", blocked_until: blockedUntil }, 429);
    }
    const signal = AbortSignal.timeout(95_000);
    const files = await Promise.all(media.map((a) => uploadSpaceFile(a.url, a.name, signal)));
    const wire = messages.map((m) => ({ role: m.role, content: m.content }));
    const ignored = attachments.filter((a) => a.kind !== "image" && a.kind !== "video");
    wire[wire.length - 1].content += attachments.length ? `\nAdjuntos del usuario: ${JSON.stringify(attachments.map((a) => ({ name: a.name, url: a.url, kind: a.kind })))}` : "";
    const reply = await askMiniCPM(wire, MAGAI_SYSTEM + `\nFecha actual UTC: ${new Date().toISOString()}\n` +
      (ignored.length ? "Los adjuntos que no sean imagen o video NO se han leído. No afirmes haberlos analizado." : ""), files, signal);
    return json({ reply, used, provider: SPACE_ID, model: SPACE_MODEL });
  } catch (error) {
    if (error instanceof SpaceError) return json({ error: error.message }, error.status);
    return json({ error: "No se pudo completar la pregunta. Inténtalo de nuevo." }, 503);
  }
});