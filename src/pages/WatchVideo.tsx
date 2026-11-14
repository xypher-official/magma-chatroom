import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, ThumbsUp, ThumbsDown, UserPlus, UserCheck, Bookmark, BookmarkCheck,
  Share2, Code2, Copy, Eye, MessageCircle, Send, Loader2, Plus, ListVideo, Link as LinkIcon, Clapperboard,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MagmaVideoPlayer from "@/components/MagmaVideoPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VideoRow = {
  id: string; author_id: string; title: string; description: string; video_url: string;
  thumbnail_url: string | null; kind: "long" | "short"; status: string;
  views_count: number; likes_count: number; comments_count: number; created_at: string;
};
type Profile = { user_id: string; display_name: string; avatar_initials: string; avatar_url?: string | null };
type Playlist = { id: string; name: string; is_public: boolean };

const fmtTime = (iso: string) => {
  const d = new Date(iso); const diff = Date.now() - +d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24); if (dd < 7) return `${dd}d ago`;
  return d.toLocaleDateString();
};

const WatchVideo = () => {
  const { videoId } = useParams();
  const nav = useNavigate();
  const [me, setMe] = useState<string | undefined>();
  const [video, setVideo] = useState<VideoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [related, setRelated] = useState<VideoRow[]>([]);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [subscribed, setSubscribed] = useState(false);
  const [subCount, setSubCount] = useState(0);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [savedIn, setSavedIn] = useState<Set<string>>(new Set());
  const [showSave, setShowSave] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState("");
  const [showEmbed, setShowEmbed] = useState(false);
  const [comments, setComments] = useState<{ id: string; author_id: string; content: string; created_at: string }[]>([]);
  const [newComment, setNewComment] = useState("");
  const viewBumped = useRef(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const watchUrl = `${origin}/video/watch/${videoId}`;
  const embedCode = useMemo(() => {
    if (!video) return "";
    const vertical = video.kind === "short";
    return `<iframe src="${origin}/embed/v/${video.id}" width="100%" height="${vertical ? 720 : 405}" style="border:0;border-radius:12px;max-width:${vertical ? 405 : 720}px" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${video.title.replace(/"/g, "&quot;")} · MSocialVideos"></iframe>`;
  }, [video, origin]);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      setMe(sess?.user?.id);
    })();
  }, []);

  const loadCounts = async (v: VideoRow, uid?: string) => {
    const [{ data: c }, { data: l }, { data: d }, { data: subs }] = await Promise.all([
      (supabase as any).rpc("video_engagement_counts", { _video: v.id }),
      uid ? (supabase as any).from("video_likes").select("user_id").eq("video_id", v.id).eq("user_id", uid) : Promise.resolve({ data: [] }),
      uid ? (supabase as any).from("video_dislikes").select("user_id").eq("video_id", v.id).eq("user_id", uid) : Promise.resolve({ data: [] }),
      uid ? (supabase as any).from("subscriptions").select("subscriber_id").eq("channel_id", v.author_id).eq("subscriber_id", uid) : Promise.resolve({ data: [] }),
    ]);
    const row = Array.isArray(c) ? c[0] : c;
    setLikes(Number(row?.likes ?? 0)); setDislikes(Number(row?.dislikes ?? 0)); setSubCount(Number(row?.subscribers ?? 0));
    setLiked((l ?? []).length > 0);
    setDisliked((d ?? []).length > 0);
    setSubscribed((subs ?? []).length > 0);
  };

  useEffect(() => {
    if (!videoId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from("videos").select("*").eq("id", videoId).maybeSingle();
      if (!alive) return;
      const v = (data as VideoRow) ?? null;
      setVideo(v);
      setLoading(false);
      if (!v) return;
      const { data: ps } = await supabase.from("profiles").select("user_id, display_name, avatar_initials, avatar_url");
      const map: Record<string, Profile> = {};
      (ps ?? []).forEach((p: any) => { map[p.user_id] = p; });
      if (alive) setProfiles(map);
      const { data: rel } = await (supabase as any).from("videos").select("*")
        .eq("status", "published").neq("id", v.id).order("views_count", { ascending: false }).limit(12);
      if (alive) setRelated((rel ?? []) as VideoRow[]);
      if (!viewBumped.current) {
        viewBumped.current = true;
        await (supabase as any).from("videos").update({ views_count: (v.views_count ?? 0) + 1 }).eq("id", v.id);
      }
    })();
    return () => { alive = false; };
  }, [videoId]);

  useEffect(() => { if (video) loadCounts(video, me); }, [video?.id, me]);

  useEffect(() => {
    if (!me) { setPlaylists([]); setSavedIn(new Set()); return; }
    (async () => {
      const { data: pl } = await (supabase as any).from("playlists").select("id,name,is_public").eq("owner_id", me).order("created_at");
      setPlaylists((pl ?? []) as Playlist[]);
      if (videoId) {
        const { data: items } = await (supabase as any).from("playlist_items").select("playlist_id").eq("video_id", videoId);
        setSavedIn(new Set((items ?? []).map((i: any) => i.playlist_id)));
      }
    })();
  }, [me, videoId]);

  const loadComments = async () => {
    if (!videoId) return;
    const { data } = await (supabase as any).from("video_comments").select("*").eq("video_id", videoId).order("created_at", { ascending: true });
    setComments((data ?? []) as any);
  };
  useEffect(() => {
    if (!videoId) return;
    loadComments();
    const ch = supabase.channel(`watch-${videoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "video_comments", filter: `video_id=eq.${videoId}` }, loadComments)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [videoId]);

  const requireAuth = () => {
    if (!me) { toast.error("Sign in to do that"); return false; }
    return true;
  };

  const toggleLike = async () => {
    if (!video || !requireAuth()) return;
    if (liked) {
      await (supabase as any).from("video_likes").delete().eq("video_id", video.id).eq("user_id", me);
      setLiked(false); setLikes((n) => Math.max(0, n - 1));
    } else {
      await (supabase as any).from("video_likes").insert({ video_id: video.id, user_id: me });
      setLiked(true); setLikes((n) => n + 1);
      if (disliked) {
        await (supabase as any).from("video_dislikes").delete().eq("video_id", video.id).eq("user_id", me);
        setDisliked(false); setDislikes((n) => Math.max(0, n - 1));
      }
    }
  };

  const toggleDislike = async () => {
    if (!video || !requireAuth()) return;
    if (disliked) {
      await (supabase as any).from("video_dislikes").delete().eq("video_id", video.id).eq("user_id", me);
      setDisliked(false); setDislikes((n) => Math.max(0, n - 1));
    } else {
      await (supabase as any).from("video_dislikes").insert({ video_id: video.id, user_id: me });
      setDisliked(true); setDislikes((n) => n + 1);
      if (liked) {
        await (supabase as any).from("video_likes").delete().eq("video_id", video.id).eq("user_id", me);
        setLiked(false); setLikes((n) => Math.max(0, n - 1));
      }
    }
  };

  const toggleSubscribe = async () => {
    if (!video || !requireAuth()) return;
    if (video.author_id === me) { toast.info("That's your own channel"); return; }
    if (subscribed) {
      await (supabase as any).from("subscriptions").delete().eq("channel_id", video.author_id).eq("subscriber_id", me);
      setSubscribed(false); setSubCount((n) => Math.max(0, n - 1));
    } else {
      const { error } = await (supabase as any).from("subscriptions").insert({ channel_id: video.author_id, subscriber_id: me });
      if (error) { toast.error(error.message); return; }
      setSubscribed(true); setSubCount((n) => n + 1);
      toast.success("Following this channel");
    }
  };

  const togglePlaylist = async (pid: string) => {
    if (!video || !requireAuth()) return;
    if (savedIn.has(pid)) {
      await (supabase as any).from("playlist_items").delete().eq("playlist_id", pid).eq("video_id", video.id);
      setSavedIn((s) => { const n = new Set(s); n.delete(pid); return n; });
    } else {
      const { error } = await (supabase as any).from("playlist_items").insert({ playlist_id: pid, video_id: video.id });
      if (error) { toast.error(error.message); return; }
      setSavedIn((s) => new Set(s).add(pid));
      toast.success("Saved to playlist");
    }
  };

  const createPlaylist = async () => {
    const name = newPlaylist.trim();
    if (!name || !requireAuth()) return;
    const { data, error } = await (supabase as any).from("playlists").insert({ owner_id: me, name }).select("id,name,is_public").maybeSingle();
    if (error) { toast.error(error.message); return; }
    setNewPlaylist("");
    setPlaylists((p) => [...p, data as Playlist]);
    if (data) await togglePlaylist((data as Playlist).id);
  };

  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: video?.title, url: watchUrl }); return; }
      await navigator.clipboard.writeText(watchUrl);
      toast.success("Link copied!");
    } catch { /* cancelled */ }
  };

  const copyEmbed = async () => {
    try { await navigator.clipboard.writeText(embedCode); toast.success("Embed HTML copied!"); }
    catch { toast.error("Copy failed — select the code manually"); }
  };

  const sendComment = async () => {
    if (!me || !newComment.trim() || !video) return;
    const c = newComment.trim(); setNewComment("");
    await (supabase as any).from("video_comments").insert({ video_id: video.id, author_id: me, content: c });
  };

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={28} /></main>;
  }
  if (!video) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <Clapperboard className="text-muted-foreground" size={40} />
        <h1 className="text-lg font-bold text-foreground">This video is unavailable</h1>
        <Button onClick={() => nav("/social/videos")} className="magma-gradient text-primary-foreground">Go to MSocialVideos</Button>
      </main>
    );
  }

  const author = profiles[video.author_id];
  const ActionBtn = ({ active, onClick, icon, label }: { active?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all glass-panel border ${active ? "border-primary/60 text-primary" : "border-border text-foreground/85 hover:border-primary/40"}`}>
      {icon}<span className="whitespace-nowrap">{label}</span>
    </button>
  );

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/75 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center gap-3 p-3">
          <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"><ArrowLeft size={18} /></button>
          <Link to="/social/videos" className="flex items-center gap-2 text-sm font-bold magma-gradient-text"><Clapperboard size={16} /> MSocialVideos</Link>
        </div>
      </header>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto p-3 md:p-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl overflow-hidden bg-black border border-border">
            <MagmaVideoPlayer src={video.video_url} poster={video.thumbnail_url} title={video.title}
              vertical={video.kind === "short"} autoPlay />
          </div>

          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{video.title || "Untitled"}</h1>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1"><Eye size={12} />{video.views_count + 1} views</span>
              <span>{fmtTime(video.created_at)}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap glass-panel border border-border rounded-2xl p-3">
            <div className="w-10 h-10 rounded-full magma-gradient overflow-hidden flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0">
              {author?.avatar_url ? <img src={author.avatar_url} alt="" className="w-full h-full object-cover" /> : (author?.avatar_initials ?? "??")}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{author?.display_name || "Unknown"}</p>
              <p className="text-[11px] text-muted-foreground">{subCount} follower{subCount === 1 ? "" : "s"}</p>
            </div>
            <Button size="sm" onClick={toggleSubscribe}
              className={`ml-auto gap-1.5 ${subscribed ? "" : "magma-gradient text-primary-foreground"}`}
              variant={subscribed ? "outline" : "default"}>
              {subscribed ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-full glass-panel border border-border overflow-hidden">
              <button onClick={toggleLike} className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold ${liked ? "text-primary" : "text-foreground/85 hover:text-primary"}`}>
                <ThumbsUp size={14} fill={liked ? "currentColor" : "none"} /> {likes}
              </button>
              <span className="w-px h-5 bg-border" />
              <button onClick={toggleDislike} className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold ${disliked ? "text-destructive" : "text-foreground/85 hover:text-destructive"}`}>
                <ThumbsDown size={14} fill={disliked ? "currentColor" : "none"} /> {dislikes}
              </button>
            </div>
            <ActionBtn onClick={share} icon={<Share2 size={14} />} label="Share" />
            <ActionBtn active={savedIn.size > 0} onClick={() => setShowSave((s) => !s)}
              icon={savedIn.size > 0 ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} label="Save" />
            <ActionBtn active={showEmbed} onClick={() => setShowEmbed((s) => !s)} icon={<Code2 size={14} />} label="Embed" />
            <ActionBtn onClick={copyEmbed} icon={<Copy size={14} />} label="Copy embed" />
            <ActionBtn onClick={async () => { await navigator.clipboard.writeText(watchUrl); toast.success("Link copied!"); }}
              icon={<LinkIcon size={14} />} label="Copy link" />
          </div>

          {showSave && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="glass-panel border border-border rounded-2xl p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><ListVideo size={13} /> Save to playlist</p>
              {playlists.length === 0 && <p className="text-[11px] text-muted-foreground">No playlists yet — create one below.</p>}
              {playlists.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={savedIn.has(p.id)} onChange={() => togglePlaylist(p.id)} />
                  {p.name}
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <Input value={newPlaylist} onChange={(e) => setNewPlaylist(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createPlaylist()} placeholder="New playlist name" className="h-9 text-xs" />
                <Button size="sm" onClick={createPlaylist} className="magma-gradient text-primary-foreground"><Plus size={14} /></Button>
              </div>
            </motion.div>
          )}

          {showEmbed && (
            <div className="space-y-2">
              <pre className="glass-panel rounded-lg p-3 text-[11px] leading-relaxed text-foreground/90 overflow-x-auto scrollbar-magma"><code>{embedCode}</code></pre>
              <p className="text-[11px] text-muted-foreground">Paste this anywhere — the player includes a “Watch On MSocialVideos” button that opens this page.</p>
            </div>
          )}

          {video.description && (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap glass-panel border border-border p-3 rounded-2xl">{video.description}</p>
          )}

          <section>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-foreground"><MessageCircle size={14} />{comments.length} comments</h2>
            {me && (
              <div className="flex gap-2 mb-3">
                <Input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendComment()} placeholder="Add a comment..." />
                <Button onClick={sendComment} size="icon" className="magma-gradient text-primary-foreground"><Send size={14} /></Button>
              </div>
            )}
            <div className="space-y-2">
              {comments.map((c) => {
                const a = profiles[c.author_id];
                return (
                  <div key={c.id} className="flex gap-2 p-2 rounded-lg glass-panel border border-border">
                    <div className="w-8 h-8 rounded-full magma-gradient flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">
                      {a?.avatar_initials ?? "??"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs"><span className="font-semibold">{a?.display_name || "Unknown"}</span> <span className="text-muted-foreground">· {fmtTime(c.created_at)}</span></p>
                      <p className="text-sm text-foreground break-words">{c.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">Up next</h2>
          {related.map((r) => (
            <Link key={r.id} to={`/video/watch/${r.id}`}
              className="flex gap-2 rounded-xl glass-panel border border-border p-2 hover:border-primary/40 transition-all">
              <div className="w-28 aspect-video rounded-lg overflow-hidden bg-muted shrink-0">
                {r.thumbnail_url
                  ? <img src={r.thumbnail_url} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
                  : <div className="w-full h-full magma-gradient" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground line-clamp-2">{r.title || "Untitled"}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{profiles[r.author_id]?.display_name || "Unknown"} · {r.views_count} views</p>
              </div>
            </Link>
          ))}
          {related.length === 0 && <p className="text-xs text-muted-foreground">Nothing else yet.</p>}
        </aside>
      </motion.div>
    </main>
  );
};

export default WatchVideo;
