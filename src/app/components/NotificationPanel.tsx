import { useState, useEffect } from "react";
import {
  Bell,
  X,
  Shield,
  Wifi,
  Monitor,
  AlertTriangle,
  CheckCircle,
  Info,
  Clock,
  Trash2,
  BellOff,
} from "lucide-react";

const MONO = "'Space Mono', monospace";
const GROTESK = "'Space Grotesk', sans-serif";

export type Notification = {
  id: string;
  type: "security" | "network" | "system" | "warning" | "success" | "info";
  title: string;
  message: string;
  time: Date;
  read: boolean;
};

const TYPE_CONFIG = {
  security: { icon: Shield, color: "#e05c6a", bg: "#e05c6a18", label: "Security" },
  network: { icon: Wifi, color: "#4a6fff", bg: "#4a6fff18", label: "Network" },
  system: { icon: Monitor, color: "#7eb5f5", bg: "#7eb5f518", label: "System" },
  warning: { icon: AlertTriangle, color: "#e8821a", bg: "#e8821a18", label: "Warning" },
  success: { icon: CheckCircle, color: "#4ac77e", bg: "#4ac77e18", label: "Success" },
  info: { icon: Info, color: "#4a6fa5", bg: "#4a6fa518", label: "Info" },
};

export const INITIAL_NOTIFICATIONS: Notification[] = [];

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ago`;
}

// ─── Notification Bell Button ─────────────────────────────────────────────────

interface NotificationBellProps {
  notifications: Notification[];
  onOpen: () => void;
}

export function NotificationBell({ notifications, onOpen }: NotificationBellProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <button
      className="relative w-8 h-8 flex items-center justify-center text-[#4a6080] hover:text-[#7eb5f5] transition-colors"
      onClick={onOpen}
      title="Notifications"
    >
      <Bell size={16} />
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white"
          style={{
            background: "#e05c6a",
            fontSize: "8px",
            fontFamily: MONO,
            minWidth: "15px",
            height: "15px",
            padding: "0 3px",
            lineHeight: 1,
          }}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}

// ─── Toast notification (incoming) ───────────────────────────────────────────

interface ToastProps {
  notification: Notification;
  onDismiss: () => void;
}

function Toast({ notification, onDismiss }: ToastProps) {
  const cfg = TYPE_CONFIG[notification.type];
  const Icon = cfg.icon;

  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-lg border shadow-xl animate-slide-in"
      style={{
        background: "#111d30",
        borderColor: cfg.color + "55",
        minWidth: "300px",
        maxWidth: "340px",
        fontFamily: GROTESK,
      }}
    >
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
        style={{ background: cfg.bg }}
      >
        <Icon size={15} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>{notification.title}</p>
        <p className="text-[#4a6080] mt-0.5" style={{ fontSize: "10px", fontFamily: MONO }}>{notification.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-[#4a6080] hover:text-[#c5d5ea] transition-colors shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────

interface NotificationPanelProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

export function NotificationPanel({
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onClearAll,
}: NotificationPanelProps) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = filter === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications;

  return (
    <div
      className="rounded-xl border shadow-2xl flex flex-col w-[360px] max-w-[calc(100vw-2rem)]"
      style={{
        background: "#0f1828",
        borderColor: "#1e2e48",
        maxHeight: "520px",
        fontFamily: GROTESK,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#1a2640] shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-[#7eb5f5]" />
          <span className="text-[#c5d5ea]" style={{ fontSize: "14px" }}>Notifications</span>
          {unreadCount > 0 && (
            <span
              className="flex items-center justify-center rounded-full text-white"
              style={{ background: "#e05c6a", fontSize: "9px", fontFamily: MONO, minWidth: "18px", height: "18px", padding: "0 4px" }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-[#4a6fa5] hover:text-[#7eb5f5] transition-colors"
              style={{ fontSize: "10px", fontFamily: MONO }}
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#1a2640] text-[#4a6080] hover:text-[#c5d5ea] transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1 shrink-0">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-md capitalize transition-all"
            style={{
              background: filter === f ? "#1e3055" : "transparent",
              color: filter === f ? "#7eb5f5" : "#4a6080",
              fontSize: "10px",
              fontFamily: MONO,
              border: filter === f ? "1px solid #2a3a55" : "1px solid transparent",
            }}
          >
            {f} {f === "unread" && unreadCount > 0 ? `(${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <BellOff size={28} className="text-[#2a3a55]" />
            <p className="text-[#4a6080]" style={{ fontSize: "12px", fontFamily: MONO }}>
              {filter === "unread" ? "No unread notifications" : "No notifications"}
            </p>
          </div>
        ) : (
          filtered.map((n) => {
            const cfg = TYPE_CONFIG[n.type];
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                className="flex items-start gap-3 p-3 rounded-lg cursor-pointer group transition-all hover:brightness-110"
                style={{
                  background: n.read ? "#111d30" : "#162035",
                  border: n.read ? "1px solid #1a2640" : `1px solid ${cfg.color}33`,
                }}
                onClick={() => onMarkRead(n.id)}
              >
                {/* Unread dot */}
                <div className="mt-1 shrink-0">
                  {!n.read
                    ? <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                    : <div className="w-2 h-2 rounded-full bg-transparent" />
                  }
                </div>

                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: cfg.bg }}
                >
                  <Icon size={14} style={{ color: cfg.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="text-[#c5d5ea] truncate"
                      style={{ fontSize: "12px", fontWeight: n.read ? "normal" : "bold" }}
                    >
                      {n.title}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                      className="opacity-0 group-hover:opacity-100 text-[#4a6080] hover:text-[#e05c6a] transition-all shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </div>
                  <p className="text-[#4a6080] mt-0.5 line-clamp-2" style={{ fontSize: "10px" }}>
                    {n.message}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={9} className="text-[#2a3a55]" />
                    <span className="text-[#2a3a55]" style={{ fontSize: "9px", fontFamily: MONO }}>
                      {formatRelativeTime(n.time)}
                    </span>
                    <span
                      className="ml-1 px-1.5 py-0.5 rounded"
                      style={{ background: cfg.bg, color: cfg.color, fontSize: "8px", fontFamily: MONO }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div
          className="flex items-center justify-between px-5 py-3 border-t border-[#1a2640] shrink-0"
        >
          <span className="text-[#2a3a55]" style={{ fontSize: "9px", fontFamily: MONO }}>
            {notifications.length} total notification{notifications.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 text-[#4a6080] hover:text-[#e05c6a] transition-colors"
            style={{ fontSize: "10px", fontFamily: MONO }}
          >
            <Trash2 size={11} />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Live pool (used by NotificationProvider) ───────────────────────────────

