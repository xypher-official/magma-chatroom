import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tv, Check, X } from "lucide-react";

const key = (url: string) => `magma.watch-denied:${url}`;

interface Props { url: string; title?: string | null; isOwn: boolean }

/** Interactive Watch Together invitation shown inside chats and groups. */
const WatchInviteCard = ({ url, isOwn }: Props) => {
  const nav = useNavigate();
  const [denied, setDenied] = useState(() => localStorage.getItem(key(url)) === "1");

  if (isOwn) {
    return (
      <button onClick={() => nav(url)}
        className="flex w-full items-center justify-center gap-2 mb-1 px-3 py-2 rounded-xl bg-background/25 text-xs font-semibold">
        <Tv size={14} /> Abrir sala
      </button>
    );
  }
  if (denied) return <p className="mb-1 px-1 text-xs opacity-70">❌ Denied</p>;
  return (
    <div className="flex gap-2 mb-1">
      <button onClick={() => nav(`${url}?accepted=1`)}
        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl magma-gradient text-primary-foreground text-xs font-semibold">
        <Check size={14} /> Allow
      </button>
      <button onClick={() => { localStorage.setItem(key(url), "1"); setDenied(true); }}
        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-destructive/80 text-destructive-foreground text-xs font-semibold">
        <X size={14} /> Denied
      </button>
    </div>
  );
};

export default WatchInviteCard;
