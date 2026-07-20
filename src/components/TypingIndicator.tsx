import { motion } from "framer-motion";

interface Props {
  names: string[];
  className?: string;
}

/** WhatsApp-style typing indicator with animated dots. Localizes:
 *  - 1 person: "X is typing"
 *  - 2 people: "X and Y are typing"
 *  - 3+ people: "Several people are writing" */
const TypingIndicator = ({ names, className }: Props) => {
  if (!names.length) return null;
  const text =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `Several people are writing`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className={`flex items-center gap-2 px-4 py-1.5 text-xs text-primary/90 ${className ?? ""}`}
    >
      <span className="italic truncate max-w-[70%]">{text}</span>
      <span className="flex items-end gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1 h-1 rounded-full bg-primary"
            animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
    </motion.div>
  );
};

export default TypingIndicator;