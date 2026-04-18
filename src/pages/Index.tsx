import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import LavaParticles from "@/components/LavaParticles";
import AuthPage from "@/components/AuthPage";
import ChatSidebar, { type ContactRow } from "@/components/ChatSidebar";
import ChatWindow, { type MessageRow } from "@/components/ChatWindow";
import EmptyChat from "@/components/EmptyChat";
import AdminPanel from "@/components/AdminPanel";
import NewChatDialog from "@/components/NewChatDialog";
import SettingsDialog from "@/components/SettingsDialog";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_initials: string;
  is_verified: boolean;
  is_banned: boolean;
  is_official: boolean;
  allow_dms?: boolean;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.floor((+now - +d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString("es", { weekday: "short" });
  return d.toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
};

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [conversations, setConversations] = useState<
    { id: string; user_a: string; user_b: string; last_message_at: string }[]
  >([]);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, MessageRow[]>>({});
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const bootstrappedRef = useRef(false);

  // Auth listener
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Bootstrap on login: ensure support contact exists for me
  useEffect(() => {
    if (!session || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    supabase.functions
      .invoke("admin-actions", { body: { action: "bootstrap_support_for_me" } })
      .catch(() => {});
  }, [session]);

  // Load my profile + role
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

  // Load all profiles (for displaying contact info; RLS allows SELECT all)
  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) {
      const map: Record<string, Profile> = {};
      for (const p of data as Profile[]) map[p.user_id] = p;
      setProfiles(map);
    }
  }, []);

  // Load my conversations
  const loadConversations = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_a.eq.${session.user.id},user_b.eq.${session.user.id}`)
      .order("last_message_at", { ascending: false });
    if (data) setConversations(data as any);
  }, [session]);

  useEffect(() => { loadProfiles(); loadConversations(); }, [loadProfiles, loadConversations, session]);

  // Realtime: profiles, conversations, messages
  useEffect(() => {
    if (!session) return;
    const ch = supabase
      .channel("magma-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadProfiles())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadConversations())
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
  }, [session, loadProfiles, loadConversations]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConv) return;
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeConv)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessagesByConv((prev) => ({ ...prev, [activeConv]: data as MessageRow[] }));
      });
  }, [activeConv]);

  const contacts: ContactRow[] = useMemo(() => {
    if (!session) return [];
    return conversations
      .map((c) => {
        const otherId = c.user_a === session.user.id ? c.user_b : c.user_a;
        const p = profiles[otherId];
        if (!p) return null;
        const lastMsgs = messagesByConv[c.id] ?? [];
        const last = lastMsgs[lastMsgs.length - 1];
        return {
          id: c.id,
          otherUserId: otherId,
          name: p.display_name,
          avatar: p.avatar_initials,
          isVerified: p.is_verified,
          isOfficial: p.is_official,
          lastMessage: last?.content ?? "Inicia la conversación",
          time: formatTime(c.last_message_at),
          online: true,
        } as ContactRow;
      })
      .filter(Boolean) as ContactRow[];
  }, [conversations, profiles, session, messagesByConv]);

  const activeConvData = activeConv ? conversations.find((c) => c.id === activeConv) : null;
  const otherProfile = activeConvData && session
    ? profiles[activeConvData.user_a === session.user.id ? activeConvData.user_b : activeConvData.user_a]
    : null;
  const isSupportConv = !!otherProfile?.is_official;

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!activeConv || !session) return;
      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConv,
        sender_id: session.user.id,
        content: text,
      });
      if (error) {
        toast.error(error.message.includes("conversation_has_official")
          ? "ChatRoom Support es solo lectura 🔒"
          : error.message);
      } else {
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", activeConv);
      }
    },
    [activeConv, session],
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMyProfile(null);
    setIsAdmin(false);
    setActiveConv(null);
    setConversations([]);
    setMessagesByConv({});
    bootstrappedRef.current = false;
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <LavaParticles />
      <AnimatePresence mode="wait">
        {!session ? (
          <motion.div key="auth" exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
            <AuthPage />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 h-screen flex"
          >
            <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 ${activeConv ? "hidden md:block" : "block"}`}>
              <ChatSidebar
                contacts={contacts}
                activeContact={activeConv}
                onSelectContact={setActiveConv}
                onLogout={handleLogout}
                currentUser={myProfile?.display_name ?? session.user.email ?? ""}
                isAdmin={isAdmin}
                isVerified={!!myProfile?.is_verified}
                onOpenAdmin={() => setShowAdmin(true)}
                onNewChat={() => setShowNewChat(true)}
                onOpenSettings={() => setShowSettings(true)}
              />
            </div>
            <div className={`flex-1 ${!activeConv ? "hidden md:block" : "block"}`}>
              {otherProfile ? (
                <ChatWindow
                  contactName={otherProfile.display_name}
                  contactAvatar={otherProfile.avatar_initials}
                  contactOnline={true}
                  contactIsVerified={otherProfile.is_verified}
                  contactIsOfficial={otherProfile.is_official}
                  messages={messagesByConv[activeConv!] ?? []}
                  myUserId={session.user.id}
                  profiles={profiles}
                  readOnly={isSupportConv && !isAdmin}
                  onSendMessage={handleSendMessage}
                  onBack={() => setActiveConv(null)}
                />
              ) : (
                <EmptyChat />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showAdmin && isAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} profiles={Object.values(profiles)} />
      )}
      {showNewChat && session && (
        <NewChatDialog
          onClose={() => setShowNewChat(false)}
          onCreated={(id) => { setShowNewChat(false); setActiveConv(id); loadConversations(); }}
          myUserId={session.user.id}
          profiles={Object.values(profiles)}
          existingConversations={conversations}
        />
      )}
      {showSettings && session && myProfile && (
        <SettingsDialog
          onClose={() => setShowSettings(false)}
          myUserId={session.user.id}
          displayName={myProfile.display_name}
          allowDms={myProfile.allow_dms ?? true}
          onUpdated={loadMe}
        />
      )}
    </div>
  );
};

export default Index;
