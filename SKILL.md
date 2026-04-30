---
name: migration-atlas
description: Maintain large-scale bundle-to-src migration ledgers, JSON symbol maps, target-line refreshes, and clickable preview viewers for staged refactors. Use when Codex needs to (1) register class/function migration entries, (2) validate or enrich `*.map.json` files, (3) rebuild the migration viewer, (4) keep source-to-target line mappings accurate, or (5) continue a split-file refactor workflow that tracks parent functions against reconstructed `src/` symbols.
---

# Migration Atlas

Keep the JSON map as the source of truth for migration state.

## Workflow

1. Identify the slice and source split file under `format-work/main_split_20/`.
2. Update the corresponding `docs/migration/main_part_XX.map.json`.
3. Keep each entry complete with:
   - `sourceFile`
   - `parentLine`
   - `parentEndLine`
   - `targetFile`
   - `targetLine`
   - `targetEndLine`
   - `targetSymbol`
   - `status`
   - `notes`
   - optional `calls`
   - optional `calledBy`
   - optional `slice`
4. Prefer these statuses only:
   - `unmapped`
   - `mapped`
   - `in_progress`
   - `migrated`
   - `todo`
   - `deferred`
5. Mark third-party/runtime/polyfill code as `todo` or `deferred` instead of hand-migrating it.
6. Recompute `summary` counts after map edits.
7. Run the bundled scripts in this skill:
   - `scripts/enrich-map.mjs`
   - `scripts/refresh-target-lines.mjs`
   - `scripts/validate-map.mjs`
   - `scripts/generate-viewer.mjs`
8. Use the viewer output in `docs/migration/` as the jump/preview surface, not as the behavior source of truth.

## Commands

Run from the repo root:

```bash
bun skills/migration-atlas/scripts/enrich-map.mjs docs/migration/main_part_16.map.json
bun skills/migration-atlas/scripts/refresh-target-lines.mjs
bun skills/migration-atlas/scripts/validate-map.mjs docs/migration/main_part_16.map.json
bun skills/migration-atlas/scripts/generate-viewer.mjs
bun skills/migration-atlas/scripts/serve-viewer.mjs
```

## Viewer

The viewer source lives in `assets/viewer/viewer-app.jsx`.

- Build output:
  - `docs/migration/viewer-data.json`
  - `docs/migration/viewer.js`
  - `docs/migration/viewer.html`
- Rebuild after map edits or target-line refreshes.

## Prompt Template

When another AI needs to continue the workflow, load `references/workflow-prompt.md` and reuse that template with the active slice, target modules, and current completion state.
