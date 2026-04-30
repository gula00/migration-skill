import React, { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const STORAGE_KEY = "migration-viewer.sidebar-width";
const MIN_SIDEBAR = 260;
const MAX_SIDEBAR = 520;

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
  "process",
  "window",
  "document",
]);

const STYLES = `
  :root {
    --bg: #f2eee5;
    --panel: rgba(255, 251, 245, 0.92);
    --panel-strong: #fffaf1;
    --text: #1d1b19;
    --muted: #6f665d;
    --border: rgba(60, 42, 24, 0.14);
    --accent: #af4d1f;
    --accent-2: #246a73;
    --shadow: 0 14px 32px rgba(68, 41, 18, 0.08);
    --mono: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
    --sans: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  * { box-sizing: border-box; }
  html, body, #root { height: 100%; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: var(--sans);
    color: var(--text);
    overflow: hidden;
    background:
      radial-gradient(circle at top left, rgba(175, 77, 31, 0.16), transparent 32%),
      radial-gradient(circle at bottom right, rgba(36, 106, 115, 0.16), transparent 28%),
      linear-gradient(180deg, #f8f3ea 0%, var(--bg) 100%);
  }
  button, input, select { font: inherit; }
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-width, 340px) 12px minmax(0, 1fr);
    height: 100vh;
    overflow: hidden;
  }
  .sidebar {
    border-right: 1px solid var(--border);
    background: linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,250,244,0.82));
    backdrop-filter: blur(12px);
    overflow: hidden;
    min-width: 0;
  }
  .sidebar-scroll {
    height: 100%;
    overflow: hidden;
    padding: 20px 18px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .sidebar-head {
    flex: 0 0 auto;
  }
  .entry-list-wrap {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    padding-right: 2px;
  }
  .resize-handle {
    position: relative;
    cursor: col-resize;
    background: linear-gradient(180deg, rgba(255,255,255,0), rgba(175, 77, 31, 0.12), rgba(255,255,255,0));
  }
  .resize-handle::before {
    content: "";
    position: absolute;
    inset: 0;
    margin: auto;
    width: 4px;
    height: 72px;
    border-radius: 999px;
    background: rgba(175, 77, 31, 0.28);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.7);
  }
  .resize-handle.is-dragging::before,
  .resize-handle:hover::before {
    background: rgba(175, 77, 31, 0.48);
  }
  .brand { padding: 8px 6px 18px; }
  .brand h1 {
    margin: 0;
    font-size: 26px;
    letter-spacing: -0.03em;
  }
  .brand p {
    margin: 8px 0 0;
    color: var(--muted);
    line-height: 1.5;
  }
  .controls {
    display: grid;
    gap: 12px;
    margin-bottom: 18px;
  }
  .field {
    display: grid;
    gap: 6px;
  }
  .field label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .field input, .field select {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.8);
    color: var(--text);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 18px;
  }
  .stat, .entry, .panel, .hero {
    background: var(--panel);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
  }
  .stat {
    border-radius: 16px;
    padding: 12px 14px;
  }
  .stat .label {
    font-size: 12px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .stat .value {
    margin-top: 8px;
    font-size: 22px;
    font-weight: 800;
  }
  .entry-list {
    display: grid;
    gap: 10px;
  }
  .entry {
    width: 100%;
    text-align: left;
    border-radius: 16px;
    padding: 14px 15px;
    cursor: pointer;
    transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
  }
  .entry:hover {
    transform: translateY(-1px);
    border-color: rgba(175, 77, 31, 0.35);
  }
  .entry.active {
    border-color: var(--accent);
    background: linear-gradient(180deg, rgba(175, 77, 31, 0.14), rgba(255,255,255,0.92));
  }
  .entry-top, .entry-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .entry-name, .entry-signature, .ref, .chip {
    font-family: var(--mono);
  }
  .entry-name {
    font-size: 14px;
    font-weight: 700;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: rgba(36, 106, 115, 0.12);
    color: var(--accent-2);
  }
  .badge.migrated { background: rgba(36, 106, 115, 0.15); color: #1f6c5c; }
  .badge.unmapped { background: rgba(116, 96, 54, 0.15); color: #7d5b17; }
  .badge.mapped, .badge.in_progress { background: rgba(175, 77, 31, 0.15); color: var(--accent); }
  .badge.todo { background: rgba(125, 86, 145, 0.12); color: #6f437f; }
  .badge.deferred { background: rgba(82, 90, 122, 0.12); color: #47506f; }
  .entry-signature {
    margin-top: 9px;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.45;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .entry-meta {
    margin-top: 10px;
    font-size: 12px;
    color: var(--muted);
  }
  .content {
    min-width: 0;
    overflow: hidden;
    padding: 22px 22px 22px 10px;
  }
  .content-scroll {
    height: 100%;
    overflow: auto;
    padding-right: 4px;
    scrollbar-gutter: stable;
  }
  .hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    border-radius: 24px;
    padding: 22px;
  }
  .hero h2 {
    margin: 0;
    font-size: 30px;
    letter-spacing: -0.03em;
  }
  .hero p {
    margin: 10px 0 0;
    color: var(--muted);
    line-height: 1.6;
    max-width: 820px;
  }
  .hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .link-btn {
    appearance: none;
    border: 1px solid var(--border);
    background: var(--panel-strong);
    border-radius: 999px;
    padding: 9px 14px;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
  }
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
    margin-top: 18px;
  }
  .panel {
    border-radius: 20px;
    overflow: hidden;
    min-width: 0;
  }
  .panel-header {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }
  .panel-title {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 800;
    color: var(--muted);
  }
  .ref {
    font-size: 12px;
    color: var(--accent);
  }
  .code {
    margin: 0;
    padding: 16px;
    background: linear-gradient(180deg, rgba(31, 22, 14, 0.98), rgba(34, 25, 17, 0.98));
    color: #f4ead8;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.6;
    overflow: auto;
    min-height: 320px;
    max-height: 44vh;
    tab-size: 2;
  }
  .code code {
    display: block;
    min-width: max-content;
  }
  .code-line {
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 14px;
  }
  .line-no {
    user-select: none;
    text-align: right;
    color: rgba(244, 234, 216, 0.42);
    border-right: 1px solid rgba(244, 234, 216, 0.12);
    padding-right: 10px;
  }
  .line-text {
    white-space: pre;
  }
  .tok-keyword { color: #f7b267; }
  .tok-string { color: #8bd3dd; }
  .tok-number { color: #f6c177; }
  .tok-comment { color: #8b9c92; }
  .tok-builtin { color: #c4a7e7; }
  .tok-operator { color: #f4ead8; }
  .tok-function { color: #9ccfd8; }
  .ref-link {
    color: inherit;
    text-decoration: none;
  }
  .ref-link:hover { text-decoration: underline; }
  .meta-panel {
    margin-top: 18px;
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 18px;
  }
  .details-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
    padding: 16px;
  }
  .detail-item {
    min-width: 0;
  }
  .detail-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .detail-value {
    margin-top: 6px;
    color: var(--text);
    line-height: 1.55;
    word-break: break-word;
  }
  .detail-value.mono {
    font-family: var(--mono);
    font-size: 12px;
  }
  .detail-value.status {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 4px 10px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.72);
    width: fit-content;
  }
  .notes {
    padding: 16px;
    color: var(--text);
    line-height: 1.65;
  }
  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 16px;
  }
  .chip {
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.85);
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .empty {
    padding: 16px;
    color: var(--muted);
  }
  .status-bar {
    margin-top: 18px;
    color: var(--muted);
    font-size: 13px;
  }
  @media (max-width: 1200px) {
    body { overflow: auto; }
    .shell {
      grid-template-columns: 1fr;
      height: auto;
      overflow: visible;
    }
    .sidebar {
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }
    .sidebar-scroll, .content-scroll {
      height: auto;
      overflow: visible;
    }
    .entry-list-wrap {
      overflow: visible;
      min-height: auto;
    }
    .resize-handle { display: none; }
    .content {
      padding: 18px;
      overflow: visible;
    }
    .detail-grid, .meta-panel { grid-template-columns: 1fr; }
    .hero { flex-direction: column; }
  }
`;

