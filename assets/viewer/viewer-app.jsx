import React, { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const STORAGE_KEY = "migration-viewer.sidebar-width";
const MIN_SIDEBAR = 248;
const MAX_SIDEBAR = 480;

const KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "of",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "yield",
]);

const BUILTINS = new Set([
  "Array",
  "Boolean",
  "Date",
  "Error",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "RegExp",
  "Set",
  "String",
  "console",
  "document",
  "process",
  "window",
]);

const STYLES = `
  :root {
    --bg: #f3f3ef;
    --panel: #ffffff;
    --panel-muted: #f7f7f3;
    --text: #111111;
    --muted: #636363;
    --border: #d7d7d1;
    --border-strong: #b3b3aa;
    --accent: #0f3fd1;
    --accent-soft: #eef3ff;
    --danger-soft: #fff2f0;
    --sidebar-width: 304px;
    --mono: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
    --sans: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  * { box-sizing: border-box; }
  html, body, #root { height: 100%; }
  body {
    margin: 0;
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    overflow: hidden;
  }
  button, input, select { font: inherit; }
  button {
    color: inherit;
    background: none;
  }
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-width) 8px minmax(0, 1fr);
    height: 100vh;
    overflow: hidden;
    position: relative;
  }
  .sidebar {
    background: var(--panel);
    border-right: 1px solid var(--border);
    min-width: 0;
    overflow: hidden;
  }
  .sidebar-scroll {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .sidebar-head {
    padding: 18px 16px 16px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }
  .brand {
    margin-bottom: 18px;
  }
  .brand h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  .brand p {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.55;
  }
  .controls {
    display: grid;
    gap: 10px;
  }
  .field {
    display: grid;
    gap: 6px;
  }
  .field label {
    font-size: 10px;
    color: var(--muted);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .field input,
  .field select {
    width: 100%;
    height: 34px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    padding: 0 12px;
    outline: none;
  }
  .field input:focus,
  .field select:focus {
    border-color: var(--accent);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-top: 1px solid var(--border);
    border-left: 1px solid var(--border);
    margin-top: 14px;
  }
  .stat {
    padding: 10px;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: var(--panel-muted);
  }
  .stat-label {
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .stat-value {
    margin-top: 6px;
    font-size: 20px;
    line-height: 1;
    font-weight: 700;
  }
  .entry-list-wrap {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--panel);
  }
  .entry-list {
    display: grid;
  }
  .entry {
    border: 0;
    border-bottom: 1px solid var(--border);
    border-left: 3px solid transparent;
    text-align: left;
    padding: 11px 14px;
    cursor: pointer;
  }
  .entry:hover {
    background: var(--panel-muted);
  }
  .entry.active {
    background: var(--accent-soft);
    border-left-color: var(--accent);
  }
  .entry-top,
  .entry-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .entry-name,
  .entry-signature,
  .toolbar-meta,
  .badge,
  .code-title,
  .detail-value.mono,
  .chip,
  .ghost-btn {
    font-family: var(--mono);
  }
  .entry-name {
    font-size: 12px;
    font-weight: 700;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .entry-signature {
    margin-top: 6px;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .entry-meta {
    margin-top: 8px;
    color: var(--muted);
    font-size: 10px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 74px;
    border: 1px solid var(--border);
    padding: 2px 6px;
    color: var(--muted);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: var(--panel);
  }
  .badge.migrated,
  .badge.mapped,
  .badge.in_progress {
    border-color: var(--accent);
    color: var(--accent);
  }
  .badge.todo,
  .badge.deferred {
    background: var(--panel-muted);
  }
  .badge.unmapped {
    background: var(--danger-soft);
  }
  .resize-handle {
    cursor: col-resize;
    position: relative;
    background: var(--bg);
    border-right: 1px solid var(--border);
    border-left: 1px solid var(--border);
  }
  .resize-handle::before {
    content: "";
    position: absolute;
    inset: 0;
    width: 2px;
    height: 68px;
    margin: auto;
    background: var(--border-strong);
  }
  .resize-handle:hover::before,
  .resize-handle.is-dragging::before {
    background: var(--accent);
  }
  .content {
    min-width: 0;
    min-height: 0;
    background: var(--bg);
    overflow: hidden;
  }
  .content-scroll {
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0 0 28px;
  }
  .mobile-toolbar {
    display: none;
  }
  .masthead {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    padding: 22px 24px 18px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }
  .eyebrow {
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .masthead h2 {
    margin: 8px 0 0;
    font-size: 26px;
    line-height: 1.1;
    letter-spacing: -0.04em;
  }
  .masthead p {
    margin: 10px 0 0;
    color: var(--muted);
    line-height: 1.5;
    max-width: 960px;
    font-size: 13px;
  }
  .masthead-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .ghost-btn {
    height: 38px;
    border: 1px solid var(--border);
    background: var(--panel);
    padding: 0 12px;
    cursor: pointer;
  }
  .ghost-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .summary-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    margin: 16px 24px 0;
    border-top: 1px solid var(--border);
    border-left: 1px solid var(--border);
  }
  .summary-cell {
    background: var(--panel);
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 10px 12px;
  }
  .summary-label {
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .summary-value {
    margin-top: 6px;
    font-size: 18px;
    font-weight: 700;
  }
  .workspace {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.78fr);
    gap: 16px;
    padding: 18px 24px 0;
    min-width: 0;
  }
  .preview-column,
  .inspector-column {
    min-width: 0;
    display: grid;
    gap: 16px;
    align-content: start;
  }
  .preview-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .section {
    background: var(--panel);
    border: 1px solid var(--border);
    min-width: 0;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--panel-muted);
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .section-ref {
    color: var(--accent);
    font-size: 12px;
    min-width: 0;
    text-align: right;
    font-family: var(--mono);
  }
  .code-shell {
    min-width: 0;
  }
  .code-meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
  }
  .code-title {
    color: var(--text);
    font-size: 12px;
  }
  .code {
    margin: 0;
    padding: 0;
    background: #fbfbf8;
    color: #171717;
    overflow: auto;
    min-height: 340px;
    max-height: 60vh;
    font-size: 12px;
    line-height: 1.65;
    font-family: var(--mono);
    tab-size: 2;
  }
  .code code {
    display: block;
    min-width: max-content;
  }
  .code-line {
    display: grid;
    grid-template-columns: 60px minmax(0, 1fr);
    gap: 12px;
    padding: 0 14px;
  }
  .code-line:nth-child(2n) {
    background: #f5f5f0;
  }
  .line-no {
    color: #8a8a82;
    text-align: right;
    border-right: 1px solid #dfdfd8;
    padding-right: 10px;
    user-select: none;
  }
  .line-text {
    white-space: pre;
  }
  .tok-keyword { color: #0f3fd1; }
  .tok-string { color: #16794f; }
  .tok-number { color: #905b00; }
  .tok-comment { color: #73736c; }
  .tok-builtin { color: #7d2bb4; }
  .tok-operator { color: #171717; }
  .tok-function { color: #005f87; }
  .details-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding: 12px;
  }
  .detail-item {
    min-width: 0;
  }
  .detail-label {
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .detail-value {
    margin-top: 4px;
    line-height: 1.45;
    word-break: break-word;
  }
  .detail-value.mono {
    font-size: 12px;
  }
  .detail-value.status {
    display: inline-flex;
    border: 1px solid var(--border);
    padding: 3px 8px;
    width: fit-content;
  }
  .notes {
    padding: 12px;
    line-height: 1.6;
    font-size: 13px;
  }
  .empty,
  .loading {
    padding: 14px;
    color: var(--muted);
  }
  .chip-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 12px;
  }
  .chip {
    border: 1px solid var(--border);
    background: var(--panel);
    padding: 7px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .chip:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .section-stack {
    display: grid;
    gap: 16px;
  }
  .status-line {
    margin: 16px 24px 0;
    color: var(--muted);
    font-size: 12px;
  }
  .ref-link {
    color: inherit;
    text-decoration: none;
  }
  .ref-link:hover {
    text-decoration: underline;
  }
  .sidebar-backdrop {
    display: none;
  }
  @media (max-width: 1380px) {
    .workspace {
      grid-template-columns: minmax(0, 1fr);
    }
    .preview-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 1080px) {
    html, body, #root {
      overflow: hidden;
    }
    .shell {
      grid-template-columns: 1fr;
    }
    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: min(360px, 88vw);
      transform: translateX(-100%);
      transition: transform 160ms ease;
      z-index: 20;
      border-right: 1px solid var(--border-strong);
    }
    .shell.sidebar-open .sidebar {
      transform: translateX(0);
    }
    .sidebar-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(17, 17, 17, 0.18);
      z-index: 19;
    }
    .shell.sidebar-open .sidebar-backdrop {
      display: block;
    }
    .resize-handle {
      display: none;
    }
    .content-scroll {
      height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 22px;
    }
    .mobile-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
    }
    .toolbar-meta {
      min-width: 0;
      color: var(--muted);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .masthead {
      padding: 16px 14px 14px;
    }
    .masthead h2 {
      font-size: 22px;
    }
    .masthead,
    .masthead-actions {
      align-items: flex-start;
      flex-direction: column;
    }
    .summary-strip,
    .workspace,
    .status-line {
      margin-left: 12px;
      margin-right: 12px;
      padding-left: 0;
      padding-right: 0;
    }
    .summary-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .workspace {
      gap: 12px;
      padding-top: 12px;
    }
    .inspector-column {
      grid-template-columns: minmax(0, 1fr);
    }
    .details-grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .code {
      min-height: 280px;
      max-height: none;
    }
  }
`;

