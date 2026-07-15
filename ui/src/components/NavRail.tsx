import { useEffect, useCallback } from "react";
import { House, ImagePlus, Workflow, Bot, FolderOpen, Settings, type LucideIcon } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { ENABLE_AGENT_MODE, ENABLE_NODE_MODE } from "../lib/devMode";
import { useI18n } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";
import type { UIMode } from "../types";

/* ── Hash ↔ mode mapping ── */

const HASH_TO_MODE: Record<string, UIMode | "settings"> = {
  "#home": "home",
  "#create": "classic",
  "#canvas": "classic", // canvas-mode is a sub-state of classic for now
  "#node": "node",
  "#agent": "agent",
  "#assets": "assets",
};

const MODE_TO_HASH: Record<string, string> = {
  home: "#home",
  classic: "#create",
  node: "#node",
  agent: "#agent",
  assets: "#assets",
};

function resolveHash(): { mode: UIMode; settings: boolean } | null {
  const h = location.hash;
  if (h === "#settings") return { mode: "classic", settings: true };
  const m = HASH_TO_MODE[h];
  if (m && m !== "settings") return { mode: m, settings: false };
  return null;
}

/* ── Rail items ── */

type RailItem = {
  id: string;
  mode?: UIMode;
  settingsAction?: boolean;
  icon: LucideIcon;
  labelKey: string;
  enabled: boolean;
  bottom?: boolean;
};

const RAIL_ITEMS: RailItem[] = [
  { id: "home", mode: "home", icon: House, labelKey: "nav.home", enabled: true },
  { id: "create", mode: "classic", icon: ImagePlus, labelKey: "nav.create", enabled: true },
  { id: "node", mode: "node", icon: Workflow, labelKey: "nav.node", enabled: ENABLE_NODE_MODE },
  { id: "agent", mode: "agent", icon: Bot, labelKey: "nav.agent", enabled: ENABLE_AGENT_MODE },
  { id: "assets", mode: "assets", icon: FolderOpen, labelKey: "nav.assets", enabled: true },
  { id: "settings", settingsAction: true, icon: Settings, labelKey: "nav.settings", enabled: true, bottom: true },
];

/* ── Component ── */

export function NavRail() {
  const { t } = useI18n();
  const uiMode = useAppStore((s) => s.uiMode);
  const setUIMode = useAppStore((s) => s.setUIMode);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const openSettings = useAppStore((s) => s.openSettings);
  const closeSettings = useAppStore((s) => s.closeSettings);
  const isMobile = useIsMobile();

  const navigate = useCallback((item: RailItem) => {
    if (item.settingsAction) {
      if (settingsOpen) {
        closeSettings();
        history.replaceState(null, "", MODE_TO_HASH[uiMode] || "#create");
      } else {
        openSettings();
        history.replaceState(null, "", "#settings");
      }
      return;
    }
    if (item.mode) {
      if (settingsOpen) closeSettings();
      setUIMode(item.mode);
      history.replaceState(null, "", MODE_TO_HASH[item.mode] || "#create");
    }
  }, [uiMode, settingsOpen, setUIMode, openSettings, closeSettings]);

  // Sync hash → state on mount and popstate
  useEffect(() => {
    const sync = () => {
      const resolved = resolveHash();
      if (!resolved) return;
      if (resolved.settings) {
        openSettings();
      } else {
        if (settingsOpen) closeSettings();
        setUIMode(resolved.mode);
      }
    };
    sync(); // initial
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enabledItems = RAIL_ITEMS.filter((it) => it.enabled);
  const topItems = enabledItems.filter((it) => !it.bottom);
  const bottomItems = enabledItems.filter((it) => it.bottom);

  const isActive = (item: RailItem) => {
    if (item.settingsAction) return settingsOpen;
    return !settingsOpen && item.mode === uiMode;
  };

  const renderItem = (item: RailItem) => (
    <button
      key={item.id}
      type="button"
      className={`nav-rail__btn${isActive(item) ? " is-active" : ""}`}
      onClick={() => navigate(item)}
      aria-label={t(item.labelKey)}
      aria-current={isActive(item) ? "page" : undefined}
      title={t(item.labelKey)}
    >
      <item.icon size={18} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );

  if (isMobile) {
    return (
      <nav className="nav-rail nav-rail--mobile" aria-label={t("nav.ariaLabel")}>
        {enabledItems.map(renderItem)}
      </nav>
    );
  }

  return (
    <nav className="nav-rail" aria-label={t("nav.ariaLabel")}>
      <div className="nav-rail__top">{topItems.map(renderItem)}</div>
      <div className="nav-rail__bottom">{bottomItems.map(renderItem)}</div>
    </nav>
  );
}
