import { useAutoTranslate } from "@/hooks/useAutoTranslate";

/** Inline auto-translated text. Translates any string to the user's
 * selected language via the translate-text edge function (cached). */
export const T = ({ children, as: As = "span", className }:
  { children: string | null | undefined; as?: any; className?: string }) => {
  const out = useAutoTranslate(children ?? "");
  return <As className={className}>{out || children}</As>;
};

export default T;
