import { MapPin, Maximize2 } from "lucide-react";
import { motion } from "framer-motion";

interface Props { url: string; isOwn: boolean; onOpen: () => void; }

/** WhatsApp-style live location preview shown inside a chat bubble. */
const LocationMessageCard = ({ url, isOwn, onOpen }: Props) => (
  <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onOpen}
    className="block w-60 max-w-full mb-1 rounded-xl overflow-hidden border border-border/40 text-left">
    <div className="relative h-32 ember-bg overflow-hidden"
      style={{ backgroundImage: "linear-gradient(hsl(var(--muted-foreground)/0.15) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--muted-foreground)/0.15) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="absolute w-14 h-14 rounded-full bg-primary/30 animate-ping" />
        <span className="relative w-9 h-9 rounded-full magma-gradient flex items-center justify-center magma-glow-sm">
          <MapPin size={18} className="text-primary-foreground" />
        </span>
      </div>
      <span className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/70 text-foreground"><Maximize2 size={12} /></span>
    </div>
    <div className={`px-3 py-2 text-xs ${isOwn ? "bg-background/20" : "bg-muted/40"}`}>
      <p className="font-semibold">📍 Ubicación en tiempo real</p>
      <p className="opacity-70">Toca para ver el mapa</p>
    </div>
    <span className="sr-only">{url}</span>
  </motion.button>
);
export default LocationMessageCard;