function clampSidebarWidth(value) {
  return Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, value));
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

function CodeBlock({ preview, fallback }) {
  if (!preview?.text) {
    return (
      <pre className="code">
        <code>{fallback}</code>
      </pre>
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
    <pre className="code">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
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
    <>
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
    </>
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
  const shellRef = useRef(null);
  const handleRef = useRef(null);
  const [dataset, setDataset] = useState([]);
  const [slice, setSlice] = useState("");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
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
    fetch("./viewer-data.json")
      .then((response) => response.json())
      .then((nextDataset) => {
        if (!active) return;
        setDataset(Array.isArray(nextDataset) ? nextDataset : []);
        const firstSlice = Array.isArray(nextDataset) && nextDataset[0]?.slice ? nextDataset[0].slice : "";
        setSlice((current) => current || firstSlice);
      })
      .catch(() => {
        if (!active) return;
        setDataset([]);
      });
    return () => {
      active = false;
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
    if (!visibleEntries.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(visibleEntries[0].id);
    }
  }, [selectedId, visibleEntries]);

  const selectedEntry = visibleEntries.find((entry) => entry.id === selectedId) ?? null;

  const resolveRelated = (call) =>
    allEntries.find((entry) => entry.targetSymbol === call.symbol && entry.targetFile === call.file) ?? null;

  const jumpToRelated = (call) => {
    const related = resolveRelated(call);
    if (!related) return;
    startTransition(() => {
      setSlice(related.slice);
      setSelectedId(related.id);
    });
  };

  const stats = [
    { label: "Visible", value: visibleEntries.length },
    { label: "Migrated", value: visibleEntries.filter((entry) => entry.status === "migrated").length },
    { label: "Mapped", value: visibleEntries.filter((entry) => entry.status === "mapped").length },
    { label: "In Progress", value: visibleEntries.filter((entry) => entry.status === "in_progress").length },
  ];

  const copyText = async (value) => {
    if (!value || value === "Unavailable") return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      console.warn("Clipboard write failed");
    }
  };

  return (
    <div className="shell" ref={shellRef}>
      <aside className="sidebar">
        <div className="sidebar-scroll">
          <div className="sidebar-head">
            <div className="brand">
              <h1>Migration Atlas</h1>
              <p>Explore parent functions, migrated targets, and lightweight call links across the main_part_* maps.</p>
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
                  placeholder="Search symbol, signature, notes, target path"
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
                  <div className="label">{item.label}</div>
                  <div className="value">{item.value}</div>
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
                  onClick={() => setSelectedId(entry.id)}
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
            </div>
          </div>
        </div>
      </aside>
      <div className="resize-handle" ref={handleRef} aria-hidden="true" />
      <main className="content">
        <div className="content-scroll">
          <section className="hero">
            <div>
              <h2>{selectedEntry ? `${selectedEntry.parentName} -> ${selectedEntry.targetSymbol ?? "unmapped"}` : "No entry selected"}</h2>
              <p>{selectedEntry?.notes || "Choose a symbol from the left to preview the parent slice, the migrated target, and any known call links."}</p>
            </div>
            <div className="hero-actions">
              <button
                className="link-btn"
                type="button"
                onClick={() => selectedEntry && copyText(fileRef(selectedEntry.sourceFile, selectedEntry.parentLine, selectedEntry.parentEndLine))}
              >
                Copy parent ref
              </button>
              <button
                className="link-btn"
                type="button"
                onClick={() => selectedEntry && copyText(fileRef(selectedEntry.targetFile, selectedEntry.targetLine, selectedEntry.targetEndLine))}
              >
                Copy target ref
              </button>
            </div>
          </section>
          <section className="detail-grid">
            <article className="panel">
              <header className="panel-header">
                <div className="panel-title">Parent Slice</div>
                <div className="ref">
                  {selectedEntry ? (
                    <RefLink filePath={selectedEntry.sourceFile} start={selectedEntry.parentLine} end={selectedEntry.parentEndLine} />
                  ) : null}
                </div>
              </header>
              <CodeBlock preview={selectedEntry?.parentPreview} fallback="No parent preview available." />
            </article>
            <article className="panel">
              <header className="panel-header">
                <div className="panel-title">Migrated Target</div>
                <div className="ref">
                  {selectedEntry ? (
                    <RefLink filePath={selectedEntry.targetFile} start={selectedEntry.targetLine} end={selectedEntry.targetEndLine} />
                  ) : null}
                </div>
              </header>
              <CodeBlock preview={selectedEntry?.targetPreview} fallback="No target preview available." />
            </article>
          </section>
          <section className="meta-panel">
            <article className="panel">
              <header className="panel-header">
                <div className="panel-title">Mapping</div>
                <div className="ref">{selectedEntry ? selectedEntry.mapName : ""}</div>
              </header>
              <div className="details-grid">
                <DetailItem label="Status" value={selectedEntry?.status ?? "Unavailable"} status />
                <DetailItem label="Kind" value={selectedEntry?.kind ?? "Unavailable"} />
                <DetailItem label="Parent Symbol" value={selectedEntry?.parentName ?? "Unavailable"} mono />
                <DetailItem label="Target Symbol" value={selectedEntry?.targetSymbol ?? "Unmapped"} mono />
                <DetailItem
                  label="Parent Lines"
                  value={
                    selectedEntry
                      ? `${selectedEntry.parentLine ?? "?"}-${selectedEntry.parentEndLine ?? "?"}`
                      : "Unavailable"
                  }
                  mono
                />
                <DetailItem
                  label="Target Lines"
                  value={
                    selectedEntry
                      ? selectedEntry.targetLine
                        ? `${selectedEntry.targetLine}-${selectedEntry.targetEndLine ?? selectedEntry.targetLine}`
                        : "Unmapped"
                      : "Unavailable"
                  }
                  mono
                />
                <DetailItem label="Source File" value={selectedEntry?.sourceFile ?? "Unavailable"} mono />
                <DetailItem label="Target File" value={selectedEntry?.targetFile ?? "Unmapped"} mono />
                <DetailItem label="Slice" value={selectedEntry?.slice ?? "Unavailable"} mono />
                <DetailItem label="Updated" value={selectedEntry?.mapUpdatedAt ?? "Unknown"} mono />
              </div>
              <header className="panel-header">
                <div className="panel-title">Notes</div>
                <div className="ref">{selectedEntry ? `${selectedEntry.calls?.length ?? 0} calls` : ""}</div>
              </header>
              <div className="notes">{selectedEntry?.notes || "No notes recorded."}</div>
            </article>
            <article className="panel">
              <header className="panel-header">
                <div className="panel-title">Calls</div>
                <div className="ref">In-page jump</div>
              </header>
              <div className="chips">
                <ChipList items={selectedEntry?.calls ?? []} label="calls" onJump={jumpToRelated} />
              </div>
              <div className="chips">
                <ChipList items={selectedEntry?.calledBy ?? []} label="callers" onJump={jumpToRelated} />
              </div>
            </article>
          </section>
          <div className="status-bar">
            {selectedEntry
              ? `Showing ${visibleEntries.length} entries in ${selectedEntry.slice}. Updated ${selectedEntry.mapUpdatedAt ?? "unknown"}.`
              : `Showing ${visibleEntries.length} entries.`}
          </div>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
