import { lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}

const EmojiPickerPopover = ({ open, onClose, onPick }: Props) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="absolute bottom-16 left-2 z-50 rounded-2xl overflow-hidden shadow-2xl border border-border"
          >
            <Suspense fallback={<div className="w-[320px] h-[400px] bg-card flex items-center justify-center text-muted-foreground text-sm">…</div>}>
              <EmojiPicker
                onEmojiClick={(e) => { onPick(e.emoji); }}
                width={320}
                height={400}
                theme={"dark" as any}
                lazyLoadEmojis
                searchPlaceHolder="Search emoji…"
                previewConfig={{ showPreview: false }}
              />
            </Suspense>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EmojiPickerPopover;