function clampSidebarWidth(value) {
  return Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, value));
}

function readInitialQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    slice: params.get("slice") ?? "",
    status: params.get("status") ?? "all",
    search: params.get("search") ?? "",
    entry: params.get("entry") ?? "",
  };
}

function fileRef(filePath, start, end) {
  if (!filePath) return "Unavailable";
  const range = Number.isFinite(start)
    ? `:${start}${Number.isFinite(end) && end !== start ? `-${end}` : ""}`
    : "";
  return `${filePath}${range}`;
}

function fileUrl(filePath) {
  if (!filePath) return null;
  const normalized = String(filePath).replaceAll("\\", "/");
  return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isIdentifierStart(char) {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char);
}

function wrapToken(type, value) {
  return `<span class="tok-${type}">${escapeHtml(value)}</span>`;
}

function highlightCode(source) {
  let index = 0;
  let output = "";

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      let end = source.indexOf("\n", index);
      if (end === -1) end = source.length;
      output += wrapToken("comment", source.slice(index, end));
      index = end;
      continue;
    }

    if (char === "/" && next === "*") {
      let end = source.indexOf("*/", index + 2);
      end = end === -1 ? source.length : end + 2;
      output += wrapToken("comment", source.slice(index, end));
      index = end;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      let end = index + 1;
      while (end < source.length) {
        const current = source[end];
        if (current === "\\") {
          end += 2;
          continue;
        }
        if (current === quote) {
          end += 1;
          break;
        }
        end += 1;
      }
      output += wrapToken("string", source.slice(index, end));
      index = end;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[0-9A-Fa-f_x.]/.test(source[end])) {
        end += 1;
      }
      output += wrapToken("number", source.slice(index, end));
      index = end;
      continue;
    }

    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (end < source.length && isIdentifierPart(source[end])) {
        end += 1;
      }
      const token = source.slice(index, end);
      const previous = source[index - 1] ?? "";
      const nextChar = source[end] ?? "";

      if (KEYWORDS.has(token)) {
        output += wrapToken("keyword", token);
      } else if (BUILTINS.has(token)) {
        output += wrapToken("builtin", token);
      } else if (nextChar === "(" && previous !== ".") {
        output += wrapToken("function", token);
      } else {
        output += escapeHtml(token);
      }
      index = end;
      continue;
    }

    if ("=><!+-*/%&|^?:".includes(char)) {
      output += wrapToken("operator", char);
      index += 1;
      continue;
    }

    output += escapeHtml(char);
    index += 1;
  }

  return output;
}

