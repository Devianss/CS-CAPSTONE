/**
 * TitleBar.tsx
 *
 * Custom window titlebar that replaces the native OS chrome.
 * Draggable region + minimize / maximize / close controls.
 * Shown only when running inside Electron (window.electronAPI exists).
 */
import { Minus, Square, X } from "lucide-react";
import { useWindowControls } from "../ipc/useElectron";

const MONO = "'Share Tech Mono', monospace";
const BRAND = "'Orbitron', sans-serif";

interface TitleBarProps {
  title?: string;
}

export function TitleBar({ title = "PCU Lab Portal" }: TitleBarProps) {
  // Only render inside Electron
  if (typeof window === "undefined" || !window.electronAPI) return null;

  const { minimize, maximize, close } = useWindowControls();

  return (
    <div
    style={{
      // -webkit-app-region: drag makes the whole bar draggable in Electron
      WebkitAppRegion: "drag",
      background: "#0a1220",
      borderBottom: "1px solid #1e2e48",
      height: 36,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: 12,
      paddingRight: 0,
      userSelect: "none",
      flexShrink: 0,
    } as any}
  >
      {/* App label */}
      <span
        style={{
          color: "#4a6fa5",
          fontSize: 10,
          fontFamily: MONO,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        ◈ {title}
      </span>

      {/* Window controls — must NOT be draggable */}
      <div
        style={{
          display: "flex",
          WebkitAppRegion: "no-drag",
        } as any}
      >
        <WinBtn icon={<Minus size={10} />} onClick={minimize} hover="#2a3a55" />
        <WinBtn icon={<Square size={9} />} onClick={maximize} hover="#2a3a55" />
        <WinBtn
          icon={<X size={11} />}
          onClick={close}
          hover="#6b1a1a"
          closeBtn
        />
      </div>
    </div>
  );
}

// ── Helper ──────────────────────────────────────────────────────────────────
function WinBtn({
  icon,
  onClick,
  hover,
  closeBtn = false,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  hover: string;
  closeBtn?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 46,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        color: "#4a6080",
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = hover;
        (e.currentTarget as HTMLButtonElement).style.color = closeBtn
          ? "#ff6b6b"
          : "#c5d5ea";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = "#4a6080";
      }}
    >
      {icon}
    </button>
  );
}
