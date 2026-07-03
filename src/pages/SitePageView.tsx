import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import MSocialVideos from "@/components/MSocialVideos";
import NotFound from "./NotFound";

const ALLOWED_TAGS = ["h1","h2","h3","h4","h5","h6","p","strong","em","ul","ol","li","a","img","blockquote","code","pre","br","hr","span","div","section","article","header","footer","button","figure","figcaption","table","thead","tbody","tr","td","th","iframe","video","source"];
const ALLOWED_ATTR = ["href","target","rel","src","alt","title","class","style","width","height","loading","srcset","sizes","allow","allowfullscreen","frameborder"];

const renderHtml = (raw: string) => {
  const trimmed = (raw ?? "").trim();
  if (/^\s*<[a-zA-Z!]/.test(trimmed)) return DOMPurify.sanitize(trimmed, { ALLOWED_TAGS, ALLOWED_ATTR });
  let html = trimmed
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>");
  if (!/^<h\d|^<p|^<ul|^<ol|^<blockquote/.test(html)) html = `<p>${html}</p>`;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
};

const BUILTIN = new Set(["social/videos"]);

const SitePageView = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const params = useParams();
  const slug = useMemo(() => {
    const raw = (params["*"] ?? loc.pathname.replace(/^\/+/, "")).replace(/\/+$/,"");
    return raw;
  }, [params, loc.pathname]);

  const [status, setStatus] = useState<"loading" | "ok" | "404">("loading");
  const [page, setPage] = useState<any>(null);
  const [me, setMe] = useState<string | undefined>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess?.user?.id;
      setMe(uid);
      if (uid) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
        setIsAdmin(!!roles?.some((r: any) => r.role === "admin" || r.role === "owner"));
      }
      const { data: ps } = await supabase.from("profiles").select("user_id, display_name, avatar_initials, avatar_url");
      const map: Record<string, any> = {};
      (ps ?? []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    })();
  }, []);

  useEffect(() => {
    if (!slug) { setStatus("404"); return; }
    if (BUILTIN.has(slug)) { setStatus("ok"); return; }
    (async () => {
      const { data } = await supabase.from("site_pages").select("*").eq("slug", slug).maybeSingle();
      if (data && (data as any).enabled) { setPage(data); setStatus("ok"); }
      else setStatus("404");
    })();
  }, [slug]);

  // Only auto-translate the title. Content may be raw HTML — translating it
  // through the AI can strip tags or return malformed markup, causing the
  // section body to disappear a few seconds after opening.
  const title = useAutoTranslate(page?.title ?? "");
  const rawContent = page?.content ?? "";
  const isHtml = /^\s*<[a-zA-Z!]/.test(rawContent.trim());
  const translatedText = useAutoTranslate(isHtml ? "" : rawContent);
  const content = isHtml ? rawContent : (translatedText || rawContent);

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>;
  if (status === "404") return <NotFound />;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="max-w-5xl mx-auto flex items-center gap-3 p-3">
          <button onClick={() => nav("/")} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary">
            <ArrowLeft size={18} />
          </button>
          <span className="text-xs text-muted-foreground">/{slug}</span>
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto p-4 md:p-8">
        {slug === "social/videos" ? (
          <MSocialVideos myUserId={me} isAdmin={isAdmin} profiles={profiles} />
        ) : page ? (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl magma-gradient flex items-center justify-center text-2xl">{page.emoji}</div>
              <h1 className="text-2xl md:text-3xl font-bold magma-gradient-text">{title || page.title}</h1>
            </div>
            <article
              className="prose prose-invert prose-sm md:prose-base max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: renderHtml(content) || renderHtml(page.content) || page.content }}
            />
          </div>
        ) : null}
      </motion.div>
    </div>
  );
};

export default SitePageView;
