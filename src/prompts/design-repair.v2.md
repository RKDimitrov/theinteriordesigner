
---user---
The app placed your plan, but the layout still breaks {{errorCount}} rule(s) (repair {{attempt}} of {{maxAttempts}}). Answer with submit_patch: a small change to your plan, not a new design.

Remaining problems (JSON, each with a hint):
{{issues}}

Pieces the app already had to leave out:
{{dropped}}

Where the solver put your pieces (by wall or relation):
{{layout}}

Patch options:
- `move`: give a piece another `wallIndex`, or another `anchor` / `relativeTo`.
- `resize`: a smaller `sizeClass`.
- `remove`: ids of pieces the room cannot hold. Prefer removing priority 3 pieces over breaking a clearance.
- `add`: only if a replacement is clearly better (for example a narrower piece of another category).
Keep everything else as it is.
