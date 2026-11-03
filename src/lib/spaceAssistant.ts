import { supabase } from "@/integrations/supabase/client";

export async function requestSpaceAssistant(name: "magai-space" | "admin-ai", messages: unknown[]) {
  const { data, error } = await supabase.functions.invoke(name, {
    body: { messages: messages.slice(-120), privacy_consent: true },
    signal: AbortSignal.timeout(125_000),
  });
  if (error) {
    const response = error.context;
    if (response instanceof Response) {
      const payload = await response.json().catch(() => null);
      if (typeof payload?.error === "string") throw new Error(payload.error);
    }
    throw new Error("No se pudo conectar con MiniCPM. Inténtalo de nuevo.");
  }
  if (data?.error) throw new Error(data.error);
  if (typeof data?.reply !== "string" || !data.reply.trim()) throw new Error("MiniCPM devolvió una respuesta vacía.");
  return data as { reply: string; used?: number; provider: string; model: string };
}