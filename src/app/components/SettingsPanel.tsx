import { useState } from "react";
import {
  X,
  Monitor,
  Wifi,
  Palette,
  AppWindow,
  User,
  Clock,
  Gamepad2,
  Accessibility,
  ShieldCheck,
  RefreshCw,
  Bluetooth,
  ChevronRight,
  Sun,
  Volume2,
  Bell,
  Zap,
  HardDrive,
  Search,
} from "lucide-react";

const MONO = "'Space Mono', monospace";
const GROTESK = "'Space Grotesk', sans-serif";

type Category = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const categories: Category[] = [
  { id: "system", label: "System", icon: <Monitor size={16} /> },
  { id: "bluetooth", label: "Bluetooth & devices", icon: <Bluetooth size={16} /> },
  { id: "network", label: "Network & internet", icon: <Wifi size={16} /> },
  { id: "personalization", label: "Personalization", icon: <Palette size={16} /> },
  { id: "apps", label: "Apps", icon: <AppWindow size={16} /> },
  { id: "accounts", label: "Accounts", icon: <User size={16} /> },
  { id: "time", label: "Time & language", icon: <Clock size={16} /> },
  { id: "gaming", label: "Gaming", icon: <Gamepad2 size={16} /> },
  { id: "accessibility", label: "Accessibility", icon: <Accessibility size={16} /> },
  { id: "privacy", label: "Privacy & security", icon: <ShieldCheck size={16} /> },
  { id: "update", label: "Windows Update", icon: <RefreshCw size={16} /> },
];

function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3.5 rounded-lg hover:brightness-110 transition-all cursor-pointer"
      style={{ background: "#1a2640" }}
    >
      <div>
        <p className="text-[#c5d5ea]" style={{ fontSize: "13px", fontFamily: GROTESK }}>
          {label}
        </p>
        {description && (
          <p className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>
            {description}
          </p>
        )}
      </div>
      {control}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="relative inline-flex items-center shrink-0"
      style={{ width: "44px", height: "24px" }}
    >
      <div
        className="absolute inset-0 rounded-full transition-colors duration-200"
        style={{ background: on ? "#3a6fff" : "#2a3a55" }}
      />
      <div
        className="absolute w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function SliderControl({ value, label }: { value: number; label: string }) {
  const [v, setV] = useState(value);
  return (
    <div className="flex items-center gap-3">
      <span className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        className="w-28 accent-[#3a6fff]"
      />
      <span className="text-[#7eb5f5] w-8 text-right" style={{ fontSize: "11px", fontFamily: MONO }}>{v}%</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p
      className="text-[#4a6080] tracking-widest uppercase mb-2"
      style={{ fontSize: "9px", fontFamily: MONO }}
    >
      {title}
    </p>
  );
}

// ─── Content panes ───────────────────────────────────────────────────────────

