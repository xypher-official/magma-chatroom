import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LavaParticles from "@/components/LavaParticles";
import AuthPage from "@/components/AuthPage";
import ChatSidebar from "@/components/ChatSidebar";
import ChatWindow from "@/components/ChatWindow";
import EmptyChat from "@/components/EmptyChat";

const DEMO_CONTACTS = [
  { id: "1", name: "Carlos Volcano 🌋", lastMessage: "¡Esa idea está en llamas!", time: "12:45", unread: 3, avatar: "CV", online: true },
  { id: "2", name: "María Fuego 🔥", lastMessage: "Enviame el archivo", time: "11:30", unread: 1, avatar: "MF", online: true },
  { id: "3", name: "Grupo Magma", lastMessage: "Luis: Nos vemos a las 8", time: "10:15", unread: 0, avatar: "GM", online: false },
  { id: "4", name: "Pedro Lava", lastMessage: "Perfecto, gracias!", time: "Ayer", unread: 0, avatar: "PL", online: false },
  { id: "5", name: "Ana Ember ✨", lastMessage: "Foto increíble 📸", time: "Ayer", unread: 5, avatar: "AE", online: true },
  { id: "6", name: "Soporte Magma", lastMessage: "Tu cuenta ha sido verificada", time: "Lun", unread: 0, avatar: "SM", online: false },
];

const DEMO_MESSAGES: Record<string, { id: string; text: string; sender: string; time: string; isOwn: boolean }[]> = {
  "1": [
    { id: "m1", text: "¡Hey! ¿Viste el nuevo diseño? 🔥", sender: "Carlos Volcano", time: "12:40", isOwn: false },
    { id: "m2", text: "Sí, está brutal. Me encanta el tema de magma", sender: "Tú", time: "12:42", isOwn: true },
    { id: "m3", text: "¡Esa idea está en llamas!", sender: "Carlos Volcano", time: "12:45", isOwn: false },
  ],
  "2": [
    { id: "m4", text: "Hola María, ¿cómo estás?", sender: "Tú", time: "11:20", isOwn: true },
    { id: "m5", text: "¡Muy bien! Trabajando en el proyecto", sender: "María Fuego", time: "11:25", isOwn: false },
    { id: "m6", text: "Enviame el archivo", sender: "María Fuego", time: "11:30", isOwn: false },
  ],
  "5": [
    { id: "m7", text: "Mira esta foto del atardecer 🌅", sender: "Ana Ember", time: "18:30", isOwn: false },
    { id: "m8", text: "Foto increíble 📸", sender: "Ana Ember", time: "18:31", isOwn: false },
  ],
};

const Index = () => {
  const [user, setUser] = useState<string | null>(null);
  const [activeContact, setActiveContact] = useState<string | null>(null);
  const [messages, setMessages] = useState(DEMO_MESSAGES);

  const handleSendMessage = useCallback((text: string) => {
    if (!activeContact) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      text,
      sender: "Tú",
      time: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
      isOwn: true,
    };
    setMessages((prev) => ({
      ...prev,
      [activeContact]: [...(prev[activeContact] || []), newMsg],
    }));
  }, [activeContact]);

  const contact = DEMO_CONTACTS.find((c) => c.id === activeContact);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <LavaParticles />

      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div key="auth" exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
            <AuthPage onLogin={setUser} />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 h-screen flex"
          >
            {/* Sidebar - hidden on mobile when chat is open */}
            <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 ${activeContact ? "hidden md:block" : "block"}`}>
              <ChatSidebar
                contacts={DEMO_CONTACTS}
                activeContact={activeContact}
                onSelectContact={setActiveContact}
                onLogout={() => { setUser(null); setActiveContact(null); }}
                currentUser={user}
              />
            </div>

            {/* Chat area */}
            <div className={`flex-1 ${!activeContact ? "hidden md:block" : "block"}`}>
              {contact ? (
                <ChatWindow
                  contactName={contact.name}
                  contactAvatar={contact.avatar}
                  contactOnline={contact.online}
                  messages={messages[activeContact!] || []}
                  onSendMessage={handleSendMessage}
                  onBack={() => setActiveContact(null)}
                />
              ) : (
                <EmptyChat />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
