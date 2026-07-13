import { useCallback, useEffect, useState } from "react";

export function usePrivacyPreviewHold(enabled: boolean) {
  const [isHeld, setIsHeld] = useState(false);
  const hide = useCallback(() => setIsHeld(false), []);
  const reveal = useCallback(() => setIsHeld(true), []);

  useEffect(() => {
    if (!enabled) hide();
  }, [enabled, hide]);

  useEffect(() => {
    if (!enabled) return;
    const hideWhenPageIsHidden = () => {
      if (document.hidden) hide();
    };
    window.addEventListener("blur", hide);
    window.addEventListener("pointerup", hide);
    document.addEventListener("visibilitychange", hideWhenPageIsHidden);
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("pointerup", hide);
      document.removeEventListener("visibilitychange", hideWhenPageIsHidden);
    };
  }, [enabled, hide]);

  return { isRevealed: enabled && isHeld, reveal, hide };
}
