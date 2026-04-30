import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_MAPS = [
  "docs/migration/main_part_16.map.json",
  "docs/migration/main_part_17.map.json",
  "docs/migration/main_part_18.map.json",
  "docs/migration/main_part_19.map.json",
  "docs/migration/main_part_20.map.json",
];

const DECLARATION_PATTERNS = [
  (symbol) => new RegExp(`^\\s*export\\s+(?:default\\s+)?(?:async\\s+)?function\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*(?:async\\s+)?function\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*export\\s+(?:abstract\\s+)?class\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*(?:abstract\\s+)?class\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*export\\s+interface\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*interface\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*export\\s+type\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*type\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*export\\s+(?:const|let|var)\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*(?:const|let|var)\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*export\\s+enum\\s+${escapeRegex(symbol)}\\b`),
  (symbol) => new RegExp(`^\\s*enum\\s+${escapeRegex(symbol)}\\b`),
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stripInlineComment(line) {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const prev = line[index - 1];
    if (char === "'" && prev !== "\\" && !inDouble && !inTemplate) {
      inSingle = !inSingle;
      continue;
    }
    if (char === '"' && prev !== "\\" && !inSingle && !inTemplate) {
      inDouble = !inDouble;
      continue;
    }
    if (char === "`" && prev !== "\\" && !inSingle && !inDouble) {
      inTemplate = !inTemplate;
      continue;
    }
    if (!inSingle && !inDouble && !inTemplate && char === "/" && line[index + 1] === "/") {
      return line.slice(0, index);
    }
  }
  return line;
}

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => " ".repeat(match.length));
}

function findDeclarationStart(lines, symbol) {
  for (const makePattern of DECLARATION_PATTERNS) {
    const pattern = makePattern(symbol);
    for (let index = 0; index < lines.length; index += 1) {
      if (pattern.test(stripInlineComment(lines[index]))) {
        return index;
      }
    }
  }
  return -1;
}

function classifyDeclaration(line) {
  const trimmed = line.trim();
  if (/\b(class|interface|enum)\b/.test(trimmed)) {
    return "brace";
  }
  if (/\bfunction\b/.test(trimmed)) {
    return "brace";
  }
  if (/\b(?:const|let|var)\b/.test(trimmed) || /\btype\b/.test(trimmed)) {
    return "statement";
  }
  return "statement";
}

function findEndLine(lines, startIndex) {
  const declarationType = classifyDeclaration(lines[startIndex]);
  if (declarationType === "brace") {
    return findBraceRangeEnd(lines, startIndex);
  }
  return findStatementEnd(lines, startIndex);
}

function findBraceRangeEnd(lines, startIndex) {
  let started = false;
  let depth = 0;
  let inBlockComment = false;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  for (let lineIndex = startIndex; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      const prev = line[index - 1];

      if (inBlockComment) {
        if (char === "*" && next === "/") {
          inBlockComment = false;
          index += 1;
        }
        continue;
      }

      if (!inSingle && !inDouble && !inTemplate) {
        if (char === "/" && next === "*") {
          inBlockComment = true;
          index += 1;
          continue;
        }
        if (char === "/" && next === "/") {
          break;
        }
      }

      if (char === "'" && prev !== "\\" && !inDouble && !inTemplate) {
        inSingle = !inSingle;
        continue;
      }
      if (char === '"' && prev !== "\\" && !inSingle && !inTemplate) {
        inDouble = !inDouble;
        continue;
      }
      if (char === "`" && prev !== "\\" && !inSingle && !inDouble) {
        inTemplate = !inTemplate;
        continue;
      }
      if (inSingle || inDouble || inTemplate) {
        continue;
      }

      if (char === "{") {
        started = true;
        depth += 1;
      } else if (char === "}") {
        if (started) {
          depth -= 1;
          if (depth === 0) {
            return lineIndex;
          }
        }
      }
    }
  }

  return startIndex;
}

function findStatementEnd(lines, startIndex) {
  const text = lines.slice(startIndex).join("\n");
  const sanitized = stripBlockComments(text);

  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let lineOffset = 0;

  for (let index = 0; index < sanitized.length; index += 1) {
    const char = sanitized[index];
    const prev = sanitized[index - 1];

    if (char === "\n") {
      lineOffset += 1;
    }

    if (!inDouble && !inTemplate && char === "'" && prev !== "\\") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && char === '"' && prev !== "\\") {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && char === "`" && prev !== "\\") {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) {
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (char === "{") {
      braceDepth += 1;
      continue;
    }
    if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (char === "[") {
      bracketDepth += 1;
      continue;
    }
    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (char === ";" && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
      return startIndex + lineOffset;
    }
  }

  return startIndex;
}

async function refreshMap(mapPath) {
  const absoluteMapPath = path.resolve(ROOT, mapPath);
  const map = JSON.parse(await fs.readFile(absoluteMapPath, "utf8"));
  const fileCache = new Map();
  const issues = [];
  let updatedCount = 0;

  for (const entry of map.entries ?? []) {
    if (!entry?.targetFile || !entry?.targetSymbol) {
      continue;
    }

    const targetFile = path.resolve(ROOT, entry.targetFile);
    let cached = fileCache.get(targetFile);
    if (!cached) {
      try {
        const content = await fs.readFile(targetFile, "utf8");
        cached = { content, lines: content.split(/\r?\n/) };
        fileCache.set(targetFile, cached);
      } catch (error) {
        issues.push({
          parentName: entry.parentName,
          type: "missing-target-file",
          targetFile: entry.targetFile,
          detail: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    const startIndex = findDeclarationStart(cached.lines, entry.targetSymbol);
    if (startIndex === -1) {
      issues.push({
        parentName: entry.parentName,
        type: "missing-target-symbol",
        targetFile: entry.targetFile,
        targetSymbol: entry.targetSymbol,
      });
      continue;
    }

    const endIndex = findEndLine(cached.lines, startIndex);
    const nextLine = startIndex + 1;
    const nextEndLine = endIndex + 1;
    if (entry.targetLine !== nextLine || entry.targetEndLine !== nextEndLine) {
      entry.targetLine = nextLine;
      entry.targetEndLine = nextEndLine;
      updatedCount += 1;
    }
  }

  map.updatedAt = formatLocalDate(new Date());
  await fs.writeFile(absoluteMapPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  return { mapPath, updatedCount, issues };
}

const mapArgs = process.argv.slice(2);
const targets = mapArgs.length > 0 ? mapArgs : DEFAULT_MAPS;

const results = [];
for (const mapPath of targets) {
  results.push(await refreshMap(mapPath));
}

for (const result of results) {
  process.stdout.write(`${result.mapPath}: updated ${result.updatedCount} entries\n`);
  for (const issue of result.issues) {
    process.stdout.write(`  - ${issue.type}: ${issue.parentName}`);
    if (issue.targetSymbol) {
      process.stdout.write(` -> ${issue.targetSymbol}`);
    }
    if (issue.targetFile) {
      process.stdout.write(` (${issue.targetFile})`);
    }
    process.stdout.write("\n");
  }
}
