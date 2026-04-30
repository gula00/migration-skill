Use this prompt when handing the migration workflow to another AI:

```text
You are continuing a bundle-to-src migration workflow.

Source of truth:
- docs/migration/main_part_XX.map.json

Your job:
1. Read the split source file and the current src target modules.
2. Update the JSON map instead of relying on source comments.
3. Keep these fields accurate for each entry:
   sourceFile
   parentLine
   parentEndLine
   targetFile
   targetLine
   targetEndLine
   targetSymbol
   status
   notes
   optional: calls
   optional: calledBy
   optional: slice
4. Use only these statuses:
   unmapped, mapped, in_progress, migrated, todo, deferred
5. For bundled third-party/runtime/polyfill code, do not hand-migrate it. Mark it as todo/deferred with a clear note.
6. After edits, refresh target lines, validate the map, and rebuild the viewer.

Required validation:
- bun skills/migration-atlas/scripts/refresh-target-lines.mjs <optional maps>
- bun skills/migration-atlas/scripts/validate-map.mjs <map path>
- bun skills/migration-atlas/scripts/generate-viewer.mjs

Viewer output:
- docs/migration/viewer.html
- docs/migration/viewer.js
- docs/migration/viewer-data.json

Goal:
- Keep the migration ledger precise and clickable.
- Favor minimum runnable migrations over broad rewrites.
```
