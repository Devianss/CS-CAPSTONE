import { useState, useRef, useEffect } from "react";
import {
  X,
  Minus,
  Square,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Search,
  MoreHorizontal,
  Folder,
  FolderOpen,
  File,
  GitBranch,
  Play,
  Bug,
  Terminal as TerminalIcon,
  Globe,
  Lock,
  Star,
  BookOpen,
  Clock,
  Wifi,
  Code2,
  CheckCircle,
  AlertCircle,
  Circle,
  ChevronDown,
} from "lucide-react";

const MONO = "'Space Mono', monospace";
const GROTESK = "'Space Grotesk', sans-serif";

// ─── Window Chrome (title bar) ────────────────────────────────────────────────

function WindowBar({
  title,
  icon,
  accentColor = "#3a6fff",
}: {
  title: string;
  icon: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div
      className="flex items-center px-4 h-9 shrink-0 select-none"
      style={{ background: "#0a1020", borderBottom: "1px solid #1a2640" }}
    >
      <div className="flex items-center gap-2 flex-1">
        <span style={{ color: accentColor }}>{icon}</span>
        <span className="text-[#c5d5ea]" style={{ fontSize: "12px", fontFamily: MONO }}>
          {title}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {[Minus, Square].map((Icon, i) => (
          <button
            key={i}
            className="w-6 h-6 rounded flex items-center justify-center text-[#4a6080] hover:bg-[#1a2640] hover:text-[#c5d5ea] transition-colors"
          >
            <Icon size={10} />
          </button>
        ))}
        <button className="w-6 h-6 rounded flex items-center justify-center text-[#4a6080] hover:bg-[#e05c6a] hover:text-white transition-colors">
          <X size={10} />
        </button>
      </div>
    </div>
  );
}

// ─── VS CODE ─────────────────────────────────────────────────────────────────

const vsFiles = [
  { name: "sentinel_auth.py", ext: "py" },
  { name: "dashboard.tsx", ext: "tsx" },
  { name: "network_monitor.py", ext: "py" },
  { name: "README.md", ext: "md" },
];

const codeSnippets: Record<string, string[]> = {
  "sentinel_auth.py": [
    "import hashlib, hmac, os",
    "from datetime import datetime, timedelta",
    "",
    "class RunaAuth:",
    '    SECRET_KEY = os.environ.get("RUNA_SECRET_KEY")',
    "    SESSION_DURATION = timedelta(hours=2, minutes=45)",
    "",
    "    def authenticate(self, email: str, password: str) -> dict:",
    '        """Authenticate a RUNA lab user."""',
    "        hashed = self._hash_password(password)",
    "        user = self._lookup_user(email, hashed)",
    "        if not user:",
    '            raise AuthError("Invalid credentials")',
    "        return self._create_session(user)",
    "",
    "    def _create_session(self, user: dict) -> dict:",
    "        token = hmac.new(",
    "            self.SECRET_KEY.encode(),",
    "            user['id'].encode(),",
    '            hashlib.sha256).hexdigest()',
    "        expires = datetime.utcnow() + self.SESSION_DURATION",
    "        return {'token': token, 'expires': expires.isoformat()}",
  ],
  "dashboard.tsx": [
    'import { useState, useEffect } from "react";',
    'import { Shield, Settings, Bell } from "lucide-react";',
    "",
    "const INITIAL_SECONDS = 2 * 3600 + 45 * 60;",
    "",
    "export function Dashboard() {",
    "  const [secondsLeft, setSecondsLeft] = useState(INITIAL_SECONDS);",
    "  const [activeApp, setActiveApp] = useState('projects');",
    "",
    "  useEffect(() => {",
    "    const timer = setInterval(() => {",
    "      setSecondsLeft(s => s > 0 ? s - 1 : 0);",
    "    }, 1000);",
    "    return () => clearInterval(timer);",
    "  }, []);",
    "",
    "  return (",
    '    <div className="flex flex-col min-h-screen"',
    '      style={{ background: "#0d1320" }}>',
    "      {/* ... */}",
    "    </div>",
    "  );",
    "}",
  ],
  "network_monitor.py": [
    "import psutil, socket, time",
    "from dataclasses import dataclass",
    "",
    "@dataclass",
    "class NetworkStats:",
    "    ssid: str",
    "    signal: int",
    "    bytes_sent: int",
    "    bytes_recv: int",
    "    latency_ms: float",
    "",
    "def monitor_connection() -> NetworkStats:",
    '    """Live network monitoring for RUNA lab."""',
    "    ifaces = psutil.net_io_counters(pernic=True)",
    '    wifi = ifaces.get("Wi-Fi", ifaces.get("wlan0"))',
    "    latency = _ping_gateway()",
    "    return NetworkStats(",
    '        ssid="RUNA-GUEST-SECURE",',
    "        signal=-52,",
    "        bytes_sent=wifi.bytes_sent,",
    "        bytes_recv=wifi.bytes_recv,",
    "        latency_ms=latency,",
    "    )",
  ],
  "README.md": [
    "# RUNA Laboratory Runa",
    "",
    "## Overview",
    "Secure cyber-physical lab interface for RUNA Systems.",
    "",
    "## Features",
    "- Authenticated session management (2h 45m)",
    "- AES-256 encrypted access codes",
    "- Real-time CPU & memory monitoring",
    "- Network connection tracking",
    "- System log & audit trail",
    "",
    "## Stack",
    "- Frontend: React 18 + TypeScript + Tailwind CSS",
    "- Auth: JWT + HMAC-SHA256",
    "- Backend: FastAPI + PostgreSQL",
    "",
    "## Setup",
    "```bash",
    "npm install",
    "npm run dev",
    "```",
  ],
};

