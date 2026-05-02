import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Sparkles, Upload, Crown, Shield, UserMinus, UserPlus, Settings as Cog, Trash2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";

type Role = "owner" | "moderator" | "member";

interface GroupInfo {
  id: string; name: string; description: string;
  avatar_initials: string; avatar_url?: string | null;
  owner_id: string; write_mode?: string;
}

interface Profile { user_id: string; display_name: string; avatar_initials: string; avatar_url?: string | null }

interface Props {
  group: GroupInfo;
  myUserId: string;
  myRole: Role | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted?: () => void;
}

const GroupManageDialog = ({ group, myUserId, myRole, onClose, onUpdated, onDeleted }: Props) => {
  const { t } = useI18n();
  const [name, setName] = useState(group.name);
  const [desc, setDesc] = useState(group.description ?? "");
  const [avatar, setAvatar] = useState<string | null>(group.avatar_url ?? null);
  const [writeMode, setWriteMode] = useState<"everyone" | "mods_only">((group.write_mode as any) ?? "everyone");
  const [members, setMembers] = useState<{ user_id: string; role: Role; profile?: Profile }[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOwner = myRole === "owner";
  const isMod = myRole === "owner" || myRole === "moderator";

  const loadMembers = async () => {
    const { data: mems } = await supabase.from("group_members").select("user_id").eq("group_id", group.id);
    if (!mems) return;
    const ids = mems.map((m) => (m as any).user_id);
    if (!ids.length) { setMembers([]); return; }
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, avatar_initials, avatar_url").in("user_id", ids),
      supabase.from("group_member_roles").select("user_id, role").eq("group_id", group.id),
    ]);
    const profMap: Record<string, Profile> = {};
    (profs as any[] ?? []).forEach((p) => { profMap[p.user_id] = p; });
    const roleMap: Record<string, Role> = {};
    (roles as any[] ?? []).forEach((r) => { roleMap[r.user_id] = r.role; });
    setMembers(ids.map((id) => ({ user_id: id, role: roleMap[id] ?? "member", profile: profMap[id] })));
  };
  useEffect(() => { loadMembers(); }, [group.id]);

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${myUserId}/group-${group.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatar(pub.publicUrl);
      toast.success("📸 OK");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };
  const generateAvatar = async () => {
    if (!aiPrompt.trim()) return;
    setGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: aiPrompt.trim(), purpose: "group", target_id: group.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAvatar(data.url);
      toast.success("✨ AI image ready");
    } catch (e: any) { toast.error(e.message); }
    finally { setGenLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    const newName = name.trim() || group.name;
    const { error } = await supabase.from("groups").update({
      name: newName, description: desc, avatar_initials: newName.slice(0, 2).toUpperCase(),
      avatar_url: avatar, write_mode: writeMode,
    }).eq("id", group.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("✅ " + t("common.save"));
    onUpdated();
  };

  const setRole = async (uid: string, role: Role) => {
    const { error } = await supabase.from("group_member_roles")
      .upsert({ group_id: group.id, user_id: uid, role }, { onConflict: "group_id,user_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("👑 " + role);
    loadMembers();
  };
  const kick = async (uid: string) => {
    if (!confirm(t("group.kick") + "?")) return;
    await supabase.from("group_members").delete().eq("group_id", group.id).eq("user_id", uid);
    await supabase.from("group_member_roles").delete().eq("group_id", group.id).eq("user_id", uid);
    loadMembers();
  };
  const deleteGroup = async () => {
    if (!confirm(t("group.confirmDelete"))) return;
    const { error } = await supabase.from("groups").delete().eq("id", group.id);
    if (error) { toast.error(error.message); return; }
    toast.success("🗑️");
    onDeleted?.(); onClose();
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.92, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.92, y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-card rounded-3xl border border-border overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-fuchsia-500/10 via-transparent to-primary/10">
            <div className="flex items-center gap-2">
              <Cog size={18} className="text-primary" />
              <h2 className="font-bold magma-gradient-text text-lg">{t("group.manage")}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
          </div>

          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-magma">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-700 p-0.5 overflow-hidden shrink-0">
                <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center text-2xl font-bold text-fuchsia-300 overflow-hidden">
                  {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (group.avatar_initials)}
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("group.avatar")}</p>
                <button disabled={!isMod || uploading} onClick={() => fileRef.current?.click()}
                  className="w-full px-3 py-2 rounded-xl bg-muted hover:bg-muted/70 text-foreground text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                  <Upload size={13} /> {uploading ? "…" : t("settings.uploadAvatar")}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
              </div>
            </div>

            {isMod && (
              <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-amber-500/10 border border-fuchsia-500/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles size={14} className="text-amber-400" /> {t("ai.generateImage")}
                </div>
                <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={t("ai.imagePrompt")}
                  className="w-full px-3 py-2.5 rounded-xl bg-background/60 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                <button onClick={generateAvatar} disabled={genLoading || !aiPrompt.trim()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  <ImageIcon size={14} /> {genLoading ? t("settings.generating") : t("settings.generateAvatar")}
                </button>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">{t("group.name")}</label>
              <input disabled={!isMod} value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">{t("group.desc")}</label>
              <textarea disabled={!isMod} value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
                className="mt-1.5 w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 resize-none" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t("group.writeMode")}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["everyone", "mods_only"] as const).map((m) => (
                  <button key={m} disabled={!isMod} onClick={() => setWriteMode(m)}
                    className={`px-3 py-3 rounded-xl border text-xs font-medium transition-all disabled:opacity-60 ${
                      writeMode === m ? "border-primary bg-primary/10 magma-glow-sm" : "border-border bg-muted/30 hover:bg-muted/60"
                    }`}>
                    {m === "everyone" ? t("group.writeEveryone") : t("group.writeMods")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users size={12} /> {t("group.members")} · {members.length}
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-magma rounded-xl">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/30">
                    <div className="w-9 h-9 rounded-full magma-gradient flex items-center justify-center text-xs font-bold text-primary-foreground overflow-hidden">
                      {m.profile?.avatar_url ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.profile?.avatar_initials ?? "??")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.profile?.display_name ?? "?"}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                        {m.role === "owner" && <Crown size={10} className="text-amber-400" />}
                        {m.role === "moderator" && <Shield size={10} className="text-sky-400" />}
                        {m.role === "owner" ? t("group.owner") : m.role === "moderator" ? t("group.moderator") : t("group.member")}
                      </p>
                    </div>
                    {isOwner && m.user_id !== group.owner_id && (
                      <div className="flex gap-1">
                        {m.role !== "moderator" ? (
                          <button onClick={() => setRole(m.user_id, "moderator")}
                            title={t("group.makeMod")} className="p-1.5 rounded-lg hover:bg-sky-500/20 text-sky-400">
                            <Shield size={14} />
                          </button>
                        ) : (
                          <button onClick={() => setRole(m.user_id, "member")}
                            title={t("group.removeMod")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                            <UserPlus size={14} />
                          </button>
                        )}
                        <button onClick={() => kick(m.user_id)} title={t("group.kick")}
                          className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive">
                          <UserMinus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 flex gap-2">
            {isOwner && (
              <button onClick={deleteGroup}
                className="px-4 py-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium text-sm flex items-center gap-2">
                <Trash2 size={14} /> {t("group.delete")}
              </button>
            )}
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              onClick={save} disabled={saving || !isMod}
              className="flex-1 py-3 rounded-xl magma-gradient text-primary-foreground font-semibold magma-glow-sm disabled:opacity-60">
              {saving ? t("settings.saving") : t("common.save")}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GroupManageDialog;
