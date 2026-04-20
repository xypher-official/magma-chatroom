import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bell, BellOff, Send, Trash2, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LavaParticles from "@/components/LavaParticles";
import Badges from "@/components/Badges";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Profile { user_id: string; display_name: string; username: string; avatar_initials: string; is_verified: boolean; is_official: boolean }
interface Post { id: string; author_id: string; title: string; content: string; media_url: string | null; media_type: string | null; likes_count: number; comments_count: number; created_at: string }
interface Comment { id: string; post_id: string; author_id: string; content: string; created_at: string }

const Channel = () => {
  const { username } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [subs, setSubs] = useState(0);
  const [isSubbed, setIsSubbed] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState("");
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const myId = session?.user?.id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!username) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
    if (!p) return;
    setProfile(p as Profile);
    const [{ data: ps }, { count }, { data: sub }] = await Promise.all([
      supabase.from("social_posts").select("*").eq("author_id", p.user_id).order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("channel_id", p.user_id),
      myId ? supabase.from("subscriptions").select("id").eq("channel_id", p.user_id).eq("subscriber_id", myId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setPosts((ps ?? []) as Post[]);
    setSubs(count ?? 0);
    setIsSubbed(!!sub);
  }, [username, myId]);

  useEffect(() => { load(); }, [load]);

  const toggleSub = async () => {
    if (!myId || !profile) { toast.error("Inicia sesión"); return; }
    if (myId === profile.user_id) { toast.error("No puedes suscribirte a ti mismo"); return; }
    if (isSubbed) {
      await supabase.from("subscriptions").delete().eq("channel_id", profile.user_id).eq("subscriber_id", myId);
      setIsSubbed(false); setSubs((n) => n - 1);
    } else {
      const { error } = await supabase.from("subscriptions").insert({ channel_id: profile.user_id, subscriber_id: myId });
      if (error) { toast.error(error.message); return; }
      setIsSubbed(true); setSubs((n) => n + 1);
      toast.success("🔔 Suscrito");
    }
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase.from("social_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    setComments((m) => ({ ...m, [postId]: (data ?? []) as Comment[] }));
    const ids = Array.from(new Set((data ?? []).map((c: any) => c.author_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("user_id,display_name,username,avatar_initials,is_verified,is_official").in("user_id", ids);
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of ps ?? []) next[p.user_id] = p as Profile;
        return next;
      });
    }
  };

  const sendComment = async (postId: string) => {
    if (!myId || !commentText.trim()) return;
    const { error } = await supabase.from("social_comments").insert({ post_id: postId, author_id: myId, content: commentText.trim() });
    if (error) { toast.error(error.message); return; }
    setCommentText("");
    loadComments(postId);
  };

  const delComment = async (cid: string, postId: string) => {
    await supabase.from("social_comments").delete().eq("id", cid);
    loadComments(postId);
  };

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando canal…</div>;
  }

  return (
    <div className="min-h-screen bg-background relative">
      <LavaParticles />
      <div className="relative z-10 max-w-2xl mx-auto px-3 sm:px-6 py-4">
        <header className="flex items-center justify-between mb-4 glass-panel-strong rounded-2xl px-3 py-2">
          <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-sm font-semibold text-foreground truncate">@{profile.username}</h1>
          <div className="w-9" />
        </header>

        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="glass-panel-strong rounded-2xl p-4 mb-4 flex items-center gap-3">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg ${profile.is_official ? "bg-gradient-to-br from-sky-500 to-sky-700" : "magma-gradient"}`}>
            {profile.avatar_initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-foreground flex items-center text-lg">
              <span className="truncate">{profile.display_name}</span>
              <Badges isVerified={profile.is_verified} isOfficial={profile.is_official} size={16} />
            </h2>
            <p className="text-xs text-muted-foreground">{subs} suscriptor{subs === 1 ? "" : "es"} · {posts.length} post{posts.length === 1 ? "" : "s"}</p>
          </div>
          {myId !== profile.user_id && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={toggleSub}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 ${isSubbed ? "bg-muted text-foreground" : "magma-gradient text-primary-foreground magma-glow-sm"}`}>
              {isSubbed ? <><BellOff size={14} /> Suscrito</> : <><Bell size={14} /> Suscribirse</>}
            </motion.button>
          )}
        </motion.div>

        <div className="space-y-3">
          {posts.map((p) => (
            <motion.article key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="glass-panel-strong rounded-2xl overflow-hidden">
              {p.title && <h3 className="px-3 pt-3 font-bold text-foreground">{p.title}</h3>}
              {p.content && <p className="px-3 py-2 text-sm text-foreground/90 whitespace-pre-wrap break-words">{p.content}</p>}
              {p.media_url && p.media_type === "image" && <img src={p.media_url} alt="" className="w-full max-h-[500px] object-cover bg-black" />}
              {p.media_url && p.media_type === "video" && <video src={p.media_url} controls className="w-full max-h-[500px] bg-black" />}
              <footer className="flex items-center gap-4 p-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Heart size={14} /> {p.likes_count}</span>
                <button onClick={() => { const next = openComments === p.id ? null : p.id; setOpenComments(next); if (next) loadComments(p.id); }} className="hover:text-primary">
                  💬 {p.comments_count} comentarios
                </button>
                <span className="ml-auto">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: es })}</span>
              </footer>
              {openComments === p.id && (
                <div className="border-t border-border p-3 space-y-2 bg-muted/30">
                  {(comments[p.id] ?? []).map((c) => {
                    const a = profiles[c.author_id];
                    return (
                      <div key={c.id} className="flex items-start gap-2 group">
                        <Link to={`/c/${a?.username ?? c.author_id}`} className="w-7 h-7 rounded-full magma-gradient flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
                          {a?.avatar_initials ?? "??"}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground flex items-center">
                            {a?.display_name ?? "Usuario"}
                            <Badges isVerified={a?.is_verified} isOfficial={a?.is_official} size={10} />
                          </p>
                          <p className="text-xs text-foreground/80 break-words">{c.content}</p>
                        </div>
                        {c.author_id === myId && (
                          <button onClick={() => delComment(c.id, p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {session && (
                    <div className="flex items-center gap-2 pt-2">
                      <input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendComment(p.id)}
                        placeholder="Comenta..." className="flex-1 px-3 py-1.5 rounded-lg bg-background text-xs outline-none focus:ring-2 focus:ring-ring/30" />
                      <button onClick={() => sendComment(p.id)} className="p-1.5 rounded-lg magma-gradient text-primary-foreground"><Send size={12} /></button>
                    </div>
                  )}
                </div>
              )}
            </motion.article>
          ))}
          {posts.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Aún no ha publicado nada.</p>}
        </div>
      </div>
    </div>
  );
};

export default Channel;