const tokenColors: Record<string, string> = {
  keyword: "#cc99cd",
  string: "#7ec699",
  comment: "#5c6370",
  number: "#d19a66",
  fn: "#61afef",
  type: "#e5c07b",
  punct: "#abb2bf",
};

function colorize(line: string, ext: string) {
  if (ext === "md") {
    if (line.startsWith("# ")) return <span style={{ color: "#7eb5f5" }}>{line}</span>;
    if (line.startsWith("## ")) return <span style={{ color: "#7eb5f5" }}>{line}</span>;
    if (line.startsWith("- ")) return <span style={{ color: "#c5d5ea" }}>{line}</span>;
    if (line.startsWith("```")) return <span style={{ color: tokenColors.comment }}>{line}</span>;
    return <span style={{ color: tokenColors.punct }}>{line}</span>;
  }
  if (line.trim().startsWith("#") && (ext === "py")) {
    return <span style={{ color: tokenColors.comment }}>{line}</span>;
  }
  if (line.trim().startsWith("//") || line.trim().startsWith("{/*")) {
    return <span style={{ color: tokenColors.comment }}>{line}</span>;
  }
  let result = line;
  const kwPy = ["import ", "from ", "class ", "def ", "return ", "if ", "not ", "raise "];
  const kwTs = ["import ", "export ", "const ", "function ", "return ", "useState", "useEffect"];
  const kws = ext === "py" ? kwPy : kwTs;
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let anyMatch = false;
  for (const kw of kws) {
    if (remaining.includes(kw)) {
      anyMatch = true;
      break;
    }
  }
  if (anyMatch || line.includes('"') || line.includes("'")) {
    return (
      <span>
        {line.split(/(".*?"|'.*?')/g).map((seg, i) =>
          (seg.startsWith('"') || seg.startsWith("'")) ? (
            <span key={i} style={{ color: tokenColors.string }}>{seg}</span>
          ) : (
            <span key={i} style={{ color: tokenColors.punct }}>
              {seg.split(/(import|from|class|def |return|const|export|function|useEffect|useState|if |not |raise )/g).map((s, j) =>
                ["import","from","class","def ","return","const","export","function","useEffect","useState","if ","not ","raise "].includes(s) ? (
                  <span key={j} style={{ color: tokenColors.keyword }}>{s}</span>
                ) : (
                  <span key={j}>{s}</span>
                )
              )}
            </span>
          )
        )}
      </span>
    );
  }
  return <span style={{ color: tokenColors.punct }}>{line || " "}</span>;
}

