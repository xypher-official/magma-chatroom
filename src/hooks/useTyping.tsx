import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Realtime typing indicator via Supabase broadcast (no DB writes).
 * - `channelKey`: stable identifier (e.g. `dm-<convId>` or `grp-<gid>-<chId>`).
 * - Consumers call `sendTyping()` on every keystroke; it self-throttles.
 * - `typing` is a de-duplicated list of `{ userId, name }` currently typing.
 */
export const useTyping = (
  channelKey: string | null | undefined,
  myUserId: string | undefined,
  myName: string | undefined,
) => {
  const [typing, setTyping] = useState<Array<{ userId: string; name: string }>>([]);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentRef = useRef(0);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!channelKey || !myUserId) return;
    const ch = supabase.channel(`typing:${channelKey}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "typing" }, (msg) => {
      const p = (msg as any).payload as { userId: string; name: string } | undefined;
      if (!p || p.userId === myUserId) return;
      setTyping((prev) => {
        if (prev.some((x) => x.userId === p.userId)) return prev;
        return [...prev, { userId: p.userId, name: p.name }];
      });
      if (timersRef.current[p.userId]) clearTimeout(timersRef.current[p.userId]);
      timersRef.current[p.userId] = setTimeout(() => {
        setTyping((prev) => prev.filter((x) => x.userId !== p.userId));
        delete timersRef.current[p.userId];
      }, 4000);
    }).subscribe();
    chanRef.current = ch;
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
      setTyping([]);
      supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [channelKey, myUserId]);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentRef.current < 1500) return;
    lastSentRef.current = now;
    const ch = chanRef.current;
    if (!ch || !myUserId) return;
    ch.send({ type: "broadcast", event: "typing", payload: { userId: myUserId, name: myName ?? "Someone" } });
  }, [myUserId, myName]);

  return { typing, sendTyping };
};