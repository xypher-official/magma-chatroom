import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import originalLogo from "@/assets/app-logos/magma-original.png.asset.json";
import maxLogo from "@/assets/app-logos/magma-messages.webp.asset.json";
import rainbowLogo from "@/assets/app-logos/magma-rainbow.webp.asset.json";
import messagesLogo from "@/assets/app-logos/magma-max.png.asset.json";
import winterLogo from "@/assets/app-logos/magma-winter.png.asset.json";
import plusLogo from "@/assets/app-logos/magma-plus.png.asset.json";

// Winter edition: only logo available until January 7, 2027 (inclusive, local time).
export const WINTER_LOGO_UNTIL = new Date(2027, 0, 8);
export const isWinterLogoActive = (now = new Date()) => now < WINTER_LOGO_UNTIL;

const STORAGE_KEY = "magma.app-logo";

const logoOptions = [
  { id: "original", label: "Original", src: originalLogo.url },
  { id: "max", label: "MAX", src: maxLogo.url },
  { id: "rainbow", label: "Arcoíris", src: rainbowLogo.url },
  { id: "messages", label: "Mensajes", src: messagesLogo.url },
  { id: "plus", label: "Plus", src: plusLogo.url },
] as const;

const getSavedLogo = () => {
  if (typeof window === "undefined") return "original";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return logoOptions.some((option) => option.id === saved) ? saved : "original";
};

const AppLogoPicker = () => {
  const [selectedId, setSelectedId] = useState(getSavedLogo);
  const [open, setOpen] = useState(false);
  const selectedLogo = useMemo(
    () => logoOptions.find((option) => option.id === selectedId) ?? logoOptions[0],
    [selectedId],
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, selectedId);
  }, [selectedId]);

  if (isWinterLogoActive()) {
    return (
      <motion.img
        initial={{ opacity: 0, scale: 0.82, rotate: -5 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        src={winterLogo.url}
        alt="Logo Magma Chat Room edición invierno"
        className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover shadow-sm"
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="group relative h-11 w-11 shrink-0 rounded-lg p-0 hover:bg-primary/10"
          aria-label={`Cambiar logo. Actual: ${selectedLogo.label}`}
        >
          <motion.img
            key={selectedLogo.id}
            initial={{ opacity: 0, scale: 0.82, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            src={selectedLogo.src}
            alt={`Logo ${selectedLogo.label}`}
            className="h-10 w-10 rounded-lg border border-border object-cover shadow-sm"
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm group-hover:text-primary">
            <ChevronDown className="h-2.5 w-2.5" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[min(19rem,calc(100vw-1.5rem))] rounded-lg p-3">
        <div className="mb-3">
          <p className="text-sm font-semibold text-foreground">Elige tu logo</p>
          <p className="text-xs text-muted-foreground">Se guardará en este dispositivo.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {logoOptions.map((option) => {
            const selected = option.id === selectedId;
            return (
              <Button
                key={option.id}
                type="button"
                variant="ghost"
                onClick={() => {
                  setSelectedId(option.id);
                  setOpen(false);
                }}
                className={`relative h-auto min-w-0 flex-col gap-1.5 rounded-lg border p-2 ${
                  selected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"
                }`}
                aria-pressed={selected}
              >
                <img src={option.src} alt="" className="aspect-square w-full rounded-md object-cover" />
                <span className="w-full truncate text-[11px] text-foreground">{option.label}</span>
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AppLogoPicker;