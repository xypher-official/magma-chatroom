import { motion } from "framer-motion";
import magmaLogo from "@/assets/magma-logo.png";

const EmptyChat = () => (
  <div className="h-full flex flex-col items-center justify-center ember-bg">
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200 }}
      className="text-center"
    >
      <motion.img
        src={magmaLogo}
        alt="Magma"
        width={100}
        height={100}
        className="mx-auto mb-6 opacity-50"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <h2 className="text-2xl font-bold magma-gradient-text mb-2">Magma Chat Room</h2>
      <p className="text-muted-foreground text-sm">Selecciona un chat para comenzar 🌋</p>
    </motion.div>
  </div>
);

export default EmptyChat;
