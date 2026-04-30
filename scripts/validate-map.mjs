import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const ALLOWED_STATUSES = new Set(["unmapped", "mapped", "in_progress", "migrated", "todo", "deferred"]);

function fail(message) {
  throw new Error(message);
}

function ensure(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const [, , mapArg] = process.argv;
if (!mapArg) {
  fail("Usage: bun skills/migration-atlas/scripts/validate-map.mjs <map-json-path>");
}

const filePath = path.resolve(ROOT, mapArg);
const map = JSON.parse(await fs.readFile(filePath, "utf8"));
const entries = Array.isArray(map.entries) ? map.entries : [];

for (const entry of entries) {
  ensure(ALLOWED_STATUSES.has(entry.status), `${entry.parentName}: invalid status ${entry.status}`);
  ensure(typeof entry.slice === "string" && entry.slice.length > 0, `${entry.parentName}: missing slice`);
  ensure(typeof entry.sourceFile === "string" && entry.sourceFile.length > 0, `${entry.parentName}: missing sourceFile`);
  ensure(typeof entry.parentName === "string" && entry.parentName.length > 0, "entry missing parentName");
  ensure(Number.isFinite(entry.parentLine), `${entry.parentName}: missing parentLine`);
  ensure(Number.isFinite(entry.parentEndLine), `${entry.parentName}: missing parentEndLine`);
  ensure(typeof entry.parentSignature === "string", `${entry.parentName}: missing parentSignature`);
  ensure(typeof entry.kind === "string" && entry.kind.length > 0, `${entry.parentName}: missing kind`);

  if (entry.status === "migrated") {
    ensure(typeof entry.targetFile === "string" && entry.targetFile.length > 0, `${entry.parentName}: migrated missing targetFile`);
    ensure(typeof entry.targetSymbol === "string" && entry.targetSymbol.length > 0, `${entry.parentName}: migrated missing targetSymbol`);
    ensure(Number.isFinite(entry.targetLine), `${entry.parentName}: migrated missing targetLine`);
    ensure(Number.isFinite(entry.targetEndLine), `${entry.parentName}: migrated missing targetEndLine`);
    ensure(typeof entry.notes === "string" && entry.notes.length > 0, `${entry.parentName}: migrated missing notes`);
  }

  if (entry.status === "mapped" || entry.status === "in_progress") {
    ensure(typeof entry.targetFile === "string" && entry.targetFile.length > 0, `${entry.parentName}: ${entry.status} missing targetFile`);
    ensure(typeof entry.targetSymbol === "string" && entry.targetSymbol.length > 0, `${entry.parentName}: ${entry.status} missing targetSymbol`);
    ensure(typeof entry.notes === "string" && entry.notes.length > 0, `${entry.parentName}: ${entry.status} missing notes`);
  }

  if (entry.status === "todo") {
    ensure(typeof entry.notes === "string" && entry.notes.startsWith("TODO(migration):"), `${entry.parentName}: todo notes must start with TODO(migration):`);
  }

  if (entry.status === "deferred") {
    ensure(typeof entry.notes === "string" && entry.notes.length > 0, `${entry.parentName}: deferred notes required`);
  }
}

const classCount = entries.filter((entry) => entry.kind === "class").length;
const functionCount = entries.filter((entry) => entry.kind === "function").length;
const migratedCount = entries.filter((entry) => entry.status === "migrated").length;
const mappedCount = entries.filter((entry) => entry.status === "mapped").length;
const unmappedCount = entries.filter((entry) => entry.status === "unmapped").length;
const todoCount = entries.filter((entry) => entry.status === "todo").length;
const inProgressCount = entries.filter((entry) => entry.status === "in_progress").length;
const deferredCount = entries.filter((entry) => entry.status === "deferred").length;
const totalClassAndFunctionCount = classCount + functionCount;
const supplementalEntryCount = entries.length - totalClassAndFunctionCount;

ensure(map.summary?.classCount === classCount, `classCount mismatch: ${map.summary?.classCount} !== ${classCount}`);
ensure(map.summary?.functionCount === functionCount, `functionCount mismatch: ${map.summary?.functionCount} !== ${functionCount}`);
ensure(map.summary?.migratedCount === migratedCount, `migratedCount mismatch: ${map.summary?.migratedCount} !== ${migratedCount}`);
ensure(map.summary?.mappedCount === mappedCount, `mappedCount mismatch: ${map.summary?.mappedCount} !== ${mappedCount}`);
ensure(map.summary?.unmappedCount === unmappedCount, `unmappedCount mismatch: ${map.summary?.unmappedCount} !== ${unmappedCount}`);
ensure(map.summary?.todoCount === todoCount, `todoCount mismatch: ${map.summary?.todoCount} !== ${todoCount}`);
ensure(map.summary?.inProgressCount === inProgressCount, `inProgressCount mismatch: ${map.summary?.inProgressCount} !== ${inProgressCount}`);
ensure(map.summary?.deferredCount === deferredCount, `deferredCount mismatch: ${map.summary?.deferredCount} !== ${deferredCount}`);
ensure(map.summary?.totalClassAndFunctionCount === totalClassAndFunctionCount, "totalClassAndFunctionCount mismatch");
ensure(map.summary?.supplementalEntryCount === supplementalEntryCount, "supplementalEntryCount mismatch");
ensure(map.summary?.totalEntryCount === entries.length, "totalEntryCount mismatch");

process.stdout.write(`${path.basename(filePath)}: validation passed\n`);
