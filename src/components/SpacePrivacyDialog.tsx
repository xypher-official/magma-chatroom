import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CONSENT_KEY = "magma.minicpm-privacy.v1";

export function useSpaceConsent() {
  const [open, setOpen] = useState(false);
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const request = useCallback((): Promise<boolean> => {
    if (localStorage.getItem(CONSENT_KEY) === "accepted") return Promise.resolve(true);
    return new Promise((resolve) => { pending.current = resolve; setOpen(true); });
  }, []);
  const finish = (accepted: boolean) => {
    if (accepted) localStorage.setItem(CONSENT_KEY, "accepted");
    setOpen(false);
    pending.current?.(accepted);
    pending.current = null;
  };
  const dialog = (
    <Dialog open={open} onOpenChange={(next) => { if (!next) finish(false); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Privacidad de MiniCPM</DialogTitle>
          <DialogDescription>
            Tus preguntas, el contexto de la conversación y los adjuntos seleccionados se enviarán al Space público openbmb/MiniCPM-V-4.7-Demo y a su servicio de inferencia. Pueden registrar conversaciones y conservar archivos. No envíes contraseñas, claves ni información confidencial.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => finish(false)}>Cancelar</Button>
          <Button onClick={() => finish(true)}>Aceptar y continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { request, dialog };
}