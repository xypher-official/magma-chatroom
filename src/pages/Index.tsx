import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import LavaParticles from "@/components/LavaParticles";
import AuthPage from "@/components/AuthPage";
import ChatSidebar, { type ContactRow, type GroupRow } from "@/components/ChatSidebar";
import ChatWindow, { type MessageRow } from "@/components/ChatWindow";
import EmptyChat from "@/components/EmptyChat";
import AdminPanel from "@/components/AdminPanel";
import NewChatDialog from "@/components/NewChatDialog";
import NewGroupDialog from "@/components/NewGroupDialog";
import SettingsDialog from "@/components/SettingsDialog";
import GroupChatWindow from "@/components/GroupChatWindow";
import GroupManageDialog from "@/components/GroupManageDialog";
import SiteBanner from "@/components/SiteBanner";
import LiveEventBar from "@/components/LiveEventBar";
import SitePagesMenu from "@/components/SitePagesMenu";
import CallOverlay from "@/components/CallOverlay";
import SiteEffectsLayer from "@/components/SiteEffectsLayer";
import GroupInvitesInbox from "@/components/GroupInvitesInbox";
import InviteToGroupDialog from "@/components/InviteToGroupDialog";
import Email2FAGate, { passed2FA, consume2FA } from "@/components/Email2FAGate";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";

interface Profile {
  user_id: string; username: string; display_name: string; avatar_initials: string;
  is_verified: boolean; is_banned: boolean; is_official: boolean; allow_dms?: boolean;
  avatar_url?: string | null;
  email?: string | null; email_verified_at?: string | null;
}
interface GroupInfo { id: string; name: string; description: string; avatar_initials: string; avatar_url?: string | null; owner_id: string; last_message_at: string; write_mode?: string }

