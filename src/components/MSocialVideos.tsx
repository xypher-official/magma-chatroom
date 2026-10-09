import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Play, Plus, Upload, Link as LinkIcon, Sparkles, Image as ImageIcon,
  Heart, MessageCircle, Eye, Trash2, Pencil, Pause, CalendarClock, Film, Clapperboard, X, Send, Clock,
  Search, Users, Zap, Flame,
} from "lucide-react";
import { toast } from "sonner";
import MagmaVideoPlayer from "@/components/MagmaVideoPlayer";
import LiveNowStrip from "@/components/LiveNowStrip";
import { Code2, Copy } from "lucide-react";

type VideoRow = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  kind: "long" | "short";
  status: "draft" | "scheduled" | "published" | "suspended";
  scheduled_at: string | null;
  is_premiere: boolean;
  premiere_at: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

interface Props { myUserId?: string; isAdmin?: boolean; profiles: Record<string, { display_name: string; avatar_initials: string; avatar_url?: string | null }> }

const fmtTime = (iso: string) => {
  const d = new Date(iso); const diff = Date.now() - +d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24); if (dd < 7) return `${dd}d ago`;
  return d.toLocaleDateString();
};

const MSocialVideos = ({ myUserId, isAdmin, profiles }: Props) => {
  const nav = useNavigate();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [tab, setTab] = useState<"home" | "long" | "short" | "channels">("home");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "views" | "likes" | "old">("recent");
  const [channel, setChannel] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<VideoRow | null>(null);
  const [player, setPlayer] = useState<VideoRow | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data } = await (supabase as any).from("videos").select("*").order("created_at", { ascending: false });
    setVideos((data ?? []) as VideoRow[]);
    if (myUserId) {
      const { data: l } = await (supabase as any).from("video_likes").select("video_id").eq("user_id", myUserId);
      setLikedIds(new Set((l ?? []).map((r: any) => r.video_id)));
    }
  };

  useEffect(() => { load(); }, [myUserId]);

  useEffect(() => {
    const ch = supabase.channel("videos-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "videos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "video_likes" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const q = query.trim().toLowerCase();

  const channels = useMemo(() => {
    const map = new Map<string, { id: string; videos: number; views: number; likes: number; last: string }>();
    videos.forEach((v) => {
      const c = map.get(v.author_id) ?? { id: v.author_id, videos: 0, views: 0, likes: 0, last: v.created_at };
      c.videos += 1; c.views += v.views_count; c.likes += v.likes_count;
      if (v.created_at > c.last) c.last = v.created_at;
      map.set(v.author_id, c);
    });
    let list = [...map.values()];
    if (q) list = list.filter((c) => (profiles[c.id]?.display_name ?? "").toLowerCase().includes(q));
    return list.sort((a, b) => b.views - a.views || b.videos - a.videos);
  }, [videos, q, profiles]);

  const visible = useMemo(() => {
    let list = videos.filter((v) => {
      if (channel && v.author_id !== channel) return false;
      if (tab === "long" && v.kind !== "long") return false;
      if (tab === "short" && v.kind !== "short") return false;
      if (q) {
        const author = (profiles[v.author_id]?.display_name ?? "").toLowerCase();
        if (!`${v.title} ${v.description}`.toLowerCase().includes(q) && !author.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "views") return b.views_count - a.views_count;
      if (sort === "likes") return b.likes_count - a.likes_count;
      if (sort === "old") return +new Date(a.created_at) - +new Date(b.created_at);
      return +new Date(b.created_at) - +new Date(a.created_at);
    });
    return list;
  }, [videos, tab, q, sort, channel, profiles]);

  const shortsRow = useMemo(
    () => videos.filter((v) => v.kind === "short" && v.status !== "suspended").slice(0, 12),
    [videos],
  );

  const toggleLike = async (v: VideoRow) => {
    if (!myUserId) return;
    if (likedIds.has(v.id)) {
      await (supabase as any).from("video_likes").delete().eq("video_id", v.id).eq("user_id", myUserId);
    } else {
      await (supabase as any).from("video_likes").insert({ video_id: v.id, user_id: myUserId });
    }
  };

  const remove = async (v: VideoRow) => {
    if (!confirm(`Delete "${v.title || "video"}"?`)) return;
    await (supabase as any).from("videos").delete().eq("id", v.id);
    toast.success("Video deleted");
  };

  const suspend = async (v: VideoRow) => {
    const next = v.status === "suspended" ? "published" : "suspended";
    await (supabase as any).from("videos").update({ status: next }).eq("id", v.id);
    toast.success(next === "suspended" ? "Suspended" : "Restored");
  };

  const Card = ({ v, compact }: { v: VideoRow; compact?: boolean }) => {
    const author = profiles[v.author_id];
    const isOwner = v.author_id === myUserId;
    const isShort = v.kind === "short";
    const isScheduledFuture = v.status === "scheduled" && v.scheduled_at && new Date(v.scheduled_at) > new Date();
    const isPremiereFuture = v.is_premiere && v.premiere_at && new Date(v.premiere_at) > new Date();
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }} transition={{ duration: 0.3 }}
        className="group rounded-2xl overflow-hidden glass-panel border border-border hover:border-primary/40 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.4)] transition-all">
        <button onClick={() => !isScheduledFuture && !isPremiereFuture && nav(`/video/watch/${v.id}`)}
          className={`relative w-full overflow-hidden bg-muted ${isShort && (compact || tab === "short") ? "aspect-[9/16]" : "aspect-video"}`}>
          {v.thumbnail_url ? (
            <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          ) : (
            <div className="w-full h-full magma-gradient flex items-center justify-center">
              <Film className="text-primary-foreground/80" size={42} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-14 h-14 rounded-full magma-gradient flex items-center justify-center magma-glow-sm">
              <Play className="text-primary-foreground ml-1" size={22} fill="currentColor" />
            </div>
          </div>
          {isShort && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-destructive text-destructive-foreground">SHORT</span>
          )}
          {isPremiereFuture && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent text-accent-foreground flex items-center gap-1"><Sparkles size={10}/>PREMIERE</span>
          )}
          {isScheduledFuture && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-black flex items-center gap-1"><Clock size={10}/>SCHEDULED</span>
          )}
          {v.status === "suspended" && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
              <span className="text-xs font-bold text-destructive">SUSPENDED</span>
            </div>
          )}
        </button>
        <div className="p-3">
          <div className="flex gap-2">
            <button onClick={() => { setChannel(v.author_id); setTab("home"); }}
              className="w-8 h-8 shrink-0 rounded-full magma-gradient overflow-hidden flex items-center justify-center text-[10px] font-bold text-primary-foreground">
              {author?.avatar_url ? <img src={author.avatar_url} alt="" className="w-full h-full object-cover" /> : (author?.avatar_initials ?? "??")}
            </button>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-foreground line-clamp-2">{v.title || "Untitled"}</h3>
              <button onClick={() => { setChannel(v.author_id); setTab("home"); }}
                className="text-xs text-muted-foreground hover:text-primary truncate block max-w-full text-left">
                {author?.display_name || "Unknown"} · {fmtTime(v.created_at)}
              </button>
            </div>
          </div>
          {!compact && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
              <span className="flex items-center gap-1"><Eye size={12}/>{v.views_count}</span>
              <button onClick={(e) => { e.stopPropagation(); toggleLike(v); }}
                className={`flex items-center gap-1 hover:text-primary ${likedIds.has(v.id) ? "text-destructive" : ""}`}>
                <Heart size={12} fill={likedIds.has(v.id) ? "currentColor" : "none"}/>{v.likes_count}
              </button>
              <span className="flex items-center gap-1"><MessageCircle size={12}/>{v.comments_count}</span>
              {isScheduledFuture && (
                <span className="flex items-center gap-1 ml-auto text-amber-500"><CalendarClock size={11}/>{new Date(v.scheduled_at!).toLocaleString()}</span>
              )}
            </div>
          )}
          {(isOwner || isAdmin) && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
              <button onClick={() => setEditing(v)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary" title="Edit">
                <Pencil size={13}/>
              </button>
              {isAdmin && (
                <button onClick={() => suspend(v)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-amber-500" title="Suspend/Restore">
                  <Pause size={13}/>
                </button>
              )}
              <button onClick={() => remove(v)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive ml-auto" title="Delete">
                <Trash2 size={13}/>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const activeChannel = channel ? profiles[channel] : null;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl magma-gradient flex items-center justify-center text-2xl">
            <Clapperboard className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold magma-gradient-text">MSocialVideos</h1>
            <p className="text-xs text-muted-foreground">Videos, shorts & creator channels</p>
          </div>
        </div>
        {myUserId && (
          <Button onClick={() => setShowUpload(true)} className="magma-gradient text-primary-foreground gap-1.5">
            <Plus size={16} /> Upload
          </Button>
        )}
      </div>

      {/* Search + sort */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 backdrop-blur-xl bg-background/70 border-b border-border mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos, channels or creators..."
              className="pl-9 pr-9 rounded-full glass-panel border-border" />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex rounded-full glass-panel p-1 overflow-x-auto scrollbar-magma">
            {([
              ["home", "Home", Flame],
              ["long", "Videos", Film],
              ["short", "Shorts", Zap],
              ["channels", "Channels", Users],
            ] as const).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-1.5 text-xs rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${tab === k ? "magma-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          {tab !== "channels" && (
            <div className="flex rounded-full glass-panel p-1 overflow-x-auto scrollbar-magma">
              {([["recent", "New"], ["views", "Popular"], ["likes", "Top liked"], ["old", "Oldest"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setSort(k)}
                  className={`px-2.5 py-1.5 text-[11px] rounded-full whitespace-nowrap ${sort === k ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <LiveNowStrip />

      {/* Channel banner */}
      {channel && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 rounded-2xl glass-panel border border-border p-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full magma-gradient overflow-hidden flex items-center justify-center text-lg font-bold text-primary-foreground shrink-0">
            {activeChannel?.avatar_url ? <img src={activeChannel.avatar_url} alt="" className="w-full h-full object-cover" /> : (activeChannel?.avatar_initials ?? "??")}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-foreground truncate">{activeChannel?.display_name || "Unknown channel"}</h2>
            <p className="text-xs text-muted-foreground">
              {videos.filter((v) => v.author_id === channel).length} videos ·{" "}
              {videos.filter((v) => v.author_id === channel).reduce((s, v) => s + v.views_count, 0)} views
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setChannel(null)} className="gap-1.5">
            <X size={14} /> Exit channel
          </Button>
        </motion.div>
      )}

      {/* Channels grid */}
      {tab === "channels" ? (
        channels.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="mx-auto mb-3 opacity-50" size={48} />
            <p>No channels found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {channels.map((c) => {
              const p = profiles[c.id];
              return (
                <motion.button key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }}
                  onClick={() => { setChannel(c.id); setTab("home"); }}
                  className="rounded-2xl glass-panel border border-border hover:border-primary/40 p-4 text-center transition-all">
                  <div className="w-16 h-16 mx-auto rounded-full magma-gradient overflow-hidden flex items-center justify-center text-lg font-bold text-primary-foreground">
                    {p?.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p?.avatar_initials ?? "??")}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground truncate">{p?.display_name || "Unknown"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.videos} videos · {c.views} views</p>
                  <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 mt-1"><Heart size={11}/>{c.likes}</p>
                </motion.button>
              );
            })}
          </div>
        )
      ) : (
        <>
          {/* Shorts shelf on Home */}
          {tab === "home" && !channel && !q && shortsRow.length > 0 && (
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={16} className="text-primary" />
                <h2 className="text-sm font-bold text-foreground">Shorts</h2>
                <button onClick={() => setTab("short")} className="text-[11px] text-primary hover:underline ml-auto">See all</button>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-magma pb-2 -mx-1 px-1">
                {shortsRow.map((v) => (
                  <div key={v.id} className="w-[150px] sm:w-[170px] shrink-0">
                    <Card v={v} compact />
                  </div>
                ))}
              </div>
            </div>
          )}

          {visible.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Film className="mx-auto mb-3 opacity-50" size={48} />
              <p>{q ? `No results for "${query}"` : "No videos yet. Be the first to upload one!"}</p>
            </div>
          ) : (
            <div className={tab === "short"
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"}>
              {visible.map((v) => <Card key={v.id} v={v} />)}
            </div>
          )}
        </>
      )}

      {showUpload && myUserId && (
        <UploadDialog myUserId={myUserId} onClose={() => setShowUpload(false)} onDone={load} />
      )}
      {editing && (
        <EditDialog video={editing} isAdmin={!!isAdmin} onClose={() => setEditing(null)} onDone={load} />
      )}
      {player && (
        <PlayerDialog video={player} myUserId={myUserId} profiles={profiles} onClose={() => setPlayer(null)} />
      )}
    </div>
  );
};

// ---------------- Upload Dialog ----------------
const UploadDialog = ({ myUserId, onClose, onDone }: { myUserId: string; onClose: () => void; onDone: () => void }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"long" | "short">("long");
  const [videoMode, setVideoMode] = useState<"file" | "link">("file");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbMode, setThumbMode] = useState<"file" | "link" | "ai">("file");
  const [thumbUrl, setThumbUrl] = useState("");
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiThumb, setAiThumb] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "scheduled" | "premiere">("now");
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState(false);

  const generateAi = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: `YouTube thumbnail, ${aiPrompt}, eye-catching, vibrant colors, dramatic lighting`, purpose: "chat" },
      });
      if (error) throw error;
      setAiThumb((data as any).url);
      toast.success("Thumbnail generated");
    } catch (e: any) { toast.error(e.message || "AI thumbnail failed"); }
    finally { setAiBusy(false); }
  };

  const uploadToBucket = async (file: File, prefix: string) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${myUserId}/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("social-media").upload(path, file, { upsert: false });
    if (error) throw error;
    return supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl;
  };

  const submit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setBusy(true);
    try {
      let finalVideoUrl = videoUrl.trim();
      if (videoMode === "file") {
        if (!videoFile) throw new Error("Pick a video file");
        finalVideoUrl = await uploadToBucket(videoFile, "video");
      }
      if (!finalVideoUrl) throw new Error("Video is required");

      let finalThumb: string | null = null;
      if (thumbMode === "file" && thumbFile) finalThumb = await uploadToBucket(thumbFile, "thumb");
      else if (thumbMode === "link" && thumbUrl.trim()) finalThumb = thumbUrl.trim();
      else if (thumbMode === "ai" && aiThumb) finalThumb = aiThumb;

      const payload: any = {
        author_id: myUserId, title: title.trim(), description: description.trim(),
        video_url: finalVideoUrl, thumbnail_url: finalThumb, kind,
        status: scheduleMode === "scheduled" ? "scheduled" : "published",
        scheduled_at: scheduleMode === "scheduled" && scheduleAt ? new Date(scheduleAt).toISOString() : null,
        is_premiere: scheduleMode === "premiere",
        premiere_at: scheduleMode === "premiere" && scheduleAt ? new Date(scheduleAt).toISOString() : null,
      };
      const { error } = await (supabase as any).from("videos").insert(payload);
      if (error) throw error;
      toast.success("Video published");
      onDone(); onClose();
    } catch (e: any) { toast.error(e.message || "Upload failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-magma">
        <DialogHeader><DialogTitle className="magma-gradient-text">Upload to MSocialVideos</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["long", "short"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${kind === k ? "magma-gradient text-primary-foreground" : "glass-panel text-muted-foreground"}`}>
                {k === "long" ? "🎬 Long video" : "⚡ Short"}
              </button>
            ))}
          </div>

          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Video source</label>
            <div className="flex gap-2">
              <button onClick={() => setVideoMode("file")} className={`flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 ${videoMode === "file" ? "magma-gradient text-primary-foreground" : "glass-panel"}`}><Upload size={13}/>File</button>
              <button onClick={() => setVideoMode("link")} className={`flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 ${videoMode === "link" ? "magma-gradient text-primary-foreground" : "glass-panel"}`}><LinkIcon size={13}/>Link</button>
            </div>
            {videoMode === "file" ? (
              <Input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
            ) : (
              <Input placeholder="https://... (mp4 / webm)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Thumbnail</label>
            <div className="flex gap-2">
              <button onClick={() => setThumbMode("file")} className={`flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 ${thumbMode === "file" ? "magma-gradient text-primary-foreground" : "glass-panel"}`}><ImageIcon size={13}/>File</button>
              <button onClick={() => setThumbMode("link")} className={`flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 ${thumbMode === "link" ? "magma-gradient text-primary-foreground" : "glass-panel"}`}><LinkIcon size={13}/>Link</button>
              <button onClick={() => setThumbMode("ai")} className={`flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 ${thumbMode === "ai" ? "magma-gradient text-primary-foreground" : "glass-panel"}`}><Sparkles size={13}/>AI</button>
            </div>
            {thumbMode === "file" && <Input type="file" accept="image/*" onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)} />}
            {thumbMode === "link" && <Input placeholder="https://..." value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} />}
            {thumbMode === "ai" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input placeholder="Describe the thumbnail..." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                  <Button onClick={generateAi} disabled={aiBusy} className="magma-gradient text-primary-foreground gap-1"><Sparkles size={14}/>{aiBusy ? "..." : "Generate"}</Button>
                </div>
                {aiThumb && <img src={aiThumb} alt="ai thumb" className="rounded-lg w-full max-h-64 object-cover" />}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Release</label>
            <div className="flex gap-2">
              <button onClick={() => setScheduleMode("now")} className={`flex-1 py-2 rounded-lg text-xs ${scheduleMode === "now" ? "magma-gradient text-primary-foreground" : "glass-panel"}`}>Publish now</button>
              <button onClick={() => setScheduleMode("scheduled")} className={`flex-1 py-2 rounded-lg text-xs ${scheduleMode === "scheduled" ? "magma-gradient text-primary-foreground" : "glass-panel"}`}>Schedule</button>
              <button onClick={() => setScheduleMode("premiere")} className={`flex-1 py-2 rounded-lg text-xs ${scheduleMode === "premiere" ? "magma-gradient text-primary-foreground" : "glass-panel"}`}>Premiere</button>
            </div>
            {scheduleMode !== "now" && (
              <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={submit} disabled={busy} className="flex-1 magma-gradient text-primary-foreground">{busy ? "Uploading..." : "Publish"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------------- Edit Dialog ----------------
const EditDialog = ({ video, isAdmin, onClose, onDone }: { video: VideoRow; isAdmin: boolean; onClose: () => void; onDone: () => void }) => {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [thumbnailUrl, setThumbnailUrl] = useState(video.thumbnail_url ?? "");
  const [status, setStatus] = useState(video.status);
  const [scheduledAt, setScheduledAt] = useState(video.scheduled_at ? video.scheduled_at.slice(0, 16) : "");
  const [isPremiere, setIsPremiere] = useState(video.is_premiere);
  const [premiereAt, setPremiereAt] = useState(video.premiere_at ? video.premiere_at.slice(0, 16) : "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const payload: any = {
        title, description, thumbnail_url: thumbnailUrl || null, status,
        scheduled_at: status === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        is_premiere: isPremiere,
        premiere_at: isPremiere && premiereAt ? new Date(premiereAt).toISOString() : null,
      };
      const { error } = await (supabase as any).from("videos").update(payload).eq("id", video.id);
      if (error) throw error;
      toast.success("Saved");
      onDone(); onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-magma">
        <DialogHeader><DialogTitle className="magma-gradient-text">Edit video</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Description" />
          <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="Thumbnail URL" />
          {isAdmin && (
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full p-2 rounded-md bg-background border border-border text-sm">
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
              <option value="suspended">Suspended</option>
            </select>
          )}
          {status === "scheduled" && (
            <div>
              <label className="text-xs text-muted-foreground">Publish at</label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPremiere} onChange={(e) => setIsPremiere(e.target.checked)} />
            Premiere mode
          </label>
          {isPremiere && (
            <Input type="datetime-local" value={premiereAt} onChange={(e) => setPremiereAt(e.target.value)} />
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={save} disabled={busy} className="flex-1 magma-gradient text-primary-foreground">{busy ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------------- Player Dialog ----------------
const PlayerDialog = ({ video, myUserId, profiles, onClose }: { video: VideoRow; myUserId?: string; profiles: Record<string, any>; onClose: () => void }) => {
  const [comments, setComments] = useState<{ id: string; author_id: string; content: string; created_at: string }[]>([]);
  const [newComment, setNewComment] = useState("");
  const viewBumpedRef = useRef(false);

  useEffect(() => {
    if (viewBumpedRef.current) return;
    viewBumpedRef.current = true;
    (supabase as any).rpc; // noop
    (async () => {
      await (supabase as any).from("videos").update({ views_count: video.views_count + 1 }).eq("id", video.id);
    })();
  }, [video.id]);

  const loadComments = async () => {
    const { data } = await (supabase as any).from("video_comments").select("*").eq("video_id", video.id).order("created_at", { ascending: true });
    setComments((data ?? []) as any);
  };
  useEffect(() => {
    loadComments();
    const ch = supabase.channel(`vc-${video.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "video_comments", filter: `video_id=eq.${video.id}` }, loadComments)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [video.id]);

  const send = async () => {
    if (!myUserId || !newComment.trim()) return;
    const c = newComment.trim(); setNewComment("");
    await (supabase as any).from("video_comments").insert({ video_id: video.id, author_id: myUserId, content: c });
  };

  const author = profiles[video.author_id];
  const [showEmbed, setShowEmbed] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedCode = `<iframe src="${origin}/embed/v/${video.id}" width="100%" height="${video.kind === "short" ? 720 : 405}" style="border:0;border-radius:12px;max-width:${video.kind === "short" ? 405 : 720}px" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${video.title.replace(/"/g, "&quot;")} · MSocialVideos"></iframe>`;
  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success("Embed HTML copied!");
    } catch {
      toast.error("Copy failed — select the code manually");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto scrollbar-magma p-0">
        <button onClick={onClose} className="absolute top-3 right-3 z-10 p-2 rounded-full bg-background/80 hover:bg-background"><X size={16}/></button>
        <div className="bg-black">
          <MagmaVideoPlayer
            src={video.video_url}
            poster={video.thumbnail_url}
            title={video.title}
            vertical={video.kind === "short"}
            autoPlay
          />
        </div>
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{video.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {author?.display_name || "Unknown"} · {video.views_count + 1} views · {fmtTime(video.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" className="glass-panel" onClick={() => setShowEmbed((s) => !s)}>
              <Code2 size={14} className="mr-1.5" /> Embed
            </Button>
            <Button size="sm" className="magma-gradient text-primary-foreground" onClick={copyEmbed}>
              <Copy size={14} className="mr-1.5" /> Copy HTML embed
            </Button>
          </div>
          {showEmbed && (
            <div className="space-y-2">
              <pre className="glass-panel rounded-lg p-3 text-[11px] leading-relaxed text-foreground/90 overflow-x-auto scrollbar-magma"><code>{embedCode}</code></pre>
              <p className="text-[11px] text-muted-foreground">
                Paste this on any site — it renders the modern MSocialVideos player with settings and a “Watch On MSocialVideos” button.
              </p>
            </div>
          )}
          {video.description && (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap glass-panel p-3 rounded-lg">{video.description}</p>
          )}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><MessageCircle size={14}/>{comments.length} comments</h3>
            {myUserId && (
              <div className="flex gap-2 mb-3">
                <Input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Add a comment..." />
                <Button onClick={send} size="icon" className="magma-gradient text-primary-foreground"><Send size={14}/></Button>
              </div>
            )}
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-magma">
              <AnimatePresence>
                {comments.map((c) => {
                  const a = profiles[c.author_id];
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      className="flex gap-2 p-2 rounded-lg glass-panel">
                      <div className="w-8 h-8 rounded-full magma-gradient flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">
                        {a?.avatar_initials ?? "??"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs"><span className="font-semibold">{a?.display_name || "Unknown"}</span> <span className="text-muted-foreground">· {fmtTime(c.created_at)}</span></p>
                        <p className="text-sm text-foreground break-words">{c.content}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MSocialVideos;