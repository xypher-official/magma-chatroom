import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group magma-toaster"
      position="top-right"
      visibleToasts={4}
      icons={{
        success: <span className="text-base">🌋</span>,
        error: <span className="text-base">🔥</span>,
        info: <span className="text-base">💬</span>,
        warning: <span className="text-base">⚠️</span>,
        loading: <span className="text-base animate-spin">🜂</span>,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group magma-toast relative overflow-hidden !rounded-2xl !border !border-[hsl(24_100%_50%/0.35)] " +
            "!bg-[linear-gradient(135deg,hsl(0_0%_8%/0.92),hsl(0_0%_5%/0.92))] " +
            "!text-foreground backdrop-blur-xl !shadow-[0_10px_40px_-10px_hsl(24_100%_50%/0.55),0_0_0_1px_hsl(0_0%_100%/0.04)_inset] " +
            "!p-4 !gap-3",
          title: "!font-semibold !tracking-tight !text-foreground",
          description: "!text-muted-foreground !text-xs !mt-0.5",
          actionButton:
            "!bg-gradient-to-br !from-[hsl(24_100%_55%)] !to-[hsl(12_90%_50%)] !text-white !rounded-lg !shadow-[0_4px_14px_-4px_hsl(24_100%_50%/0.6)]",
          cancelButton: "!bg-[hsl(0_0%_14%)] !text-muted-foreground !rounded-lg",
          success: "!border-[hsl(24_100%_50%/0.5)]",
          error: "!border-[hsl(0_85%_55%/0.55)]",
          icon: "!text-lg drop-shadow-[0_0_10px_hsl(24_100%_50%/0.7)]",
          closeButton:
            "!bg-[hsl(0_0%_12%)] !border-[hsl(0_0%_18%)] !text-muted-foreground hover:!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
