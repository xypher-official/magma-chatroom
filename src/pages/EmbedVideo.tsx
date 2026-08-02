import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MagmaVideoPlayer from "@/components/MagmaVideoPlayer";
import { Loader2 } from "lucide-react";

type EmbedVideo = {
  id: string; title: string; video_url: string;
  thumbnail_url: string | null; kind: "long" | "short"; status: string;
};

const EmbedVideoPage = () => {
  const { videoId } = useParams();
  const [video, setVideo] = useState<EmbedVideo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let done = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("videos")
        .select("id,title,video_url,thumbnail_url,kind,status")
        .eq("id", videoId)
        .maybeSingle();
      if (done) return;
      setVideo((data as EmbedVideo) ?? null);
      setLoading(false);
      if (data?.id) {
        (supabase as any).from("videos").select("views_count").eq("id", data.id).maybeSingle()
          .then(({ data: v }: any) => {
            if (v) (supabase as any).from("videos").update({ views_count: (v.views_count ?? 0) + 1 }).eq("id", data.id);
          });
      }
    })();
    return () => { done = true; };
  }, [videoId]);

  const watchUrl = `${window.location.origin}/social/videos?v=${videoId}`;

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-black">
      {loading ? (
        <Loader2 className="animate-spin text-primary" size={30} />
      ) : !video || video.status !== "published" ? (
        <div className="p-6 text-center">
          <p className="text-sm text-primary-foreground/80">This video is unavailable.</p>
          <a href={watchUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-block rounded-full magma-gradient px-4 py-2 text-xs font-bold text-primary-foreground">
            Watch On MSocialVideos
          </a>
        </div>
      ) : (
        <MagmaVideoPlayer
          src={video.video_url}
          poster={video.thumbnail_url}
          title={video.title}
          vertical={video.kind === "short"}
          watchUrl={watchUrl}
          className="max-h-screen"
        />
      )}
    </main>
  );
};

export default EmbedVideoPage;