function CodeBlock({ preview, fallback, title, filePath, startLine, endLine }) {
  if (!preview?.text) {
    return (
      <section className="section code-shell">
        <header className="section-header">
          <div className="section-title">{title}</div>
          <div className="section-ref">
            <RefLink filePath={filePath} start={startLine} end={endLine} />
          </div>
        </header>
        <div className="loading">{fallback}</div>
      </section>
    );
  }

  const lines = preview.text.replaceAll("\t", "  ").split("\n");
  const html = lines
    .map((line, offset) => {
      const lineNumber = (preview.startLine ?? 1) + offset;
      const content = line.length > 0 ? highlightCode(line) : "&nbsp;";
      return `<div class="code-line"><span class="line-no">${lineNumber}</span><span class="line-text">${content}</span></div>`;
    })
    .join("");

  return (
    <section className="section code-shell">
      <header className="section-header">
        <div className="section-title">{title}</div>
        <div className="section-ref">
          <RefLink filePath={filePath} start={startLine} end={endLine} />
        </div>
      </header>
      <div className="code-meta">
        <div className="code-title">{filePath ? filePath.split("/").slice(-2).join("/") : "Unavailable"}</div>
        <div>{preview.startLine ?? "?"}-{preview.endLine ?? "?"}</div>
      </div>
      <pre className="code">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </section>
  );
}

