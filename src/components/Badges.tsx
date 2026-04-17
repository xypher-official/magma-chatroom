import { Crown, BadgeCheck } from "lucide-react";
import { motion } from "framer-motion";

interface BadgesProps {
  isAdmin?: boolean;
  isVerified?: boolean;
  isOfficial?: boolean;
  size?: number;
}

const Badges = ({ isAdmin, isVerified, isOfficial, size = 14 }: BadgesProps) => {
  return (
    <span className="inline-flex items-center gap-1 ml-1 align-middle">
      {isVerified && (
        <motion.span
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300 }}
          title={isOfficial ? "Cuenta oficial" : "Cuenta verificada"}
          className="text-sky-400 drop-shadow-[0_0_4px_hsl(200_100%_60%/0.6)]"
        >
          <BadgeCheck size={size} fill="currentColor" className="text-sky-400" strokeWidth={2} stroke="hsl(var(--background))" />
        </motion.span>
      )}
      {isAdmin && (
        <motion.span
          initial={{ scale: 0, y: -4 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, delay: 0.05 }}
          title="Administrador"
          className="text-amber-400 drop-shadow-[0_0_4px_hsl(40_100%_60%/0.7)]"
        >
          <Crown size={size} fill="currentColor" />
        </motion.span>
      )}
    </span>
  );
};

export default Badges;