const formatTime = (iso: string) => {
  const d = new Date(iso); const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.floor((+now - +d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
};

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [conversations, setConversations] = useState<{ id: string; user_a: string; user_b: string; last_message_at: string }[]>([]);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, MessageRow[]>>({});
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeGroupRole, setActiveGroupRole] = useState<"owner" | "moderator" | "member" | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGroupManage, setShowGroupManage] = useState(false);
  const [inviteToGroup, setInviteToGroup] = useState<{ id: string; name: string } | null>(null);
  const bootstrappedRef = useRef(false);
  const [twoFaOk, setTwoFaOk] = useState(false);

  const call = useWebRTCCall(session?.user.id);

  useNotifications(session?.user.id, isAdmin, activeConv, profiles as any);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) setTwoFaOk(false);
    });
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // If the user already passed 2FA this session, honor it on reload.
  useEffect(() => {
    if (session?.user.id && passed2FA(session.user.id)) setTwoFaOk(true);
  }, [session]);

  const need2FA = !!(session && myProfile?.email && myProfile?.email_verified_at && !twoFaOk);

  useEffect(() => {
    if (!session || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    supabase.functions.invoke("admin-actions", { body: { action: "bootstrap_support_for_me" } }).catch(() => {});
  }, [session]);

  const loadMe = useCallback(async () => {
    if (!session) return;
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", session.user.id),
    ]);
    if (p) setMyProfile(p as Profile);
    setIsAdmin((roles ?? []).some((r: any) => r.role === "admin"));
  }, [session]);
  useEffect(() => { loadMe(); }, [loadMe]);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) {
      const map: Record<string, Profile> = {};
      for (const p of data as Profile[]) map[p.user_id] = p;
      setProfiles(map);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("conversations").select("*")
      .or(`user_a.eq.${session.user.id},user_b.eq.${session.user.id}`)
      .order("last_message_at", { ascending: false });
    if (data) setConversations(data as any);
  }, [session]);

  const loadGroups = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("groups").select("*").order("last_message_at", { ascending: false });
    setGroups((data as GroupInfo[]) ?? []);
    if (data && data.length) {
      const ids = (data as GroupInfo[]).map((g) => g.id);
      const { data: members } = await supabase.from("group_members").select("group_id").in("group_id", ids);
      const counts: Record<string, number> = {};
      for (const m of members ?? []) counts[(m as any).group_id] = (counts[(m as any).group_id] ?? 0) + 1;
      setGroupCounts(counts);
    } else { setGroupCounts({}); }
  }, [session]);

  useEffect(() => { loadProfiles(); loadConversations(); loadGroups(); }, [loadProfiles, loadConversations, loadGroups, session]);

  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel("magma-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadProfiles())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadConversations())
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => loadGroups())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => loadGroups())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as MessageRow;
        setMessagesByConv((prev) => {
          const list = prev[m.conversation_id] ?? [];
          if (list.some((x) => x.id === m.id)) return prev;
          return { ...prev, [m.conversation_id]: [...list, m] };
        });
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, loadProfiles, loadConversations, loadGroups]);

  useEffect(() => {
    if (!activeConv) return;
    supabase.from("messages").select("*").eq("conversation_id", activeConv).order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setMessagesByConv((prev) => ({ ...prev, [activeConv]: data as MessageRow[] })); });
  }, [activeConv]);

  const contacts: ContactRow[] = useMemo(() => {
    if (!session) return [];
    return conversations.map((c) => {
      const otherId = c.user_a === session.user.id ? c.user_b : c.user_a;
      const p = profiles[otherId]; if (!p) return null;
      const lastMsgs = messagesByConv[c.id] ?? [];
      const last = lastMsgs[lastMsgs.length - 1];
      return {
        id: c.id, otherUserId: otherId, name: p.display_name, avatar: p.avatar_initials,
        isVerified: p.is_verified, isOfficial: p.is_official,
        lastMessage: last?.content ?? "—",
        time: formatTime(c.last_message_at), online: true,
      } as ContactRow;
    }).filter(Boolean) as ContactRow[];
  }, [conversations, profiles, session, messagesByConv]);

  const groupRows: GroupRow[] = useMemo(() => groups.map((g) => ({
    id: g.id, name: g.name, avatar: g.avatar_initials,
    lastMessage: g.description || "—",
    time: formatTime(g.last_message_at), memberCount: groupCounts[g.id] ?? 0,
  })), [groups, groupCounts]);

  const activeConvData = activeConv ? conversations.find((c) => c.id === activeConv) : null;
  const otherProfile = activeConvData && session
    ? profiles[activeConvData.user_a === session.user.id ? activeConvData.user_b : activeConvData.user_a]
    : null;
  const isSupportConv = !!otherProfile?.is_official;
  const activeGroupData = activeGroup ? groups.find((g) => g.id === activeGroup) : null;

  const handleSendMessage = useCallback(async (text: string, mediaUrl?: string | null, mediaType?: string | null) => {
    if (!activeConv || !session) return;
    const { error } = await supabase.from("messages")
      .insert({ conversation_id: activeConv, sender_id: session.user.id, content: text, media_url: mediaUrl ?? null, media_type: mediaType ?? null });
    if (error) {
      toast.error(error.message.includes("conversation_has_official") ? "Read-only channel 🔒" : error.message);
    } else {
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", activeConv);
    }
  }, [activeConv, session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMyProfile(null); setIsAdmin(false); setActiveConv(null); setActiveGroup(null);
    setConversations([]); setMessagesByConv({}); setGroups([]); bootstrappedRef.current = false;
  };

  const showRightPane = activeConv || activeGroup;

  // Profiles map for CallOverlay
  const profilesForCall = useMemo(() => {
    const m: Record<string, { display_name: string; avatar_initials: string; avatar_url?: string | null }> = {};
    Object.values(profiles).forEach((p) => { m[p.user_id] = { display_name: p.display_name, avatar_initials: p.avatar_initials, avatar_url: p.avatar_url }; });
    return m;
  }, [profiles]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <LavaParticles />
      <SiteEffectsLayer />
      <AnimatePresence mode="wait">
        {!session ? (
          <motion.div key="auth" exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
            <AuthPage />
          </motion.div>
        ) : (
          <motion.div key="chat" initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }} className="relative z-10 h-screen flex flex-col">
            <SitePagesMenu isAdmin={isAdmin} onEditCms={() => setShowAdmin(true)} />
            <SiteBanner />
            <LiveEventBar />
            <div className="flex-1 flex min-h-0">
              <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 ${showRightPane ? "hidden md:block" : "block"}`}>
                <ChatSidebar
                  contacts={contacts} groups={groupRows}
                  activeContact={activeConv} activeGroup={activeGroup}
                  onSelectContact={(id) => { setActiveGroup(null); setActiveConv(id); }}
                  onSelectGroup={(id) => { setActiveConv(null); setActiveGroup(id); setActiveGroupRole(null); }}
                  onLogout={handleLogout}
                  currentUser={myProfile?.display_name ?? session.user.email ?? ""}
                  isAdmin={isAdmin} isVerified={!!myProfile?.is_verified}
                  onOpenAdmin={() => setShowAdmin(true)}
                  onNewChat={() => setShowNewChat(true)}
                  onNewGroup={() => setShowNewGroup(true)}
                  onOpenSettings={() => setShowSettings(true)}
                />
              </div>
              <div className={`flex-1 ${!showRightPane ? "hidden md:block" : "block"}`}>
                {activeGroupData && session ? (
                  <GroupChatWindow
                    group={activeGroupData} myUserId={session.user.id} isAdmin={isAdmin}
                    profiles={profiles}
                    onBack={() => setActiveGroup(null)}
                    onOpenManage={() => setShowGroupManage(true)}
                    onMyRoleResolved={setActiveGroupRole}
                  />
                ) : otherProfile ? (
                  <ChatWindow
                    contactName={otherProfile.display_name}
                    contactAvatar={otherProfile.avatar_initials}
                    contactAvatarUrl={otherProfile.avatar_url}
                    contactOnline={true}
                    contactIsVerified={otherProfile.is_verified}
                    contactIsOfficial={otherProfile.is_official}
                    contactUserId={otherProfile.user_id}
                    messages={messagesByConv[activeConv!] ?? []} myUserId={session.user.id} profiles={profiles}
                    readOnly={isSupportConv && !isAdmin}
                    canDeleteMessages={isAdmin}
                    onSendMessage={handleSendMessage}
                    onBack={() => setActiveConv(null)}
                    onStartCall={(uid, type) => call.startCall(uid, type)}
                  />
                ) : (
                  <EmptyChat />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call overlay (always mounted when session exists) */}
      {session && (
        <CallOverlay call={call} profiles={profilesForCall} myUserId={session.user.id} />
      )}

      {showAdmin && isAdmin && <AdminPanel onClose={() => setShowAdmin(false)} profiles={Object.values(profiles)} />}
      {showNewChat && session && (
        <NewChatDialog onClose={() => setShowNewChat(false)}
          onCreated={(id) => { setShowNewChat(false); setActiveGroup(null); setActiveConv(id); loadConversations(); }}
          myUserId={session.user.id} profiles={Object.values(profiles)} existingConversations={conversations} />
      )}
      {showNewGroup && session && (
        <NewGroupDialog onClose={() => setShowNewGroup(false)}
          onCreated={(id) => {
            setShowNewGroup(false); setActiveConv(null); setActiveGroup(id);
            loadGroups();
            const g = groups.find(x => x.id === id);
            setInviteToGroup({ id, name: g?.name ?? "el grupo" });
          }}
          myUserId={session.user.id} profiles={Object.values(profiles)} />
      )}
      {inviteToGroup && session && (
        <InviteToGroupDialog open={!!inviteToGroup}
          groupId={inviteToGroup.id} groupName={inviteToGroup.name}
          myUserId={session.user.id} profiles={Object.values(profiles)}
          conversations={conversations}
          onClose={() => setInviteToGroup(null)} />
      )}
      {session && <GroupInvitesInbox myUserId={session.user.id} onJoined={loadGroups} />}
      {need2FA && session && myProfile?.email && (
        <Email2FAGate
          userId={session.user.id}
          email={myProfile.email}
          onPass={() => setTwoFaOk(true)}
          onCancel={async () => { consume2FA(session.user.id); await supabase.auth.signOut(); }}
        />
      )}
      {showSettings && session && myProfile && (
        <SettingsDialog onClose={() => setShowSettings(false)} myUserId={session.user.id}
          displayName={myProfile.display_name} allowDms={myProfile.allow_dms ?? true}
          avatarUrl={myProfile.avatar_url} avatarInitials={myProfile.avatar_initials}
          onUpdated={loadMe} onLogout={handleLogout} />
      )}
      {showGroupManage && session && activeGroupData && (
        <GroupManageDialog
          group={activeGroupData} myUserId={session.user.id}
          myRole={isAdmin ? "owner" : activeGroupRole}
          onClose={() => setShowGroupManage(false)}
          onUpdated={() => { loadGroups(); }}
          onDeleted={() => { setActiveGroup(null); loadGroups(); }}
        />
      )}
    </div>
  );
};

export default Index;