function RefLink({ filePath, start, end }) {
  const text = fileRef(filePath, start, end);
  const url = fileUrl(filePath);

  if (!url || text === "Unavailable") {
    return <span>{text}</span>;
  }

  return (
    <a className="ref-link" href={url} target="_blank" rel="noreferrer">
      {text}
    </a>
  );
}

function ChipList({ items, label, onJump }) {
  if (!items?.length) {
    return <div className="empty">No {label} registered.</div>;
  }

  return (
    <div className="chip-group">
      {items.map((item, index) => (
        <button
          key={`${item.symbol ?? "symbol"}:${item.line ?? "?"}:${index}`}
          type="button"
          className="chip"
          title={item.file ?? ""}
          onClick={() => onJump(item)}
        >
          {item.symbol} @ {item.line ?? "?"}
        </button>
      ))}
    </div>
  );
}

function DetailItem({ label, value, mono = false, status = false }) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className={`detail-value${mono ? " mono" : ""}${status ? " status" : ""}`}>{value}</div>
    </div>
  );
}

function App() {
  const initialQueryRef = useRef(readInitialQuery());
  const shellRef = useRef(null);
  const handleRef = useRef(null);
  const [dataset, setDataset] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [slice, setSlice] = useState(() => initialQueryRef.current.slice);
  const [status, setStatus] = useState(() => initialQueryRef.current.status || "all");
  const [search, setSearch] = useState(() => initialQueryRef.current.search);
  const [selectedId, setSelectedId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 1080);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = STYLES;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDataset() {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await fetch("./viewer-data.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const nextDataset = await response.json();
        if (!active) return;
        const normalizedDataset = Array.isArray(nextDataset) ? nextDataset : [];
        setDataset(normalizedDataset);
        const firstSlice = normalizedDataset[0]?.slice ?? "";
        setSlice((current) => current || firstSlice);
      } catch (error) {
        if (!active) return;
        setDataset([]);
        setLoadError(error instanceof Error ? error.message : "Unable to load viewer-data.json");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadDataset();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setSidebarOpen(window.innerWidth > 1080);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    const handle = handleRef.current;
    if (!shell || !handle || window.innerWidth <= 1200) return;

    const storedWidth = Number(window.localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(storedWidth)) {
      shell.style.setProperty("--sidebar-width", `${clampSidebarWidth(storedWidth)}px`);
    }

    let dragging = false;
    const onPointerMove = (event) => {
      if (!dragging) return;
      const width = clampSidebarWidth(event.clientX);
      shell.style.setProperty("--sidebar-width", `${width}px`);
      window.localStorage.setItem(STORAGE_KEY, String(width));
    };
    const stopDragging = () => {
      dragging = false;
      handle.classList.remove("is-dragging");
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
    };
    const onPointerDown = (event) => {
      dragging = true;
      handle.classList.add("is-dragging");
      document.body.style.userSelect = "none";
      handle.setPointerCapture(event.pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDragging);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    return () => {
      handle.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, []);

  const allEntries = dataset.flatMap((map) =>
    map.entries.map((entry) => ({
      ...entry,
      mapName: map.name,
      mapSummary: map.summary,
      mapUpdatedAt: map.updatedAt,
    })),
  );

  const visibleEntries = allEntries.filter((entry) => {
    if (slice && entry.slice !== slice) return false;
    if (status !== "all" && entry.status !== status) return false;
    if (!deferredSearch) return true;
    const haystack = [
      entry.parentName,
      entry.parentSignature,
      entry.targetSymbol,
      entry.notes,
      entry.targetFile,
      entry.sourceFile,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(deferredSearch.toLowerCase());
  });

  useEffect(() => {
    if (!slice && dataset[0]?.slice) {
      setSlice(dataset[0].slice);
    }
  }, [dataset, slice]);

  useEffect(() => {
    if (!visibleEntries.length) {
      setSelectedId(null);
      return;
    }
    const initialEntryName = initialQueryRef.current.entry;
    if (initialEntryName && !selectedId) {
      const preferredEntry = visibleEntries.find((entry) => entry.parentName === initialEntryName || entry.targetSymbol === initialEntryName);
      if (preferredEntry) {
        setSelectedId(preferredEntry.id);
        initialQueryRef.current.entry = "";
        return;
      }
    }
    if (!selectedId || !visibleEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(visibleEntries[0].id);
    }
  }, [selectedId, visibleEntries]);

  const selectedEntry = visibleEntries.find((entry) => entry.id === selectedId) ?? null;
  const selectedMap = selectedEntry ? dataset.find((map) => map.name === selectedEntry.mapName) ?? null : null;

  const resolveRelated = (call) =>
    allEntries.find((entry) => entry.targetSymbol === call.symbol && entry.targetFile === call.file) ?? null;

  const jumpToRelated = (call) => {
    const related = resolveRelated(call);
    if (!related) return;
    startTransition(() => {
      setSlice(related.slice);
      setSelectedId(related.id);
      if (window.innerWidth <= 1080) {
        setSidebarOpen(false);
      }
    });
  };

  const stats = [
    { label: "Visible", value: visibleEntries.length },
    { label: "Migrated", value: visibleEntries.filter((entry) => entry.status === "migrated").length },
    { label: "Mapped", value: visibleEntries.filter((entry) => entry.status === "mapped").length },
    { label: "Slices", value: dataset.length },
  ];

  const copyText = async (value) => {
    if (!value || value === "Unavailable") return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      console.warn("Clipboard write failed");
    }
  };

  const summaryCells = [
    { label: "Total Entries", value: selectedMap?.summary?.totalEntryCount ?? visibleEntries.length },
    { label: "Migrated", value: selectedMap?.summary?.migratedCount ?? stats[1].value },
    { label: "Updated", value: selectedEntry?.mapUpdatedAt ?? "Unknown" },
  ];

  const emptyMessage = loadError
    ? `Viewer data failed to load: ${loadError}`
    : isLoading
      ? "Loading migration data..."
      : "No entries match the current filters.";

  return (
    <div className={`shell ${sidebarOpen ? "sidebar-open" : ""}`} ref={shellRef}>
      <aside className="sidebar">
        <div className="sidebar-scroll">
          <div className="sidebar-head">
            <div className="brand">
              <h1>Migration Atlas</h1>
              <p>Flat reference surface for parent functions, target symbols, call links, and line-accurate previews.</p>
            </div>
            <div className="controls">
              <div className="field">
                <label htmlFor="slice-select">Slice</label>
                <select id="slice-select" value={slice} onChange={(event) => setSlice(event.target.value)}>
                  {dataset.map((map) => (
                    <option key={map.slice} value={map.slice}>
                      {map.slice}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="status-select">Status</label>
                <select id="status-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="migrated">Migrated</option>
                  <option value="mapped">Mapped</option>
                  <option value="in_progress">In progress</option>
                  <option value="unmapped">Unmapped</option>
                  <option value="todo">Todo</option>
                  <option value="deferred">Deferred</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="search-input">Search</label>
                <input
                  id="search-input"
                  type="search"
                  value={search}
                  placeholder="symbol, signature, notes, file"
                  onChange={(event) => {
                    const value = event.target.value;
                    startTransition(() => {
                      setSearch(value.trimStart());
                    });
                  }}
                />
              </div>
            </div>
            <div className="stats">
              {stats.map((item) => (
                <div key={item.label} className="stat">
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="entry-list-wrap">
            <div className="entry-list">
              {visibleEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`entry ${entry.id === selectedId ? "active" : ""}`}
                  onClick={() => {
                    setSelectedId(entry.id);
                    if (window.innerWidth <= 1080) {
                      setSidebarOpen(false);
                    }
                  }}
                >
                  <div className="entry-top">
                    <div className="entry-name">{entry.parentName}</div>
                    <div className={`badge ${entry.status}`}>{entry.status}</div>
                  </div>
                  <div className="entry-signature">{entry.parentSignature}</div>
                  <div className="entry-meta">
                    <span>{entry.kind}</span>
                    <span>L{entry.parentLine ?? "?"}</span>
                  </div>
                </button>
              ))}
              {!visibleEntries.length ? <div className="empty">{emptyMessage}</div> : null}
            </div>
          </div>
        </div>
      </aside>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close sidebar"
        onClick={() => setSidebarOpen(false)}
      />
      <div className="resize-handle" ref={handleRef} aria-hidden="true" />
      <main className="content">
        <div className="content-scroll">
          <div className="mobile-toolbar">
            <button type="button" className="ghost-btn" onClick={() => setSidebarOpen((value) => !value)}>
              {sidebarOpen ? "Hide Index" : "Show Index"}
            </button>
            <div className="toolbar-meta">
              {selectedEntry ? `${selectedEntry.parentName} -> ${selectedEntry.targetSymbol ?? "unmapped"}` : "Migration Atlas"}
            </div>
          </div>

          <header className="masthead">
            <div>
              <div className="eyebrow">{selectedEntry?.slice ?? slice ?? "Migration Viewer"}</div>
              <h2>{selectedEntry ? `${selectedEntry.parentName} -> ${selectedEntry.targetSymbol ?? "unmapped"}` : "Select a mapped symbol"}</h2>
              <p>
                {selectedEntry?.parentSignature ||
                  "Choose an entry from the index to inspect the original parent slice, the migrated target, and the recorded jump graph."}
              </p>
            </div>
            <div className="masthead-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() =>
                  selectedEntry &&
                  copyText(fileRef(selectedEntry.sourceFile, selectedEntry.parentLine, selectedEntry.parentEndLine))
                }
              >
                Copy parent ref
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() =>
                  selectedEntry &&
                  copyText(fileRef(selectedEntry.targetFile, selectedEntry.targetLine, selectedEntry.targetEndLine))
                }
              >
                Copy target ref
              </button>
            </div>
          </header>

          <section className="summary-strip">
            {summaryCells.map((item) => (
              <div key={item.label} className="summary-cell">
                <div className="summary-label">{item.label}</div>
                <div className="summary-value">{item.value}</div>
              </div>
            ))}
          </section>

          {!selectedEntry ? (
            <div className="status-line">{emptyMessage}</div>
          ) : (
            <>
              <section className="workspace">
                <div className="preview-column">
                  <div className="preview-grid">
                    <CodeBlock
                      title="Parent Slice"
                      preview={selectedEntry.parentPreview}
                      fallback="No parent preview available."
                      filePath={selectedEntry.sourceFile}
                      startLine={selectedEntry.parentLine}
                      endLine={selectedEntry.parentEndLine}
                    />
                    <CodeBlock
                      title="Migrated Target"
                      preview={selectedEntry.targetPreview}
                      fallback="No target preview available."
                      filePath={selectedEntry.targetFile}
                      startLine={selectedEntry.targetLine}
                      endLine={selectedEntry.targetEndLine}
                    />
                  </div>
                </div>

                <div className="inspector-column">
                  <section className="section">
                    <header className="section-header">
                      <div className="section-title">Mapping</div>
                      <div className="section-ref">{selectedEntry.mapName}</div>
                    </header>
                    <div className="details-grid">
                      <DetailItem label="Status" value={selectedEntry.status ?? "Unavailable"} status />
                      <DetailItem label="Kind" value={selectedEntry.kind ?? "Unavailable"} />
                      <DetailItem label="Parent Symbol" value={selectedEntry.parentName ?? "Unavailable"} mono />
                      <DetailItem label="Target Symbol" value={selectedEntry.targetSymbol ?? "Unmapped"} mono />
                      <DetailItem label="Parent Ref" value={fileRef(selectedEntry.sourceFile, selectedEntry.parentLine, selectedEntry.parentEndLine)} mono />
                      <DetailItem label="Target Ref" value={fileRef(selectedEntry.targetFile, selectedEntry.targetLine, selectedEntry.targetEndLine)} mono />
                      <DetailItem label="Slice" value={selectedEntry.slice ?? "Unavailable"} mono />
                      <DetailItem label="Updated" value={selectedEntry.mapUpdatedAt ?? "Unknown"} mono />
                    </div>
                  </section>

                  <div className="section-stack">
                    <section className="section">
                      <header className="section-header">
                        <div className="section-title">Notes</div>
                        <div className="section-ref">{selectedEntry.calls?.length ?? 0} calls</div>
                      </header>
                      <div className="notes">{selectedEntry.notes || "No notes recorded."}</div>
                    </section>

                    {selectedEntry.calls?.length ? (
                      <section className="section">
                        <header className="section-header">
                          <div className="section-title">Calls</div>
                          <div className="section-ref">Jump within viewer</div>
                        </header>
                        <ChipList items={selectedEntry.calls} label="calls" onJump={jumpToRelated} />
                      </section>
                    ) : null}

                    {selectedEntry.calledBy?.length ? (
                      <section className="section">
                        <header className="section-header">
                          <div className="section-title">Called By</div>
                          <div className="section-ref">Reverse links</div>
                        </header>
                        <ChipList items={selectedEntry.calledBy} label="callers" onJump={jumpToRelated} />
                      </section>
                    ) : null}
                  </div>
                </div>
              </section>

              <div className="status-line">
                Showing {visibleEntries.length} entries in {selectedEntry.slice}. Updated {selectedEntry.mapUpdatedAt ?? "unknown"}.
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
