export const SPACE_ID = "openbmb/MiniCPM-V-4.7-Demo";
export const SPACE_URL = "https://openbmb-minicpm-v-4-7-demo.hf.space";
export const SPACE_MODEL = "MiniCPM-V-4.7-35B-A3B";

export interface SpaceMessage { role: "user" | "assistant"; content: string }
export interface SpaceFile {
  path: string; url: null; size: number; orig_name: string; mime_type: string;
  is_stream: false; meta: { _type: "gradio.FileData" };
}

export class SpaceError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

export function buildSpaceData(messages: SpaceMessage[], instructions: string, files: SpaceFile[] = []) {
  const latest = messages.at(-1);
  if (!latest || latest.role !== "user") throw new SpaceError("Falta una pregunta del usuario.", 400);
  const history: [string, string][] = [];
  let question = "";
  for (const message of messages.slice(0, -1).slice(-16)) {
    if (message.role === "user") question = message.content;
    else if (question) { history.push([question, message.content]); question = ""; }
  }
  // This public API has no system-role parameter; instructions are explicitly
  // embedded as context. All resulting actions still require trusted validation.
  const prompt = `${instructions}\n\nPregunta actual (datos del usuario):\n${latest.content}`;
  return [prompt, history, files, false, 2048, 0.4, 0.8, 100, 32, "Sampling", true, 2, "4x", null, null, "auto", null, SPACE_MODEL];
}

export function readSpaceCompletion(event: Record<string, any>): string | null {
  if (event.msg !== "process_completed") {
    if (event.msg === "queue_full") throw new SpaceError("MiniCPM tiene la cola llena. Inténtalo en unos minutos.", 429);
    if (event.msg === "unexpected_error") throw new SpaceError("MiniCPM no pudo completar la respuesta. Inténtalo de nuevo.");
    return null;
  }
  if (event.success !== true || event.output?.error) {
    // Upstream error details may include internal credentials. Never forward them.
    throw new SpaceError("El Space de MiniCPM no está disponible ahora. Inténtalo en unos minutos.");
  }
  const result = event.output?.data?.[0];
  const content = typeof result === "string" ? result : result?.content;
  if (typeof content !== "string" || !content.trim()) throw new SpaceError("MiniCPM devolvió una respuesta vacía. Inténtalo de nuevo.");
  return content.trim();
}

export async function consumeSpaceEvents(response: Response, eventId: string, signal?: AbortSignal) {
  const reader = response.body?.getReader();
  if (!reader) throw new SpaceError("No se pudo leer la respuesta de MiniCPM.");
  const decoder = new TextDecoder();
  let buffer = "";
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new SpaceError("MiniCPM tardó demasiado. Inténtalo de nuevo.", 504);
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      if (done && buffer.trim()) { lines.push(buffer); buffer = ""; }
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        let event: Record<string, any>;
        try { event = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (event.event_id && event.event_id !== eventId) continue;
        // Generating events are Gradio diffs, not complete response objects.
        // Wait for the authoritative complete object; the UI retains Thinking/typewriter.
        const result = readSpaceCompletion(event);
        if (result !== null) return result;
      }
      if (done) break;
    }
    throw new SpaceError("Se interrumpió la conexión con MiniCPM. Inténtalo de nuevo.");
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function isOwnedMediaUrl(url: string, backendUrl: string, userId: string) {
  try {
    const parsed = new URL(url);
    return parsed.origin === new URL(backendUrl).origin && !parsed.search && !parsed.hash &&
      parsed.pathname.startsWith(`/storage/v1/object/public/social-media/${userId}/chat/`) &&
      !decodeURIComponent(parsed.pathname).includes("..");
  } catch { return false; }
}

export async function uploadSpaceFile(url: string, name: string, signal: AbortSignal): Promise<SpaceFile> {
  // Callers MUST first validate this as the authenticated user's own stored media.
  const response = await fetch(url, { signal, redirect: "error" });
  if (!response.ok) { await response.body?.cancel(); throw new SpaceError("No se pudo leer el adjunto. Vuelve a subirlo.", 400); }
  const mime = (response.headers.get("content-type") ?? "").split(";")[0];
  if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
    await response.body?.cancel();
    throw new SpaceError("MiniCPM puede analizar imágenes y videos, pero no este tipo de archivo.", 400);
  }
  if (Number(response.headers.get("content-length")) > 40 * 1024 * 1024) {
    await response.body?.cancel(); throw new SpaceError("El adjunto supera los 40 MB.", 400);
  }
  const blob = await response.blob();
  if (blob.size > 40 * 1024 * 1024) throw new SpaceError("El adjunto supera los 40 MB.", 400);
  const safeName = name.replace(/[^\w.\-]/g, "_").slice(0, 120);
  const form = new FormData();
  form.append("files", blob, safeName);
  const upload = await fetch(`${SPACE_URL}/gradio_api/upload`, { method: "POST", body: form, signal });
  if (!upload.ok) { await upload.body?.cancel(); throw new SpaceError("MiniCPM no pudo recibir el adjunto. Inténtalo de nuevo."); }
  const paths = await upload.json();
  if (!Array.isArray(paths) || typeof paths[0] !== "string") throw new SpaceError("MiniCPM devolvió un adjunto inválido.");
  return { path: paths[0], url: null, size: blob.size, orig_name: safeName, mime_type: mime, is_stream: false, meta: { _type: "gradio.FileData" } };
}

export async function askMiniCPM(messages: SpaceMessage[], instructions: string, files: SpaceFile[] = [], signal = AbortSignal.timeout(95_000)) {
  const sessionHash = crypto.randomUUID();
  try {
    const response = await fetch(`${SPACE_URL}/gradio_api/queue/join`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({ data: buildSpaceData(messages, instructions, files), event_data: null, fn_index: 0, session_hash: sessionHash, trigger_id: null }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new SpaceError(response.status === 429 ? "MiniCPM está ocupado. Inténtalo en unos minutos." : "No se pudo conectar con el Space de MiniCPM.", response.status === 429 ? 429 : 503);
    }
    const submitted = await response.json();
    if (typeof submitted.event_id !== "string") throw new SpaceError("MiniCPM no aceptó la pregunta.");
    const events = await fetch(`${SPACE_URL}/gradio_api/queue/data?session_hash=${encodeURIComponent(sessionHash)}`, { signal });
    if (!events.ok) { await events.body?.cancel(); throw new SpaceError("No se pudo abrir la respuesta de MiniCPM."); }
    return await consumeSpaceEvents(events, submitted.event_id, signal);
  } catch (error) {
    if (error instanceof SpaceError) throw error;
    if (signal.aborted) throw new SpaceError("MiniCPM tardó demasiado. Inténtalo de nuevo.", 504);
    throw new SpaceError("Se perdió la conexión con el Space de MiniCPM. Inténtalo de nuevo.");
  }
}