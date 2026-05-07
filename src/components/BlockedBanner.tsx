import { Ban, ShieldOff } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  iBlocked: boolean;
  blockedMe: boolean;
  contactName: string;
  onUnblock: () => void;
}

const BlockedBanner = ({ iBlocked, blockedMe, contactName, onUnblock }: Props) => {
  if (!iBlocked && !blockedMe) return null;
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="px-4 py-3 border-t border-border bg-destructive/10 text-sm text-destructive flex items-center gap-3"
    >
      <Ban size={16} />
      <span className="flex-1">
        {iBlocked
          ? `Has bloqueado a ${contactName}. No podrá escribirte ni tú a él/ella.`
          : `${contactName} te ha bloqueado. No puedes enviar mensajes.`}
      </span>
      {iBlocked && (
        <button onClick={onUnblock}
          className="px-3 py-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive text-xs font-semibold flex items-center gap-1.5">
          <ShieldOff size={12} /> Desbloquear
        </button>
      )}
    </motion.div>
  );
};

export default BlockedBanner;