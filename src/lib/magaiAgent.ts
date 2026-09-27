import { supabase } from "@/integrations/supabase/client";

export const AGENT_PROMPT = `

MODO AGENTE (solo miembros ChatRoom Plus): puedes ejecutar acciones en la cuenta del usuario. Cuando el usuario te pida cambiar algo o enviar/programar un mensaje, incluye al FINAL de tu respuesta uno o varios bloques exactamente así:
\`\`\`magma-action
{"type":"update_profile","display_name":"Nuevo nombre","bio":"...","avatar_url":"https://...","wallpaper_url":"linear-gradient(...)","bubble_color":"#ff6a00"}
\`\`\`
\`\`\`magma-action
{"type":"send_message","to":"username","content":"Hola","send_at":"2026-09-28T15:00:00Z"}
\`\`\`
Incluye solo los campos que cambian. "send_at" es opcional (ISO UTC); sin él se envía ya. Si el usuario adjunta una imagen para foto o fondo, usa su URL. Nunca inventes usernames: si falta, pregunta.`;

const RE = /```magma-action\s*([\s\S]*?)```/g;

export function stripActions(text: string) {
  return text.replace(RE, "").trim();
}

export async function runActions(text: string): Promise<string[]> {
  const out: string[] = [];
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return ["⚠️ Inicia sesión para usar el agente"];
  for (const m of text.matchAll(RE)) {
    let a: any;
    try { a = JSON.parse(m[1]); } catch { out.push("⚠️ Acción inválida"); continue; }
    try {
      if (a.type === "update_profile") {
        const patch: Record<string, any> = {};
        for (const k of ["display_name", "bio", "avatar_url", "wallpaper_url", "bubble_color"]) {
          if (typeof a[k] === "string") patch[k] = a[k].slice(0, 2000);
        }
        if (patch.display_name) patch.display_name = patch.display_name.slice(0, 50);
        if (!Object.keys(patch).length) continue;
        const { error } = await supabase.from("profiles").update(patch as any).eq("user_id", uid);
        if (error) throw error;
        out.push(`✅ Perfil actualizado (${Object.keys(patch).join(", ")})`);
      } else if (a.type === "send_message") {
        const uname = String(a.to ?? "").replace(/^@/, "").trim();
        const content = String(a.content ?? "").slice(0, 4000);
        if (!uname || !content) throw new Error("Falta destinatario o texto");
        const { data: p } = await supabase.from("profiles").select("user_id,display_name").ilike("username", uname).maybeSingle();
        if (!p) throw new Error(`No existe @${uname}`);
        const sendAt = a.send_at ? new Date(a.send_at) : null;
        if (sendAt && !isNaN(+sendAt) && +sendAt > Date.now() + 30_000) {
          const { error } = await supabase.from("scheduled_messages").insert({
            sender_id: uid, recipient_id: p.user_id, content, send_at: sendAt.toISOString(),
          });
          if (error) throw error;
          out.push(`🕒 Mensaje programado a ${p.display_name} para ${sendAt.toLocaleString()}`);
        } else {
          const [a1, b1] = [uid, p.user_id].sort();
          let { data: conv } = await supabase.from("conversations").select("id")
            .or(`and(user_a.eq.${uid},user_b.eq.${p.user_id}),and(user_a.eq.${p.user_id},user_b.eq.${uid})`).maybeSingle();
          if (!conv) {
            const r = await supabase.from("conversations").insert({ user_a: a1, user_b: b1 }).select("id").single();
            if (r.error) throw r.error;
            conv = r.data;
          }
          const { error } = await supabase.from("messages").insert({ conversation_id: conv!.id, sender_id: uid, content });
          if (error) throw error;
          out.push(`📨 Mensaje enviado a ${p.display_name}`);
        }
      }
    } catch (e: any) {
      out.push(`⚠️ ${e.message ?? "Error"}`);
    }
  }
  return out;
}
