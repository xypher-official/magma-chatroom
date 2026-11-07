import { sendPush } from "@/lib/push";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, Users, Settings as Cog, Sparkles, Image as ImageIcon, X, Lock, Smile, Pencil, Trash2, Check, Hash, Plus, Maximize2, Paperclip, FileText } from "lucide-react";
import AttachmentPicker from "./AttachmentPicker";
import WatchInviteCard from "./WatchInviteCard";
import GroupCallOverlay from "./GroupCallOverlay";
import { useGroupCall, GROUP_CALL_MAX } from "@/hooks/useGroupCall";
import { Phone, Video as VideoIcon } from "lucide-react";
import { useMyWallpaper } from "@/hooks/useMyWallpaper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Badges from "./Badges";
import { useI18n } from "@/hooks/useI18n";
import EmojiPickerPopover from "./EmojiPickerPopover";
import VoiceRecorder from "./VoiceRecorder";
import VoiceMessageBubble from "./VoiceMessageBubble";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import { useTyping } from "@/hooks/useTyping";
import TypingIndicator from "./TypingIndicator";
import ExpandedComposer from "./ExpandedComposer";

const TranslatedGroupText = ({ text }: { text: string }) => {
  const translated = useAutoTranslate(text);
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words px-1">{translated || text}</p>
  );
};

interface GroupMsg { id: string; group_id: string; sender_id: string; content: string; is_system: boolean; created_at: string; media_url?: string | null; media_type?: string | null; edited_at?: string | null; deleted_at?: string | null; channel_id?: string | null }
interface Channel { id: string; group_id: string; name: string; position: number }
interface GroupInfo { id: string; name: string; description: string; avatar_initials: string; avatar_url?: string | null; owner_id: string; write_mode?: string }
interface Profile { user_id: string; display_name: string; is_verified: boolean; is_official: boolean; avatar_url?: string | null }
type Role = "owner" | "moderator" | "member";

interface Props {
  group: GroupInfo;
  myUserId: string;
  isAdmin: boolean;
  profiles: Record<string, Profile>;
  onBack?: () => void;
  onOpenManage?: () => void;
  onMyRoleResolved?: (role: Role | null) => void;
}

