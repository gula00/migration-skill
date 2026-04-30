import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

function normalizePath(filePath) {
  return filePath ? filePath.replaceAll("\\", "/") : null;
}

function inferKindFromSignature(signature, fallback) {
  if (typeof signature !== "string") {
    return fallback ?? "function";
  }
  const trimmed = signature.trimStart();
  if (trimmed.startsWith("class ")) {
    return "class";
  }
  if (trimmed.startsWith("function ") || trimmed.startsWith("async function ")) {
    return "function";
  }
  return fallback ?? "function";
}

async function readLines(filePath, cache) {
  const normalized = normalizePath(filePath);
  if (!normalized) return null;
  if (cache.has(normalized)) return cache.get(normalized);
  try {
    const lines = (await fs.readFile(normalized, "utf8")).replace(/\r\n/g, "\n").split("\n");
    cache.set(normalized, lines);
    return lines;
  } catch {
    cache.set(normalized, null);
    return null;
  }
}

function inferParentEndLines(entries, sourceLineCount) {
  const sorted = [...entries]
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => Number.isFinite(entry.parentLine))
    .sort((left, right) => left.entry.parentLine - right.entry.parentLine);

  const inferred = new Map();
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index].entry;
    const next = sorted[index + 1]?.entry ?? null;
    const start = current.parentLine;
    const nextStart = next?.parentLine;
    let end = sourceLineCount;
    if (Number.isFinite(nextStart)) {
      end = Math.max(start, nextStart - 1);
    }
    inferred.set(sorted[index].index, end);
  }
  return inferred;
}

function isTargetBoundary(line) {
  return (
    /^\s*\/\/\s+(function|class)\s+/.test(line) ||
    /^\s*export\s+(async\s+)?function\s+/.test(line) ||
    /^\s*(async\s+)?function\s+/.test(line) ||
    /^\s*export\s+class\s+/.test(line) ||
    /^\s*class\s+/.test(line)
  );
}

function inferTargetEndLine(lines, startLine) {
  if (!Array.isArray(lines) || !Number.isFinite(startLine) || startLine <= 0) {
    return null;
  }
  for (let lineIndex = startLine; lineIndex < lines.length; lineIndex += 1) {
    if (!isTargetBoundary(lines[lineIndex])) {
      continue;
    }
    let end = lineIndex;
    while (end > startLine - 1 && lines[end - 1].trim() === "") {
      end -= 1;
    }
    return Math.max(startLine, end);
  }
  let end = lines.length;
  while (end > startLine && lines[end - 1].trim() === "") {
    end -= 1;
  }
  return Math.max(startLine, end);
}

async function enrichMap(mapPath) {
  const fullPath = path.resolve(ROOT, mapPath);
  const raw = JSON.parse(await fs.readFile(fullPath, "utf8"));
  const slice = raw.slice ?? path.basename(fullPath, ".map.json");
  const sourceFile = normalizePath(raw.sourceFile ?? null);
  const lineCache = new Map();
  const sourceLines = sourceFile ? await readLines(sourceFile, lineCache) : null;
  const parentEndLines = inferParentEndLines(raw.entries ?? [], sourceLines?.length ?? 0);

  const entries = await Promise.all(
    (raw.entries ?? []).map(async (entry, index) => {
      const normalizedTargetFile = normalizePath(entry.targetFile ?? null);
      const targetLines = normalizedTargetFile ? await readLines(normalizedTargetFile, lineCache) : null;
      const parentLine = entry.parentLine ?? null;
      const inferredParentEndLine = parentEndLines.get(index) ?? parentLine ?? null;
      const targetLine = entry.targetLine ?? null;

      return {
        slice: entry.slice ?? slice,
        calledBy: Array.isArray(entry.calledBy) ? entry.calledBy : [],
        targetSymbol: entry.targetSymbol ?? null,
        targetLine,
        targetFile: normalizedTargetFile,
        parentLine,
        calls: Array.isArray(entry.calls) ? entry.calls : [],
        notes: entry.notes ?? null,
        parentName: entry.parentName ?? "(anonymous)",
        parentEndLine: entry.parentEndLine ?? inferredParentEndLine,
        sourceFile: normalizePath(entry.sourceFile ?? sourceFile),
        status: entry.status ?? "unmapped",
        targetEndLine:
          entry.targetEndLine ??
          (normalizedTargetFile && Number.isFinite(targetLine)
            ? inferTargetEndLine(targetLines, targetLine)
            : null),
        parentSignature: entry.parentSignature ?? "",
        kind: inferKindFromSignature(entry.parentSignature, entry.kind),
      };
    }),
  );

  const next = {
    ...raw,
    sourceFile,
    slice,
    entries,
  };

  await fs.writeFile(fullPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

const [, , mapArg] = process.argv;

if (!mapArg) {
  throw new Error("Usage: bun skills/migration-atlas/scripts/enrich-map.mjs <map-json-path>");
}

await enrichMap(mapArg);