function SystemContent() {
  const [nightLight, setNightLight] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [powerSave, setPowerSave] = useState(true);

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div
        className="rounded-xl p-5 flex items-center gap-5"
        style={{ background: "linear-gradient(135deg, #162035 0%, #1a2e50 100%)" }}
      >
        <Monitor size={40} className="text-[#3a6fff]" />
        <div>
          <p className="text-[#c5d5ea]" style={{ fontSize: "15px" }}>RUNA-UNIT04</p>
          <p className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>
            Windows 11 Pro · Version 24H2 · Build 26100
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <SectionHeader title="Display" />
        <SettingRow
          label="Brightness"
          description="Adjust display brightness"
          control={<SliderControl value={72} label="" />}
        />
        <SettingRow
          label="Night light"
          description="Warmer colors to reduce eye strain"
          control={<Toggle on={nightLight} onToggle={() => setNightLight(v => !v)} />}
        />
        <SettingRow
          label="Display resolution"
          description="1920 × 1080 (Recommended)"
          control={<ChevronRight size={16} className="text-[#4a6080]" />}
        />
      </div>

      <div className="space-y-1.5">
        <SectionHeader title="Sound" />
        <SettingRow
          label="Volume"
          description="Master output level"
          control={<SliderControl value={60} label="" />}
        />
        <SettingRow
          label="Output device"
          description="RUNA Lab Speakers (High Definition Audio)"
          control={<ChevronRight size={16} className="text-[#4a6080]" />}
        />
      </div>

      <div className="space-y-1.5">
        <SectionHeader title="Notifications" />
        <SettingRow
          label="Notifications"
          description="Get notifications from apps and system"
          control={<Toggle on={notifications} onToggle={() => setNotifications(v => !v)} />}
        />
        <SettingRow
          label="Do not disturb"
          description="Silence all notifications"
          control={<Toggle on={doNotDisturb} onToggle={() => setDoNotDisturb(v => !v)} />}
        />
      </div>

      <div className="space-y-1.5">
        <SectionHeader title="Power & battery" />
        <SettingRow
          label="Power mode"
          description="Power saver"
          control={<Toggle on={powerSave} onToggle={() => setPowerSave(v => !v)} />}
        />
        <SettingRow
          label="Screen timeout"
          description="After 15 minutes"
          control={<ChevronRight size={16} className="text-[#4a6080]" />}
        />
      </div>

      <div className="space-y-1.5">
        <SectionHeader title="Storage" />
        <div className="rounded-lg p-4 space-y-3" style={{ background: "#1a2640" }}>
          {[
            { label: "System", pct: 28, color: "#3a6fff" },
            { label: "Apps", pct: 15, color: "#4a6fa5" },
            { label: "Temp files", pct: 8, color: "#e8821a" },
            { label: "Free", pct: 49, color: "#2a3a55" },
          ].map((seg) => (
            <div key={seg.label}>
              <div className="flex justify-between mb-1">
                <span className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>{seg.label}</span>
                <span className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>{seg.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#0d1320" }}>
                <div className="h-full rounded-full" style={{ width: `${seg.pct}%`, background: seg.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NetworkContent() {
  const [vpn, setVpn] = useState(false);
  const [proxy, setProxy] = useState(false);
  const [metered, setMetered] = useState(false);

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-5 flex items-center gap-4" style={{ background: "#162035" }}>
        <div className="w-12 h-12 rounded-full bg-[#3a6fff]/20 flex items-center justify-center">
          <Wifi size={22} className="text-[#3a6fff]" />
        </div>
        <div>
          <p className="text-[#c5d5ea]" style={{ fontSize: "14px" }}>RUNA-GUEST-SECURE</p>
          <p className="text-[#3a6fff]" style={{ fontSize: "11px", fontFamily: MONO }}>Connected · 5 GHz · WPA3</p>
        </div>
        <div className="ml-auto">
          <span className="px-3 py-1 rounded-full text-[#3a6fff] border border-[#3a6fff]/40" style={{ fontSize: "10px", fontFamily: MONO }}>SECURED</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <SectionHeader title="Wi-Fi" />
        {["RUNA-FACULTY-5G", "RUNA-LAB-SECURE", "RUNA-ADMIN"].map((net) => (
          <SettingRow
            key={net}
            label={net}
            description="WPA2 · Available"
            control={<ChevronRight size={16} className="text-[#4a6080]" />}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <SectionHeader title="Advanced" />
        <SettingRow label="VPN" description="Not connected" control={<Toggle on={vpn} onToggle={() => setVpn(v => !v)} />} />
        <SettingRow label="Proxy" description="Manual proxy setup" control={<Toggle on={proxy} onToggle={() => setProxy(v => !v)} />} />
        <SettingRow label="Metered connection" description="Limit background data" control={<Toggle on={metered} onToggle={() => setMetered(v => !v)} />} />
        <SettingRow label="IP address" description="192.168.10.42 (IPv4)" control={<ChevronRight size={16} className="text-[#4a6080]" />} />
        <SettingRow label="DNS server" description="8.8.8.8 · 8.8.4.4" control={<ChevronRight size={16} className="text-[#4a6080]" />} />
      </div>
    </div>
  );
}

function PersonalizationContent() {
  const [darkMode] = useState(true);
  const [transparency, setTransparency] = useState(true);
  const [animations, setAnimations] = useState(true);
  const themes = ["Midnight Navy", "Carbon Dark", "Slate Pro", "Ocean Deep", "Terminal Green"];
  const [activeTheme, setActiveTheme] = useState("Midnight Navy");
  const colors = ["#3a6fff", "#e8821a", "#e05c6a", "#4ac77e", "#9b6dff", "#f5c842"];
  const [activeColor, setActiveColor] = useState("#3a6fff");

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <SectionHeader title="Theme" />
        <div className="grid grid-cols-5 gap-2">
          {themes.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTheme(t)}
              className="rounded-lg p-2 text-center transition-all border"
              style={{
                background: "#1a2640",
                borderColor: activeTheme === t ? "#3a6fff" : "transparent",
                fontSize: "9px",
                fontFamily: MONO,
                color: activeTheme === t ? "#7eb5f5" : "#4a6080",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <SectionHeader title="Accent color" />
        <div className="flex gap-2 flex-wrap">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              className="w-8 h-8 rounded-full transition-all"
              style={{
                background: c,
                outline: activeColor === c ? `3px solid ${c}` : "none",
                outlineOffset: "2px",
              }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <SectionHeader title="Appearance" />
        <SettingRow label="Dark mode" description="System-wide dark appearance" control={<Toggle on={darkMode} onToggle={() => {}} />} />
        <SettingRow label="Transparency effects" description="Acrylic and frosted glass" control={<Toggle on={transparency} onToggle={() => setTransparency(v => !v)} />} />
        <SettingRow label="Animation effects" description="Smooth transitions and effects" control={<Toggle on={animations} onToggle={() => setAnimations(v => !v)} />} />
        <SettingRow label="Font size" description="100% (Default)" control={<ChevronRight size={16} className="text-[#4a6080]" />} />
        <SettingRow label="Taskbar behaviors" description="Auto-hide, position, alignment" control={<ChevronRight size={16} className="text-[#4a6080]" />} />
      </div>

      <div className="space-y-1.5">
        <SectionHeader title="Lock screen" />
        <SettingRow label="Lock screen background" description="Spotlight" control={<ChevronRight size={16} className="text-[#4a6080]" />} />
        <SettingRow label="Screen saver" description="None" control={<ChevronRight size={16} className="text-[#4a6080]" />} />
      </div>
    </div>
  );
}

function AboutContent() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl p-6 flex items-center gap-6" style={{ background: "#162035" }}>
        <div className="w-16 h-16 rounded-xl bg-[#3a6fff]/20 flex items-center justify-center">
          <Monitor size={32} className="text-[#3a6fff]" />
        </div>
        <div>
          <p className="text-[#c5d5ea]" style={{ fontSize: "18px" }}>RUNA-UNIT04</p>
          <p className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>Windows 11 Pro for Workstations</p>
          <p className="text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>Verified RUNA Laboratory Asset</p>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: "#1a2640" }}>
        {[
          ["Device name", "RUNA-UNIT04"],
          ["Processor", "Intel Core i7-12700H @ 2.30 GHz"],
          ["Installed RAM", "16.0 GB (15.8 GB usable)"],
          ["Device ID", "A4F2-BB91-3C77-E901"],
          ["Product ID", "00330-80000-00000-AA454"],
          ["System type", "64-bit OS, x64-based processor"],
          ["Edition", "Windows 11 Pro · Version 24H2"],
          ["OS build", "26100.2894"],
        ].map(([label, value], i) => (
          <div
            key={label}
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: i < 7 ? "1px solid #0d1320" : "none" }}
          >
            <span className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>{label}</span>
            <span className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GenericContent({ category }: { category: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center" style={{ background: "#162035", minHeight: "200px" }}>
        <div className="w-12 h-12 rounded-full bg-[#3a6fff]/20 flex items-center justify-center">
          <RefreshCw size={22} className="text-[#3a6fff]" />
        </div>
        <p className="text-[#c5d5ea]" style={{ fontSize: "14px" }}>{category}</p>
        <p className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>Settings for this section are managed by RUNA IT Department</p>
      </div>
      {[1, 2, 3].map((i) => (
        <SettingRow key={i} label={`Setting option ${i}`} description="Configured by administrator" control={<ChevronRight size={16} className="text-[#4a6080]" />} />
      ))}
    </div>
  );
}

// ─── Main Settings Panel ──────────────────────────────────────────────────────

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState("system");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = categories.filter((c) =>
    c.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function renderContent() {
    switch (activeCategory) {
      case "system": return <SystemContent />;
      case "network": return <NetworkContent />;
      case "personalization": return <PersonalizationContent />;
      case "privacy": return <AboutContent />;
      default: return <GenericContent category={categories.find(c => c.id === activeCategory)?.label ?? ""} />;
    }
  }

  const activeLabel = categories.find((c) => c.id === activeCategory)?.label ?? "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex rounded-xl overflow-hidden shadow-2xl"
        style={{
          width: "min(900px, 95vw)",
          height: "min(620px, 90vh)",
          background: "#0d1320",
          border: "1px solid #1e2e48",
          fontFamily: GROTESK,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Sidebar */}
        <div
          className="flex flex-col shrink-0 pt-5 pb-4"
          style={{ width: "220px", background: "#0a1020", borderRight: "1px solid #1a2640" }}
        >
          {/* Title */}
          <div className="px-5 mb-4 flex items-center justify-between">
            <span className="text-[#c5d5ea]" style={{ fontSize: "16px" }}>Settings</span>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#1a2640] text-[#4a6080] hover:text-[#c5d5ea] transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 mb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "#162035", border: "1px solid #1e2e48" }}>
              <Search size={12} className="text-[#4a6080] shrink-0" />
              <input
                type="text"
                placeholder="Search settings"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[#c5d5ea] placeholder-[#4a6080]"
                style={{ fontSize: "12px", fontFamily: MONO }}
              />
            </div>
          </div>

          {/* User card */}
          <div className="mx-3 mb-3 flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#162035] transition-colors">
            <div className="w-9 h-9 rounded-full bg-[#3a6fff] flex items-center justify-center shrink-0">
              <User size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>J. Doe</p>
              <p className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>j.doe@runa.edu.ph</p>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {filtered.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left"
                style={{
                  background: activeCategory === cat.id ? "#1e3055" : "transparent",
                  color: activeCategory === cat.id ? "#7eb5f5" : "#4a6080",
                  fontSize: "12px",
                  border: activeCategory === cat.id ? "1px solid #2a3a55" : "1px solid transparent",
                }}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content header */}
          <div className="px-7 pt-6 pb-4 shrink-0 flex items-center gap-3" style={{ borderBottom: "1px solid #1a2640" }}>
            <div className="w-8 h-8 rounded-lg bg-[#3a6fff]/20 flex items-center justify-center">
              {categories.find((c) => c.id === activeCategory)?.icon}
            </div>
            <p className="text-[#c5d5ea]" style={{ fontSize: "18px" }}>{activeLabel}</p>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-7 py-5">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}