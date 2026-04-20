import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, MessageCircle, Send, Image as ImageIcon, Video, Trash2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LavaParticles from "@/components/LavaParticles";
import Badges from "@/components/Badges";
import { useMuteStatus } from "@/hooks/useMuteStatus";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Post {
  id: string; author_id: string; title: string; content: string;
  media_url: string | null; media_type: "image" | "video" | null;
  likes_count: number; comments_count: number; created_at: string;
}
interface Profile { user_id: string; display_name: string; username: string; avatar_initials: string; is_verified: boolean; is_official: boolean }

const Social = () => {
  const nav = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);

  // Composer
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const myId = session?.user?.id ?? null;
  const { isMuted, mutedUntil } = useMuteStatus(myId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadPosts = useCallback(async () => {
    const { data } = await supabase.from("social_posts").select("*").order("created_at", { ascending: false }).limit(50);
    setPosts((data ?? []) as Post[]);
    const ids = Array.from(new Set((data ?? []).map((p: any) => p.author_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,display_name,username,avatar_initials,is_verified,is_official").in("user_id", ids);
      const map: Record<string, Profile> = {};
      for (const p of profs ?? []) map[p.user_id] = p as Profile;
      setProfiles(map);
    }
  }, []);

  const loadLikes = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase.from("social_likes").select("post_id").eq("user_id", myId);
    setLikedIds(new Set((data ?? []).map((l: any) => l.post_id)));
  }, [myId]);

  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => { loadLikes(); }, [loadLikes]);

  useEffect(() => {
    if (!myId) return;
    supabase.from("user_roles").select("role").eq("user_id", myId).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [myId]);

  useEffect(() => {
    const ch = supabase.channel("social-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "social_posts" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "social_likes" }, () => { loadPosts(); loadLikes(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadPosts, loadLikes]);

  const toggleLike = async (postId: string) => {
    if (!myId) { toast.error("Inicia sesión para dar like"); return; }
    if (likedIds.has(postId)) {
      await supabase.from("social_likes").delete().eq("post_id", postId).eq("user_id", myId);
      setLikedIds((s) => { const n = new Set(s); n.delete(postId); return n; });
    } else {
      await supabase.from("social_likes").insert({ post_id: postId, user_id: myId });
      setLikedIds((s) => new Set(s).add(postId));
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm("¿Eliminar este post?")) return;
    const { error } = await supabase.from("social_posts").delete().eq("id", postId);
    if (error) toast.error(error.message); else toast.success("🗑️ Post eliminado");
  };

  const submit = async () => {
    if (!myId) { toast.error("Inicia sesión"); return; }
    if (isMuted) { toast.error("Estás silenciado temporalmente"); return; }
    if (!content.trim() && !file) { toast.error("Escribe algo o adjunta un archivo"); return; }
    setUploading(true);
    try {
      let media_url: string | null = null;
      let media_type: "image" | "video" | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${myId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("social-media").upload(path, file);
        if (upErr) throw upErr;
        media_url = supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl;
        media_type = file.type.startsWith("video/") ? "video" : "image";
      }
      const { error } = await supabase.from("social_posts").insert({
        author_id: myId, title: title.trim(), content: content.trim(), media_url, media_type,
      });
      if (error) throw error;
      toast.success("🔥 Publicado");
      setContent(""); setTitle(""); setFile(null);
    } catch (e: any) {
      toast.error(e.message ?? "Error al publicar");
    } finally { setUploading(false); }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <LavaParticles />
      <div className="relative z-10 max-w-2xl mx-auto px-3 sm:px-6 py-4">
        <header className="flex items-center justify-between mb-4 sticky top-0 z-20 glass-panel-strong rounded-2xl px-3 py-2">
          <button onClick={() => nav("/")} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold magma-gradient-text">🌋 Magma Social</h1>
          <div className="w-9" />
        </header>

        {session && (
          <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="glass-panel-strong rounded-2xl p-3 mb-4 space-y-2">
            {isMuted && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                🔇 Silenciado hasta {mutedUntil?.toLocaleString("es")}
              </div>
            )}
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)"
              className="w-full px-3 py-2 rounded-xl bg-muted text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="¿Qué hierve? 🔥"
              rows={2} className="w-full px-3 py-2 rounded-xl bg-muted text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30 resize-none" />
            {file && (
              <div className="text-xs text-muted-foreground flex items-center justify-between bg-muted px-3 py-1.5 rounded-lg">
                <span className="truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-destructive">×</button>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <label className="cursor-pointer p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary">
                <ImageIcon size={18} />
                <input type="file" accept="image/*,video/*" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <motion.button whileTap={{ scale: 0.95 }} disabled={uploading || isMuted} onClick={submit}
                className="px-4 py-2 rounded-xl magma-gradient text-primary-foreground text-sm font-semibold disabled:opacity-40 magma-glow-sm flex items-center gap-2">
                <Send size={14} /> {uploading ? "Publicando..." : "Publicar"}
              </motion.button>
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {posts.map((p, i) => {
              const author = profiles[p.author_id];
              const liked = likedIds.has(p.id);
              const canDelete = isAdmin || p.author_id === myId;
              return (
                <motion.article key={p.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="glass-panel-strong rounded-2xl overflow-hidden">
                  <header className="flex items-center justify-between p-3">
                    <Link to={`/c/${author?.username ?? p.author_id}`} className="flex items-center gap-2.5 min-w-0 hover:opacity-80">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs ${author?.is_official ? "bg-gradient-to-br from-sky-500 to-sky-700" : "magma-gradient"}`}>
                        {author?.avatar_initials ?? "??"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground flex items-center min-w-0">
                          <span className="truncate">{author?.display_name ?? "Usuario"}</span>
                          <Badges isVerified={author?.is_verified} isOfficial={author?.is_official} size={12} />
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          @{author?.username ?? "?"} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </Link>
                    {canDelete && (
                      <button onClick={() => deletePost(p.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </header>
                  {p.title && <h2 className="px-3 text-base font-bold text-foreground">{p.title}</h2>}
                  {p.content && <p className="px-3 pb-2 text-sm text-foreground/90 whitespace-pre-wrap break-words">{p.content}</p>}
                  {p.media_url && p.media_type === "image" && (
                    <img src={p.media_url} alt="" loading="lazy" className="w-full max-h-[500px] object-cover bg-black" />
                  )}
                  {p.media_url && p.media_type === "video" && (
                    <video src={p.media_url} controls preload="metadata" className="w-full max-h-[500px] bg-black" />
                  )}
                  <footer className="flex items-center gap-4 p-3">
                    <button onClick={() => toggleLike(p.id)} className={`flex items-center gap-1.5 text-xs ${liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"} transition-colors`}>
                      <Heart size={16} fill={liked ? "currentColor" : "none"} /> {p.likes_count}
                    </button>
                    <Link to={`/c/${author?.username}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                      <MessageCircle size={16} /> {p.comments_count}
                    </Link>
                  </footer>
                </motion.article>
              );
            })}
          </AnimatePresence>
          {posts.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No hay publicaciones todavía. ¡Sé el primero! 🔥
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Social;