const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const GroupChatWindow = ({ group, myUserId, isAdmin, profiles, onBack, onOpenManage, onMyRoleResolved }: Props) => {
  const { t } = useI18n();
  const wallStyle = useMyWallpaper();
  const [messages, setMessages] = useState<GroupMsg[]>([]);
  const [input, setInput] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const gcall = useGroupCall(group.id, myUserId);
  const startGroupCall = async (withVideo: boolean) => {
    const started = await gcall.join(withVideo);
    if (started) await send(null, null, `📞 ${profiles[myUserId]?.display_name ?? "Someone"} started a group ${withVideo ? "video " : ""}call`);
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [showChannels, setShowChannels] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typingKey = activeChannel ? `grp-${group.id}-${activeChannel}` : `grp-${group.id}`;
  const myName = profiles[myUserId]?.display_name;
  const { typing, sendTyping } = useTyping(typingKey, myUserId, myName);

  useEffect(() => {
    supabase.from("group_messages").select("*").eq("group_id", group.id).order("created_at", { ascending: true })
      .then(({ data }) => data && setMessages(data as GroupMsg[]));
    supabase.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", group.id)
      .then(({ count }) => setMemberCount(count ?? 0));
    supabase.from("group_member_roles").select("role").eq("group_id", group.id).eq("user_id", myUserId).maybeSingle()
      .then(({ data }) => { const r = (data as any)?.role ?? null; setMyRole(r); onMyRoleResolved?.(r); });
    const loadChannels = () => (supabase.from("group_channels" as any) as any).select("*").eq("group_id", group.id).order("position").order("created_at")
      .then(({ data }) => {
        const list = ((data as unknown) as Channel[]) ?? [];
        setChannels(list);
        setActiveChannel((cur) => cur && list.some(c => c.id === cur) ? cur : (list[0]?.id ?? null));
      });
    loadChannels();
    const ch = supabase.channel(`group-${group.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        (p) => setMessages((prev) => prev.some((m) => m.id === (p.new as any).id) ? prev : [...prev, p.new as GroupMsg]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        (p) => setMessages((prev) => prev.map((m) => m.id === (p.new as any).id ? (p.new as GroupMsg) : m)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        (p) => setMessages((prev) => prev.filter((m) => m.id !== (p.old as any).id)))
      .on("postgres_changes", { event: "*", schema: "public", table: "group_channels", filter: `group_id=eq.${group.id}` }, loadChannels)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [group.id, myUserId, onMyRoleResolved]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const writeMode = (group.write_mode as "everyone" | "mods_only") ?? "everyone";
  const canWrite = isAdmin || writeMode === "everyone" || myRole === "owner" || myRole === "moderator";

  const send = async (mediaUrl?: string | null, mediaType?: string | null, contentOverride?: string) => {
    const content = contentOverride ?? input.trim();
    if (!content && !mediaUrl) return;
    if (!canWrite) { toast.error(t("group.cantWrite")); return; }
    const { data: sent, error } = await supabase.from("group_messages").insert({
      group_id: group.id, sender_id: myUserId, content,
      media_url: mediaUrl ?? null, media_type: mediaType ?? null,
      channel_id: activeChannel,
    } as any).select("id").single();
    if (!error && sent) sendPush("group", (sent as any).id);
    if (error) toast.error(error.message); else {
      await supabase.from("groups").update({ last_message_at: new Date().toISOString() }).eq("id", group.id);
      if (!contentOverride) setInput("");
    }
  };

  const generateAndSend = async () => {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: aiPrompt.trim(), purpose: "chat" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await send(data.url, "image", `🎨 ${aiPrompt.trim()}`);
      setAiPrompt(""); setShowAi(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setAiBusy(false); }
  };

  const deleteMsg = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("group_messages")
      .update({ deleted_at: new Date().toISOString(), content: "", media_url: null, media_type: null } as any)
      .eq("id", id);
    if (error) toast.error(error.message);
  };
  const saveEdit = async (id: string) => {
    const next = editingText.trim();
    if (!next) { setEditingId(null); return; }
    const { error } = await supabase.from("group_messages")
      .update({ content: next, edited_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) toast.error(error.message);
    setEditingId(null);
  };

  const canManageChannels = isAdmin || myRole === "owner" || myRole === "moderator";
  const createChannel = async () => {
    const name = prompt("Channel name (a-z, 0-9, -)")?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!name) return;
    const { error } = await supabase.from("group_channels" as any).insert({ group_id: group.id, name, position: channels.length });
    if (error) toast.error(error.message);
  };
  const renameChannel = async (c: Channel) => {
    const name = prompt("Rename channel", c.name)?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!name || name === c.name) return;
    const { error } = await supabase.from("group_channels" as any).update({ name }).eq("id", c.id);
    if (error) toast.error(error.message);
  };
  const deleteChannel = async (c: Channel) => {
    if (channels.length <= 1) { toast.error("Group needs at least one channel"); return; }
    if (!confirm(`Delete #${c.name}? Messages will remain but become orphaned.`)) return;
    const { error } = await supabase.from("group_channels" as any).delete().eq("id", c.id);
    if (error) toast.error(error.message);
  };

  const visibleMessages = messages.filter((m) => activeChannel ? m.channel_id === activeChannel : !m.channel_id);
  const activeChannelName = channels.find(c => c.id === activeChannel)?.name ?? "general";

  return (
    <div className="h-full flex bg-background">
      {/* Channels sidebar (Discord-style) */}
      <AnimatePresence>
        {showChannels && (
          <motion.aside initial={{ x: -240, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -240, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="w-56 flex-shrink-0 border-r border-border glass-panel-strong flex flex-col">
            <div className="px-3 py-3 border-b border-border flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Channels</p>
              {canManageChannels && (
                <button onClick={createChannel} className="p-1 rounded hover:bg-primary/15 text-primary"><Plus size={14}/></button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-magma p-2 space-y-0.5">
              {channels.map((c) => (
                <div key={c.id} className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${activeChannel === c.id ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
                  onClick={() => setActiveChannel(c.id)}>
                  <Hash size={14} className="opacity-70 flex-shrink-0" />
                  <span className="truncate flex-1">{c.name}</span>
                  {canManageChannels && (
                    <div className="hidden group-hover:flex gap-0.5">
                      <button onClick={(e) => { e.stopPropagation(); renameChannel(c); }} className="p-0.5 hover:text-primary"><Pencil size={11}/></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteChannel(c); }} className="p-0.5 hover:text-destructive"><Trash2 size={11}/></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="h-full flex flex-col flex-1 min-w-0">
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="px-4 py-3 flex items-center gap-3 border-b border-border glass-panel">
        {onBack && (
          <button onClick={onBack} className="p-1 rounded-lg hover:bg-muted text-muted-foreground md:hidden"><ArrowLeft size={20} /></button>
        )}
        <button onClick={() => setShowChannels(v => !v)} title="Channels"
          className={`p-1.5 rounded-lg transition-colors ${showChannels ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary"}`}>
          <Hash size={18} />
        </button>
        <button onClick={onOpenManage} className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-90 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
            {group.avatar_url ? <img src={group.avatar_url} alt="" className="w-full h-full object-cover" /> : group.avatar_initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate flex items-center gap-1.5">{group.name}
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-0.5"><Hash size={10}/>{activeChannelName}</span>
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users size={11} /> {memberCount} {t("group.members").toLowerCase()}
            </p>
          </div>
        </button>
        <button onClick={() => startGroupCall(false)} title="Llamada grupal" disabled={gcall.joined}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Phone size={18} /></button>
        <button onClick={() => startGroupCall(true)} title="Videollamada grupal" disabled={gcall.joined}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><VideoIcon size={18} /></button>
        {(isAdmin || myRole === "owner" || myRole === "moderator" || myRole === "member") && (
          <button onClick={onOpenManage} title={t("group.manage")}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
            <Cog size={18} />
          </button>
        )}
      </motion.div>

      {gcall.participants.length > 0 && !gcall.joined && (
        <button onClick={() => gcall.join(true)}
          className="mx-3 mt-2 flex items-center gap-2 rounded-xl magma-gradient px-3 py-2 text-xs font-semibold text-primary-foreground">
          <Phone size={14} /> Llamada grupal activa ({gcall.participants.length}/{GROUP_CALL_MAX}) — Toca para unirte
        </button>
      )}
      {gcall.joined && (
        <GroupCallOverlay title={group.name} me={myUserId}
          names={Object.fromEntries(Object.values(profiles).map((x) => [x.user_id, x.display_name]))}
          localStream={gcall.localStream} peers={gcall.peers} video={gcall.video} muted={gcall.muted} cameraOff={gcall.cameraOff}
          onMute={gcall.toggleMute} onCamera={gcall.toggleCamera} onFlip={gcall.flipCamera} onLeave={gcall.leave} />
      )}
      <div className={`flex-1 overflow-y-auto scrollbar-magma p-4 space-y-3 ${wallStyle ? "" : "ember-bg"}`} style={wallStyle}>
        <AnimatePresence initial={false}>
          {visibleMessages.map((msg) => {
            const isOwn = msg.sender_id === myUserId;
            const sender = profiles[msg.sender_id];
            const isDeleted = !!msg.deleted_at;
            const hasImage = !isDeleted && msg.media_url && msg.media_type?.startsWith("image");
            const hasAudio = !isDeleted && msg.media_url && msg.media_type === "audio";
            const isEditing = editingId === msg.id;
            const canEditDelete = isOwn || isAdmin || myRole === "owner" || myRole === "moderator";
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`group relative max-w-[75%] px-3 py-2 rounded-2xl overflow-hidden ${isDeleted ? "bg-muted/40 text-muted-foreground italic border border-border rounded-bl-md" : isOwn ? "magma-gradient text-primary-foreground rounded-br-md magma-glow-sm" : "glass-panel-strong text-foreground rounded-bl-md"}`}>
                  {!isDeleted && canEditDelete && (
                    <div className="absolute -top-2 -right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                      {isOwn && !msg.media_url && (
                        <button onClick={() => { setEditingId(msg.id); setEditingText(msg.content); }}
                          className="bg-primary text-primary-foreground rounded-full p-1 shadow-lg"><Pencil size={11}/></button>
                      )}
                      <button onClick={() => deleteMsg(msg.id)} className="bg-destructive text-destructive-foreground rounded-full p-1 shadow-lg">
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  )}
                  {!isOwn && (
                    <p className="text-xs font-semibold mb-1 px-1 text-fuchsia-400 flex items-center">
                      <span>{sender?.display_name ?? "?"}</span>
                      <Badges isVerified={sender?.is_verified} isOfficial={sender?.is_official} size={11} />
                    </p>
                  )}
                  {isDeleted ? (
                    <p className="text-sm px-1 italic">🔏 This Message Was Eliminated</p>
                  ) : (<>
                  {hasImage && (
                    <img src={msg.media_url!} alt="" className="rounded-xl mb-1 max-h-72 w-full object-cover" loading="lazy" />
                  )}
                  {hasAudio && <VoiceMessageBubble url={msg.media_url!} isOwn={isOwn} />}
                  {!isDeleted && msg.media_url && msg.media_type?.startsWith("video") && (
                    <video src={msg.media_url} controls className="rounded-xl mb-1 max-h-72 w-full" />
                  )}
                  {!isDeleted && msg.media_type === "watch" && msg.media_url && (
                    <WatchInviteCard url={msg.media_url} isOwn={isOwn} />
                  )}
                  {!isDeleted && msg.media_url && msg.media_type === "file" && (
                    <a href={msg.media_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 mb-1 px-2 py-2 rounded-xl bg-background/25 text-xs underline">
                      <FileText size={14} /> Abrir archivo
                    </a>
                  )}
                  {isEditing ? (
                    <div className="flex gap-1 items-center min-w-[180px]">
                      <input autoFocus value={editingText} onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(msg.id); if (e.key === "Escape") setEditingId(null); }}
                        className="flex-1 px-2 py-1 rounded-md bg-background/70 text-foreground text-sm outline-none ring-1 ring-primary/40" />
                      <button onClick={() => saveEdit(msg.id)} className="p-1 rounded-md bg-primary text-primary-foreground"><Check size={12}/></button>
                      <button onClick={() => setEditingId(null)} className="p-1 rounded-md hover:bg-muted"><X size={12}/></button>
                    </div>
                  ) : msg.content && (
                    <TranslatedGroupText text={msg.content} />
                  )}
                  </>)}
                  <p className={`text-[10px] mt-1 px-1 text-right ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {msg.edited_at && !isDeleted && <span className="opacity-70 mr-1 italic">Editado ·</span>}{fmt(msg.created_at)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
      <TypingIndicator names={typing.map((t) => t.name)} />

      <AnimatePresence>
        {showAi && canWrite && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="px-3 pt-3 border-t border-border bg-gradient-to-r from-fuchsia-500/10 to-amber-500/10">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateAndSend()}
                placeholder={t("ai.imagePrompt")}
                className="flex-1 px-3 py-2 rounded-xl bg-background/60 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <button onClick={generateAndSend} disabled={aiBusy || !aiPrompt.trim()}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white text-xs font-semibold disabled:opacity-50">
                {aiBusy ? "…" : t("ai.send")}
              </button>
              <button onClick={() => setShowAi(false)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 border-t border-border glass-panel">
        {!canWrite ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Lock size={14} /> {t("group.cantWrite")}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2 relative">
            <EmojiPickerPopover open={showEmoji} onClose={() => setShowEmoji(false)}
              onPick={(e) => setInput((v) => v + e)} />
            {/* Mobile: tools hidden behind "+" */}
            <div className="md:hidden">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setShowTools((v) => !v)} title="Más opciones"
                className={`p-2 rounded-lg transition-colors ${showTools ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary"}`}>
                <Plus size={20} />
              </motion.button>
            </div>
            <div className={`${showTools ? "flex" : "hidden"} md:flex items-center gap-1.5 sm:gap-2 absolute md:static bottom-full left-0 mb-2 p-2 md:p-0 rounded-xl md:rounded-none glass-panel md:bg-transparent md:border-0 md:shadow-none z-20`}>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setShowAi((v) => !v)} title={t("ai.generateImage")}
                className={`p-2 rounded-lg transition-colors ${showAi ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary"}`}>
                <ImageIcon size={20} />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setShowEmoji((v) => !v)} title="Emoji"
                className={`p-2 rounded-lg transition-colors ${showEmoji ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary"}`}>
                <Smile size={20} />
              </motion.button>
              <VoiceRecorder myUserId={myUserId}
                onSent={(url, type, dur) => send(url, type, `🎙️ ${dur}s`)} />
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setShowAttach(true)} title="Adjuntar"
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Plus size={20} />
              </motion.button>
            </div>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
              onInput={sendTyping}
              placeholder={t("chat.placeholder")}
              className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30" />
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => setShowExpanded(true)} title="Expandir el cuadro de texto"
              className="hidden md:block p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
              <Maximize2 size={18} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => send()} disabled={!input.trim()}
              className="p-2.5 rounded-xl magma-gradient text-primary-foreground disabled:opacity-40 magma-glow-sm flex-shrink-0">
              <Send size={18} />
            </motion.button>
          </div>
        )}
      </div>
      <ExpandedComposer open={showExpanded} value={input}
        onChange={(v) => { setInput(v); sendTyping(); }}
        onClose={() => setShowExpanded(false)}
        onSend={() => { send(); setShowExpanded(false); }}
        placeholder={t("chat.placeholder")} title={`${group.name} · #${activeChannelName}`} />
      <AttachmentPicker groupId={group.id} open={showAttach} onClose={() => setShowAttach(false)} myUserId={myUserId}
        onSend={(text, url, kind) => send(url, kind, text)} />
      </div>
    </div>
  );
};

export default GroupChatWindow;
