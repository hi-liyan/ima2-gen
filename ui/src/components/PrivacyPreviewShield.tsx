import type { KeyboardEvent, PointerEvent } from "react";
import { useI18n } from "../i18n";
import { usePrivacyPreviewHold } from "../hooks/usePrivacyPreviewHold";

type PrivacyPreviewShieldProps = {
  enabled: boolean;
  hold?: PrivacyPreviewHoldState;
  showControl?: boolean;
};

export type PrivacyPreviewHoldState = {
  isRevealed: boolean;
  reveal: () => void;
  hide: () => void;
};

type PrivacyPreviewRevealButtonProps = {
  hold: PrivacyPreviewHoldState;
};

export function PrivacyPreviewRevealButton({ hold }: PrivacyPreviewRevealButtonProps) {
  const { t } = useI18n();

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    hold.reveal();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    event.preventDefault();
    hold.reveal();
  };
  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") hold.hide();
  };

  return (
    <button
      type="button"
      className="action-btn privacy-preview-shield__hold"
      onPointerDown={onPointerDown}
      onPointerUp={hold.hide}
      onPointerCancel={hold.hide}
      onLostPointerCapture={hold.hide}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={hold.hide}
      aria-label={t("privacyPreview.holdAria")}
    >
      {t("privacyPreview.hold")}
    </button>
  );
}

export function PrivacyPreviewShield({
  enabled,
  hold,
  showControl = true,
}: PrivacyPreviewShieldProps) {
  const localHold = usePrivacyPreviewHold(enabled);
  const activeHold = hold ?? localHold;

  if (!enabled) return null;

  return (
    <div className={`privacy-preview-shield${activeHold.isRevealed ? " privacy-preview-shield--revealed" : ""}`}>
      {showControl ? <PrivacyPreviewRevealButton hold={activeHold} /> : null}
    </div>
  );
}
