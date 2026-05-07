import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BlockRow { id: string; blocker_id: string; blocked_id: string }

export const useBlocks = (myUserId?: string) => {
  const [blocks, setBlocks] = useState<BlockRow[]>([]);

  const reload = useCallback(async () => {
    if (!myUserId) return;
    const { data } = await supabase.from("user_blocks").select("*")
      .or(`blocker_id.eq.${myUserId},blocked_id.eq.${myUserId}`);
    setBlocks((data as BlockRow[]) ?? []);
  }, [myUserId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!myUserId) return;
    const ch = supabase.channel("blocks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_blocks" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myUserId, reload]);

  const iBlocked = (uid: string) => blocks.some(b => b.blocker_id === myUserId && b.blocked_id === uid);
  const blockedMe = (uid: string) => blocks.some(b => b.blocker_id === uid && b.blocked_id === myUserId);
  const anyBlock = (uid: string) => iBlocked(uid) || blockedMe(uid);

  const block = async (uid: string) => {
    if (!myUserId) return;
    await supabase.from("user_blocks").insert({ blocker_id: myUserId, blocked_id: uid });
    reload();
  };
  const unblock = async (uid: string) => {
    if (!myUserId) return;
    await supabase.from("user_blocks").delete().eq("blocker_id", myUserId).eq("blocked_id", uid);
    reload();
  };

  return { blocks, iBlocked, blockedMe, anyBlock, block, unblock, reload };
};