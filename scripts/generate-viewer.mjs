import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(SCRIPT_DIR, "..");
const MIGRATION_DIR = path.join(ROOT, "docs", "migration");
const HTML_PATH = path.join(MIGRATION_DIR, "viewer.html");
const DATA_PATH = path.join(MIGRATION_DIR, "viewer-data.json");
const BUNDLE_PATH = path.join(MIGRATION_DIR, "viewer.js");
const ENTRYPOINT = path.join(SKILL_ROOT, "assets", "viewer", "viewer-app.jsx");

function entryId(entry) {
  return `${entry.slice}:${entry.kind}:${entry.parentName}:${entry.parentLine}`;
}

function normalizePath(filePath) {
  return filePath ? filePath.replaceAll("\\", "/") : null;
}

function splitPathSegments(filePath) {
  return normalizePath(filePath)?.split("/").filter(Boolean) ?? [];
}

function resolveRepoPath(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized) {
    return null;
  }

  if (path.isAbsolute(normalized) && fsSync.existsSync(normalized)) {
    return normalized;
  }

  return path.resolve(ROOT, normalized);
}

function remapToWorkspace(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized) {
    return null;
  }

  const directPath = resolveRepoPath(normalized);
  if (directPath && fsSync.existsSync(directPath)) {
    return directPath;
  }

  const segments = splitPathSegments(normalized);
  const formatWorkIndex = segments.indexOf("format-work");
  const srcIndex = segments.indexOf("src");
  const docsIndex = segments.indexOf("docs");
  const anchorIndex = [formatWorkIndex, srcIndex, docsIndex].find((index) => index >= 0);

  if (anchorIndex == null) {
    return directPath ?? normalized;
  }

  return path.join(ROOT, ...segments.slice(anchorIndex));
}

function lineWindow(lines, startLine, endLine) {
  if (!Number.isFinite(startLine) || startLine <= 0) {
    return null;
  }

  const start = Math.max(1, startLine);
  const end = Number.isFinite(endLine) && endLine >= start ? endLine : Math.min(lines.length, start + 24);
  const slice = lines.slice(start - 1, end);
  return {
    startLine: start,
    endLine: end,
    text: slice.join("\n"),
  };
}

async function readText(filePath, cache) {
  const normalized = normalizePath(filePath);
  const resolved = remapToWorkspace(filePath);
  if (!normalized || !resolved) {
    return null;
  }
  if (cache.has(resolved)) {
    return cache.get(resolved);
  }

  try {
    const content = await fs.readFile(resolved, "utf8");
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const value = { content, lines };
    cache.set(resolved, value);
    return value;
  } catch {
    const value = null;
    cache.set(resolved, value);
    return value;
  }
}

async function loadMaps() {
  const files = (await fs.readdir(MIGRATION_DIR))
    .filter((name) => name.endsWith(".map.json"))
    .sort((left, right) => left.localeCompare(right, "en"));
  const textCache = new Map();
  const maps = [];

  for (const name of files) {
    const fullPath = path.join(MIGRATION_DIR, name);
    const raw = JSON.parse(await fs.readFile(fullPath, "utf8"));
    const entries = Array.isArray(raw.entries) ? raw.entries : [];
    const normalizedEntries = [];

    for (const entry of entries) {
      const sourceFile = normalizePath(entry.sourceFile ?? raw.sourceFile ?? null);
      const targetFile = normalizePath(entry.targetFile ?? null);
      const sourceText = sourceFile ? await readText(sourceFile, textCache) : null;
      const targetText = targetFile ? await readText(targetFile, textCache) : null;

      normalizedEntries.push({
        id: entryId(entry),
        kind: entry.kind ?? "unknown",
        parentName: entry.parentName ?? "(anonymous)",
        parentSignature: entry.parentSignature ?? "",
        sourceFile,
        slice: entry.slice ?? raw.slice ?? path.basename(name, ".map.json"),
        parentLine: entry.parentLine ?? null,
        parentEndLine: entry.parentEndLine ?? null,
        status: entry.status ?? "unmapped",
        targetFile,
        targetSymbol: entry.targetSymbol ?? null,
        targetLine: entry.targetLine ?? null,
        targetEndLine: entry.targetEndLine ?? null,
        notes: entry.notes ?? "",
        calls: Array.isArray(entry.calls) ? entry.calls : [],
        calledBy: Array.isArray(entry.calledBy) ? entry.calledBy : [],
        parentPreview: sourceText
          ? lineWindow(sourceText.lines, entry.parentLine ?? null, entry.parentEndLine ?? null)
          : null,
        targetPreview: targetText
          ? lineWindow(targetText.lines, entry.targetLine ?? null, entry.targetEndLine ?? null)
          : null,
      });
    }

    maps.push({
      name,
      sourceFile: normalizePath(raw.sourceFile ?? null),
      slice: raw.slice ?? path.basename(name, ".map.json"),
      updatedAt: raw.updatedAt ?? null,
      summary: raw.summary ?? null,
      entries: normalizedEntries,
    });
  }

  return maps;
}

function buildHtmlShell() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Migration Viewer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./viewer.js"></script>
  </body>
</html>`;
}

async function buildViewerBundle() {
  const result = await Bun.build({
    entrypoints: [ENTRYPOINT],
    outdir: MIGRATION_DIR,
    naming: "[dir]/viewer.[ext]",
    target: "browser",
    format: "esm",
    minify: false,
    sourcemap: "none",
  });

  if (!result.success) {
    const details = result.logs.map((log) => log.message).join("\n");
    throw new Error(`Migration viewer build failed:\n${details}`);
  }

  try {
    await fs.access(BUNDLE_PATH);
  } catch {
    throw new Error(`Expected bundle missing: ${BUNDLE_PATH}`);
  }
}

async function main() {
  const maps = await loadMaps();
  await fs.writeFile(DATA_PATH, JSON.stringify(maps, null, 2), "utf8");
  await buildViewerBundle();
  await fs.writeFile(HTML_PATH, buildHtmlShell(), "utf8");
  process.stdout.write(`Generated ${HTML_PATH}\n`);
}

await main();