export function VSCodeWindow() {
  const [activeFile, setActiveFile] = useState("sentinel_auth.py");
  const [openFiles, setOpenFiles] = useState(["sentinel_auth.py", "dashboard.tsx"]);
  const ext = activeFile.split(".").pop() ?? "py";
  const lines = codeSnippets[activeFile] ?? [];

  const openFile = (name: string) => {
    setActiveFile(name);
    if (!openFiles.includes(name)) setOpenFiles((f) => [...f, name]);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#1e1e2e", fontFamily: MONO }}>
      <WindowBar title={`${activeFile} — RUNA Runa — Visual Studio Code`} icon={<Code2 size={14} />} accentColor="#4fc3f7" />

      {/* Tabs */}
      <div className="flex items-center overflow-x-auto shrink-0" style={{ background: "#252535", borderBottom: "1px solid #1a1a2e" }}>
        {openFiles.map((f) => (
          <div
            key={f}
            onClick={() => setActiveFile(f)}
            className="flex items-center gap-2 px-4 py-2 cursor-pointer shrink-0 border-r border-[#1a1a2e] group"
            style={{
              background: activeFile === f ? "#1e1e2e" : "transparent",
              borderTop: activeFile === f ? "1px solid #4fc3f7" : "1px solid transparent",
            }}
          >
            <span style={{ color: activeFile === f ? "#c5d5ea" : "#6a7a90", fontSize: "11px" }}>{f}</span>
            <button
              className="opacity-0 group-hover:opacity-100 text-[#4a6080] hover:text-[#c5d5ea] transition-all"
              onClick={(e) => {
                e.stopPropagation();
                const next = openFiles.filter((x) => x !== f);
                setOpenFiles(next);
                if (activeFile === f) setActiveFile(next[0] ?? "");
              }}
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Activity bar */}
        <div className="w-10 flex flex-col items-center pt-3 gap-4 shrink-0" style={{ background: "#1a1a2e" }}>
          {[FolderOpen, GitBranch, Search, Bug].map((Icon, i) => (
            <button key={i} className="text-[#4a6080] hover:text-[#c5d5ea] transition-colors">
              <Icon size={18} />
            </button>
          ))}
        </div>

        {/* File explorer */}
        <div className="w-40 shrink-0 pt-2 overflow-y-auto" style={{ background: "#1c1c2e", borderRight: "1px solid #1a1a2e" }}>
          <p className="px-3 pb-1 text-[#4a6080] uppercase tracking-widest" style={{ fontSize: "9px" }}>Explorer</p>
          <p className="px-3 pb-1 text-[#6a7a90] uppercase tracking-widest" style={{ fontSize: "9px" }}>RUNA-SENTINEL</p>
          {vsFiles.map((f) => (
            <button
              key={f.name}
              onClick={() => openFile(f.name)}
              className="w-full flex items-center gap-2 px-4 py-1 text-left hover:bg-[#2a2a3e] transition-colors"
              style={{
                background: activeFile === f.name ? "#2a2a4e" : "transparent",
                color: activeFile === f.name ? "#c5d5ea" : "#6a7a90",
                fontSize: "11px",
              }}
            >
              <File size={12} />
              {f.name}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto p-4" style={{ background: "#1e1e2e" }}>
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-[#ffffff08] group">
                  <td
                    className="select-none pr-4 text-right w-8 shrink-0"
                    style={{ color: "#4a5568", fontSize: "12px", userSelect: "none" }}
                  >
                    {i + 1}
                  </td>
                  <td style={{ fontSize: "12px", whiteSpace: "pre" }}>
                    {colorize(line, ext)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 h-6 shrink-0" style={{ background: "#007acc", fontSize: "10px", color: "white" }}>
        <div className="flex items-center gap-3">
          <span>⎇ main</span>
          <span>✓ 0 errors</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Python 3.11</span>
          <span>UTF-8</span>
          <span>LF</span>
          <span>Ln {lines.length}, Col 1</span>
        </div>
      </div>
    </div>
  );
}

// ─── INTELLIJ ─────────────────────────────────────────────────────────────────

export function IntelliJWindow() {
  const [activeFile, setActiveFile] = useState("RunaAuth.java");
  const javaFiles = ["RunaAuth.java", "NetworkMonitor.java", "DashboardController.java", "pom.xml"];
  const javaCode = [
    "package edu.runa.sentinel.auth;",
    "",
    "import org.springframework.stereotype.Service;",
    "import org.springframework.security.crypto.bcrypt.BCrypt;",
    "import java.util.UUID;",
    "",
    "@Service",
    "public class RunaAuth {",
    "",
    "    private static final int SESSION_HOURS = 2;",
    "    private static final int SESSION_MINUTES = 45;",
    "",
    "    public SessionToken authenticate(",
    "            String email, String rawPassword) {",
    "        User user = userRepo.findByEmail(email)",
    "            .orElseThrow(() -> new AuthException(",
    '                "Invalid credentials"));',
    "        if (!BCrypt.checkpw(rawPassword, user.getHash())) {",
    '            throw new AuthException("Invalid credentials");',
    "        }",
    "        return createSession(user);",
    "    }",
    "",
    "    private SessionToken createSession(User user) {",
    "        String token = UUID.randomUUID().toString();",
    "        LocalDateTime exp = LocalDateTime.now()",
    "            .plusHours(SESSION_HOURS)",
    "            .plusMinutes(SESSION_MINUTES);",
    "        return new SessionToken(token, exp);",
    "    }",
    "}",
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "#1a1a2e", fontFamily: MONO }}>
      <WindowBar
        title="RunaAuth.java — runa-sentinel [main] — IntelliJ IDEA"
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="14" rx="2" />
            <line x1="7" y1="8" x2="11" y2="8" />
            <line x1="7" y1="12" x2="13" y2="12" />
          </svg>
        }
        accentColor="#e8821a"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 h-8 shrink-0" style={{ background: "#141424", borderBottom: "1px solid #0d0d1e" }}>
        {[Play, Bug, RefreshCw].map((Icon, i) => (
          <button key={i} className="w-6 h-6 flex items-center justify-center text-[#4a6080] hover:text-[#c5d5ea] hover:bg-[#2a2a3e] rounded transition-colors">
            <Icon size={13} />
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[#4a6080]" style={{ fontSize: "10px" }}>runa-sentinel — main</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Project panel */}
        <div className="w-44 shrink-0 pt-2 overflow-y-auto" style={{ background: "#141424", borderRight: "1px solid #0d0d1e" }}>
          <p className="px-3 pb-2 text-[#4a6080] uppercase tracking-widest" style={{ fontSize: "9px" }}>Project</p>
          <div className="px-2">
            <div className="flex items-center gap-1 px-2 py-1 text-[#7eb5f5]" style={{ fontSize: "11px" }}>
              <FolderOpen size={12} /> <span>runa-sentinel</span>
            </div>
            <div className="pl-4">
              <div className="flex items-center gap-1 px-2 py-0.5 text-[#6a7a90]" style={{ fontSize: "10px" }}>
                <Folder size={11} /> <span>src/main/java</span>
              </div>
              <div className="pl-4">
                {javaFiles.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFile(f)}
                    className="w-full flex items-center gap-1 px-2 py-0.5 text-left rounded transition-colors"
                    style={{
                      color: activeFile === f ? "#c5d5ea" : "#6a7a90",
                      background: activeFile === f ? "#2a2a4e" : "transparent",
                      fontSize: "10px",
                    }}
                  >
                    <File size={10} />{f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto" style={{ background: "#1a1a2e" }}>
          {/* Tab */}
          <div className="flex items-center px-2 pt-1 shrink-0" style={{ background: "#141424" }}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-t" style={{ background: "#1a1a2e", borderTop: "2px solid #e8821a", fontSize: "11px", color: "#c5d5ea" }}>
              <File size={11} />{activeFile}
            </div>
          </div>
          <div className="p-4">
            <table className="w-full border-collapse">
              <tbody>
                {javaCode.map((line, i) => (
                  <tr key={i} className="hover:bg-[#ffffff06]">
                    <td className="pr-4 text-right w-8 select-none" style={{ color: "#4a5568", fontSize: "12px" }}>{i + 1}</td>
                    <td style={{ fontSize: "12px", whiteSpace: "pre" }}>
                      {colorize(line, "java")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 h-6 shrink-0" style={{ background: "#e8821a", fontSize: "10px", color: "white" }}>
        <div className="flex items-center gap-3">
          <span>⎇ main</span>
          <span>0 warnings</span>
        </div>
        <span>Java 17 · UTF-8 · LF</span>
      </div>
    </div>
  );
}

// ─── CHROME ──────────────────────────────────────────────────────────────────

const bookmarks = ["Gmail", "Google Drive", "RUNA Portal", "GitHub", "Stack Overflow"];

export function ChromeWindow() {
  const [url, setUrl] = useState("https://portal.runa.edu.ph/lab/sentinel");
  const [inputUrl, setInputUrl] = useState(url);
  const [tabs, setTabs] = useState([
    { id: 1, title: "RUNA Lab Portal", url: "https://portal.runa.edu.ph/lab/sentinel", favicon: "🖥️" },
    { id: 2, title: "GitHub - runa-sentinel", url: "https://github.com/runa/sentinel", favicon: "🐙" },
    { id: 3, title: "Google", url: "https://google.com", favicon: "🔍" },
  ]);
  const [activeTab, setActiveTab] = useState(1);

  return (
    <div className="flex flex-col h-full" style={{ background: "#ffffff", fontFamily: GROTESK }}>
      {/* Chrome window bar */}
      <div className="flex items-end px-2 pt-2 gap-0.5 shrink-0" style={{ background: "#dee1e6" }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer max-w-[180px] group"
            style={{
              background: activeTab === tab.id ? "white" : "transparent",
              minWidth: "120px",
              fontSize: "11px",
              color: activeTab === tab.id ? "#202124" : "#5f6368",
            }}
          >
            <span>{tab.favicon}</span>
            <span className="flex-1 truncate">{tab.title}</span>
            <button
              className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#e0e0e0] transition-all"
              onClick={(e) => {
                e.stopPropagation();
                setTabs((t) => t.filter((x) => x.id !== tab.id));
              }}
            >
              <X size={9} />
            </button>
          </div>
        ))}
        <button className="w-6 h-6 flex items-center justify-center text-[#5f6368] hover:bg-[#cbcdd2] rounded-full mb-1 ml-1">
          <span style={{ fontSize: "18px", lineHeight: 1 }}>+</span>
        </button>
        {/* Window controls */}
        <div className="flex-1" />
        <div className="flex items-center gap-1 mb-2 mr-1">
          {[Minus, Square, X].map((Icon, i) => (
            <button key={i} className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#cbcdd2] text-[#5f6368] transition-colors">
              <Icon size={10} />
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ background: "#dee1e6" }}>
        <div className="flex items-center gap-1">
          {[ChevronLeft, ChevronRight, RefreshCw].map((Icon, i) => (
            <button key={i} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#cbcdd2] text-[#5f6368] transition-colors">
              <Icon size={15} />
            </button>
          ))}
        </div>

        {/* URL bar */}
        <form
          className="flex-1 flex items-center gap-2 px-3 h-8 rounded-full"
          style={{ background: "white", border: "1px solid #d2d2d2" }}
          onSubmit={(e) => { e.preventDefault(); setUrl(inputUrl); }}
        >
          <Lock size={12} className="text-[#5f6368] shrink-0" />
          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 outline-none text-[#202124]"
            style={{ fontSize: "13px", background: "transparent" }}
          />
          <Star size={13} className="text-[#5f6368] shrink-0" />
        </form>

        <div className="flex items-center gap-1">
          <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#cbcdd2] text-[#5f6368]">
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>

      {/* Bookmarks bar */}
      <div className="flex items-center gap-1 px-3 py-1 shrink-0" style={{ background: "#f1f3f4", borderBottom: "1px solid #d2d2d2" }}>
        {bookmarks.map((bm) => (
          <button key={bm} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#e0e0e0] transition-colors text-[#3c4043]" style={{ fontSize: "11px" }}>
            {bm}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto" style={{ background: "#f8f9fa" }}>
        {/* Fake PCU portal */}
        <div className="p-0">
          {/* Nav */}
          <div className="flex items-center justify-between px-6 py-3" style={{ background: "#0d1320" }}>
            <span className="text-[#7eb5f5]" style={{ fontFamily: MONO, fontSize: "13px" }}>RUNA Lab Portal</span>
            <div className="flex items-center gap-4">
              <span className="text-[#4a6080]" style={{ fontSize: "12px" }}>Dashboard</span>
              <span className="text-[#4a6080]" style={{ fontSize: "12px" }}>Resources</span>
              <span className="text-[#4a6080]" style={{ fontSize: "12px" }}>Support</span>
              <div className="w-7 h-7 rounded-full bg-[#3a6fff] flex items-center justify-center text-white" style={{ fontSize: "11px" }}>JD</div>
            </div>
          </div>

          {/* Hero */}
          <div className="px-8 py-10" style={{ background: "linear-gradient(135deg, #162035 0%, #0d1a30 100%)" }}>
            <p className="text-[#4a6080] mb-2" style={{ fontFamily: MONO, fontSize: "10px" }}>AUTHENTICATED · SESSION ACTIVE</p>
            <h1 className="text-[#c5d5ea] mb-1" style={{ fontSize: "28px" }}>Welcome back, J. Doe</h1>
            <p className="text-[#4a6080]" style={{ fontSize: "13px" }}>RUNA Systems — Computer Lab 04 · Runa Unit</p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-3 gap-4 p-6">
            {[
              { title: "Active Sessions", value: "1", sub: "This device", color: "#3a6fff" },
              { title: "Lab Resources", value: "12", sub: "Available now", color: "#4ac77e" },
              { title: "Announcements", value: "3", sub: "Unread notices", color: "#e8821a" },
            ].map((card) => (
              <div key={card.title} className="rounded-xl p-5 border" style={{ background: "white", borderColor: "#e0e0e0" }}>
                <p style={{ color: "#9aa0a6", fontSize: "11px" }}>{card.title}</p>
                <p style={{ color: card.color, fontSize: "28px", fontWeight: "bold" }}>{card.value}</p>
                <p style={{ color: "#9aa0a6", fontSize: "11px" }}>{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Announcements */}
          <div className="px-6 pb-6">
            <p className="mb-3" style={{ color: "#3c4043", fontSize: "14px" }}>Recent Announcements</p>
            {[
              { title: "Lab Maintenance Schedule", date: "Mar 24, 2026", badge: "Notice" },
              { title: "New Software Licenses Available", date: "Mar 22, 2026", badge: "Update" },
              { title: "Session Policy Update", date: "Mar 20, 2026", badge: "Policy" },
            ].map((ann) => (
              <div key={ann.title} className="flex items-center justify-between p-4 rounded-xl mb-2 border" style={{ background: "white", borderColor: "#e0e0e0" }}>
                <div>
                  <p style={{ color: "#202124", fontSize: "13px" }}>{ann.title}</p>
                  <p style={{ color: "#9aa0a6", fontSize: "11px" }}>{ann.date}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-white" style={{ background: "#3a6fff", fontSize: "9px" }}>{ann.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TERMINAL ─────────────────────────────────────────────────────────────────

const FAKE_RESPONSES: Record<string, string[]> = {
  help: [
    "Available commands:",
    "  ls          List directory contents",
    "  pwd         Print working directory",
    "  whoami      Current user",
    "  date        Current date and time",
    "  uname       System information",
    "  ping        Test network connectivity",
    "  top         System resource usage",
    "  clear       Clear terminal",
    "  help        Show this help message",
  ],
  ls: [
    "\x1b[34mDocuments\x1b[0m   \x1b[34mDownloads\x1b[0m   \x1b[34mProjects\x1b[0m",
    "README.md   sentinel_auth.py   dashboard.tsx",
  ],
  pwd: ["/home/jdoe/runa-sentinel"],
  whoami: ["jdoe"],
  date: [new Date().toString()],
  uname: ["Linux RUNA-SENTINEL-UNIT04 6.6.0-runa-lab #1 SMP x86_64 GNU/Linux"],
  ping: [
    "PING 8.8.8.8 (8.8.8.8): 56 data bytes",
    "64 bytes from 8.8.8.8: icmp_seq=0 ttl=119 time=12.4 ms",
    "64 bytes from 8.8.8.8: icmp_seq=1 ttl=119 time=11.9 ms",
    "64 bytes from 8.8.8.8: icmp_seq=2 ttl=119 time=13.1 ms",
    "--- 8.8.8.8 ping statistics ---",
    "3 packets transmitted, 3 received, 0% packet loss",
  ],
  top: [
    "top - 09:14:02 up 4 days, 2:32, 1 user",
    "Tasks: 214 total, 1 running, 213 sleeping",
    "%Cpu(s): 12.4 us, 3.2 sy, 0.0 ni, 82.1 id",
    "MiB Mem: 16384.0 total, 12184.2 free, 4023.8 used",
    "MiB Swap: 2048.0 total, 2048.0 free, 0.0 used",
    "",
    "  PID USER     %CPU %MEM COMMAND",
    " 1234 jdoe     10.2  8.4 node",
    " 5678 jdoe      2.1  2.3 python3",
    "  890 jdoe      0.5  0.8 bash",
  ],
  clear: [],
};

type TermLine = { type: "cmd" | "out" | "err"; text: string };

export function TerminalWindow() {
  const [history, setHistory] = useState<TermLine[]>([
    { type: "out", text: "RUNA Laboratory Runa — Secure Shell v2.4.0" },
    { type: "out", text: "Authenticated as jdoe@runa.edu.ph — Session active" },
    { type: "out", text: 'Type "help" for available commands.' },
    { type: "out", text: "" },
  ]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    const newHistory: TermLine[] = [...history, { type: "cmd", text: cmd }];
    const baseCmd = cmd.split(" ")[0].toLowerCase();

    if (baseCmd === "clear") {
      setHistory([]);
    } else {
      const response = FAKE_RESPONSES[baseCmd];
      if (response) {
        response.forEach((line) => newHistory.push({ type: "out", text: line }));
      } else {
        newHistory.push({ type: "err", text: `bash: ${cmd}: command not found` });
      }
      setHistory(newHistory);
    }

    setCmdHistory((h) => [cmd, ...h]);
    setHistIdx(-1);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      const idx = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(idx);
      setInput(cmdHistory[idx] ?? "");
    } else if (e.key === "ArrowDown") {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? "" : cmdHistory[idx] ?? "");
    }
  };

  return (
    <div
      className="flex flex-col h-full cursor-text"
      style={{ background: "#0d0d0d", fontFamily: MONO }}
      onClick={() => inputRef.current?.focus()}
    >
      <WindowBar title="jdoe@RUNA-SENTINEL-UNIT04: ~/runa-sentinel" icon={<TerminalIcon size={14} />} accentColor="#4ac77e" />

      {/* Terminal tabs */}
      <div className="flex items-center px-2 shrink-0" style={{ background: "#1a1a1a", borderBottom: "1px solid #2a2a2a" }}>
        <div className="flex items-center gap-2 px-3 py-1.5 text-[#c5d5ea] border-b-2 border-[#4ac77e]" style={{ fontSize: "11px" }}>
          <TerminalIcon size={11} />
          bash
        </div>
        <button className="ml-1 w-5 h-5 flex items-center justify-center text-[#4a6080] hover:text-[#c5d5ea]">
          <span style={{ fontSize: "16px" }}>+</span>
        </button>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-auto p-4 space-y-0.5">
        {history.map((line, i) => (
          <div key={i} className="flex items-start">
            {line.type === "cmd" && (
              <>
                <span style={{ color: "#4ac77e", fontSize: "12px" }}>jdoe@runa-sentinel</span>
                <span style={{ color: "#c5d5ea", fontSize: "12px" }}>:</span>
                <span style={{ color: "#4a6fff", fontSize: "12px" }}>~/runa-sentinel</span>
                <span style={{ color: "#c5d5ea", fontSize: "12px" }}>$ </span>
                <span style={{ color: "#c5d5ea", fontSize: "12px" }}>{line.text}</span>
              </>
            )}
            {line.type === "out" && (
              <span style={{ color: "#a0a0a0", fontSize: "12px", whiteSpace: "pre" }}>{line.text || "\u00a0"}</span>
            )}
            {line.type === "err" && (
              <span style={{ color: "#e05c6a", fontSize: "12px" }}>{line.text}</span>
            )}
          </div>
        ))}

        {/* Input line */}
        <form onSubmit={handleSubmit} className="flex items-center">
          <span style={{ color: "#4ac77e", fontSize: "12px" }}>jdoe@runa-sentinel</span>
          <span style={{ color: "#c5d5ea", fontSize: "12px" }}>:</span>
          <span style={{ color: "#4a6fff", fontSize: "12px" }}>~/runa-sentinel</span>
          <span style={{ color: "#c5d5ea", fontSize: "12px" }}>$ </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none caret-[#4ac77e]"
            style={{ color: "#c5d5ea", fontSize: "12px", fontFamily: MONO }}
            autoFocus
            spellCheck={false}
          />
        </form>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

const projects = [
  {
    id: "sentinel",
    name: "RUNA Lab Runa",
    lang: "TypeScript",
    status: "active",
    stars: 12,
    desc: "Secure cyber-physical lab interface with session management.",
    lastEdit: "2 hours ago",
    progress: 78,
  },
  {
    id: "netmon",
    name: "Network Monitor",
    lang: "Python",
    status: "active",
    stars: 8,
    desc: "Real-time network traffic analysis tool for RUNA labs.",
    lastEdit: "1 day ago",
    progress: 60,
  },
  {
    id: "authsvc",
    name: "Auth Service",
    lang: "Java",
    status: "review",
    stars: 5,
    desc: "Spring Boot microservice for JWT-based authentication.",
    lastEdit: "3 days ago",
    progress: 92,
  },
  {
    id: "labapi",
    name: "Lab API Gateway",
    lang: "Go",
    status: "paused",
    stars: 3,
    desc: "High-performance API gateway for RUNA lab services.",
    lastEdit: "1 week ago",
    progress: 35,
  },
  {
    id: "uikit",
    name: "RUNA UI Kit",
    lang: "TypeScript",
    status: "active",
    stars: 7,
    desc: "Shared component library for RUNA sentinel interfaces.",
    lastEdit: "5 hours ago",
    progress: 55,
  },
  {
    id: "docs",
    name: "Lab Documentation",
    lang: "Markdown",
    status: "review",
    stars: 2,
    desc: "Official RUNA lab policies and developer documentation.",
    lastEdit: "2 days ago",
    progress: 80,
  },
];

const statusColors: Record<string, string> = {
  active: "#4ac77e",
  review: "#e8821a",
  paused: "#4a6080",
};

const langColors: Record<string, string> = {
  TypeScript: "#3a6fff",
  Python: "#f5c842",
  Java: "#e8821a",
  Go: "#4ac77e",
  Markdown: "#7eb5f5",
};

export function ProjectsWindow() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = projects.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.desc.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full" style={{ background: "#0d1320", fontFamily: GROTESK }}>
      <WindowBar title="Projects — RUNA Runa" icon={<FolderOpen size={14} />} accentColor="#7eb5f5" />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ background: "#0f1828", borderBottom: "1px solid #1a2640" }}>
        <div className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded-md" style={{ background: "#1a2640", border: "1px solid #2a3a55" }}>
          <Search size={13} className="text-[#4a6080]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="flex-1 bg-transparent outline-none text-[#c5d5ea] placeholder-[#4a6080]"
            style={{ fontSize: "12px", fontFamily: MONO }}
          />
        </div>
        <div className="flex gap-1">
          {["all", "active", "review", "paused"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-md capitalize transition-all"
              style={{
                background: filter === f ? "#1e3055" : "transparent",
                color: filter === f ? "#7eb5f5" : "#4a6080",
                fontSize: "11px",
                fontFamily: MONO,
                border: filter === f ? "1px solid #2a3a55" : "1px solid transparent",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Project grid */}
      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="rounded-xl p-5 border transition-all hover:border-[#3a5a7a] cursor-pointer group"
              style={{ background: "#111d30", borderColor: "#1e2e48" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[#c5d5ea] group-hover:text-[#7eb5f5] transition-colors" style={{ fontSize: "14px" }}>{p.name}</p>
                  <p className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>{p.lastEdit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>
                    <Star size={10} />{p.stars}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full capitalize"
                    style={{
                      background: `${statusColors[p.status]}20`,
                      color: statusColors[p.status],
                      fontSize: "9px",
                      fontFamily: MONO,
                    }}
                  >
                    {p.status}
                  </span>
                </div>
              </div>

              <p className="text-[#4a6080] mb-3" style={{ fontSize: "12px" }}>{p.desc}</p>

              <div className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>Progress</span>
                  <span style={{ color: statusColors[p.status], fontSize: "10px", fontFamily: MONO }}>{p.progress}%</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "#1a2640" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${p.progress}%`, background: statusColors[p.status] }} />
                </div>
              </div>

              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: langColors[p.lang] ?? "#4a6080" }} />
                <span className="text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>{p.lang}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}