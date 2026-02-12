# Cold Network Plane — Technical Stack & Constraints

## Runtime & Framework

- **Next.js 16** with App Router. All pages under `app/`.
- **TypeScript** strict mode.
- **Node.js runtime** required (not Edge) — Prisma + SQLite need Node APIs.
- API endpoints live under `app/api/**/route.ts` as Route Handlers.

## Database

- **SQLite** via **Prisma ORM**.
- DB file at project root: `prisma/dev.db` (gitignored).
- Prisma schema at `prisma/schema.prisma`.
- DB is ONLY for:
  1. User accounts (id, username, passwordHash, createdAt).
  2. Sessions (id, userId, expiresAt).
  3. Audit events (id, userId, eventType, metadata JSON, createdAt).
- DB MUST NOT store: spec bodies, artifact contents, secrets, large blobs.

## Authentication

- Credential-based: username + password.
- Password hashing: use `bcrypt` (or `@node-rs/argon2`) with cost factor ≥ 12.
- Sessions: opaque token stored in an HTTP-only, Secure, SameSite=Lax cookie.
- Session lookup via Prisma on each protected request.
- MUST validate session on every API route and server component that requires auth.

## Audit Logging

- Append-only table; no UPDATE or DELETE in MVP.
- Each row: `{ id, userId, eventType, metadata, createdAt }`.
- `metadata` is a JSON string, bounded to ≤ 1 KB after serialization.
- Metadata MUST be redacted before write (strip PII, secrets, large payloads).
- Retention: no auto-purge in MVP; SHOULD add TTL later.

## Live Topology Preview

### Renderer

- MUST use **`@xyflow/react`** (React Flow) as the node/edge diagram renderer.
- MUST use **`@dagrejs/dagre`** for automatic graph layout (hierarchical/directed).
- MUST support: pan, zoom, node selection, fit-to-view.
- SHOULD support elkjs as an alternative layout engine in a future iteration.
- React Flow custom node types and edge types MUST be defined in `lib/topology/node-types.ts`
  and `lib/topology/edge-types.ts` respectively (see `contracts.md` for Graph IR shapes).

### Performance Rules

- Spec parsing/validation MUST be **debounced** (target: 150–300 ms after last keystroke).
- Topology graph updates MUST NOT trigger full React tree rerenders.
  - Use `useMemo` / `useCallback` to stabilize node/edge arrays.
  - React Flow's internal state handles viewport; do not fight it.
- Node/edge diffing: only push changed nodes/edges to React Flow, not the full array on every parse.
  Use canonical stable IDs (see `contracts.md` § Canonical Stable IDs) for efficient set comparison.
- Re-layout (dagre) MUST only run when the graph **structure** changes (node/edge add/remove),
  NOT on metadata-only updates (label change, meta field edit).
- For specs with > 100 nodes, SHOULD virtualize or cluster to keep interaction smooth.
- SHOULD keep the main thread responsive; if dagre layout exceeds ~50 ms on large graphs,
  consider offloading to a Web Worker.

### Data Flow

```
Editor keystroke
  → debounce (150–300ms)
  → parse spec → validate
  → build Graph IR (nodes + edges, per contracts.md)
  → diff against previous Graph IR (by stable IDs)
  → patch React Flow state (add/remove/update only changed nodes/edges)
  → re-layout via dagre ONLY if topology structure changed
```

## UI Framework

- **shadcn/ui** with preset: `radix-nova`, baseColor `neutral`, icon library `hugeicons`, font `geist`.
- Components.json already configured at project root.
- Use existing `components/ui/*` primitives; add new shadcn components via `npx shadcn@latest add <name>`.
- Keep UI compact and dense; avoid excessive whitespace.

## Client / Server Boundaries

| Boundary | Rule |
|----------|------|
| Prisma | Server-only. NEVER import `@prisma/client` in client components. |
| Spec parsing + artifact generation | Client-side. No server round-trip needed. |
| Auth helpers | Server-side Route Handlers + server components. |
| Audit write | Server-side Route Handler (`POST /api/audit`). Client calls via fetch. |
| Audit read | Server-side Route Handler (`GET /api/audit`). |
| Topology rendering | Client-side (React Flow). |

## Key Dependencies to Add

| Package | Purpose |
|---------|---------|
| `prisma` + `@prisma/client` | ORM + SQLite |
| `bcrypt` or `@node-rs/argon2` | Password hashing |
| `@xyflow/react` | Node/edge diagram renderer |
| `@dagrejs/dagre` | Auto-layout for topology graphs |
| `jszip` | ZIP generation for artifact download |
| `lz-string` | Share link compression (optional) |

## Client-Side Storage

- Spec content MUST be stored client-side only. Preferred storage: **IndexedDB** (via a thin wrapper like `idb`).
- Fallback: `localStorage` for small specs (< 5 KB), but IndexedDB is preferred for larger payloads.
- Generated artifacts are ephemeral and MUST NOT be persisted to any server-side store.
- The DB (SQLite via Prisma) stores ONLY auth data and audit metadata — never spec or artifact bodies.
- On page load, the Studio SHOULD restore the last-edited spec from IndexedDB if available.

## Assumptions & Open Questions

- **Assumption**: Node runtime is acceptable for all deployments (no Edge requirement).
- **Assumption**: SQLite is sufficient for MVP scale (single-server, low concurrency).
- **Open**: Should we use `better-sqlite3` directly for audit write performance, or is Prisma sufficient?
- **Open**: CodeMirror vs Monaco for the spec editor — React2AWS uses CodeMirror; should we follow suit?
- **Open**: Should dagre layout run in a Web Worker to avoid blocking the main thread on large topologies?
- **Open**: Should IndexedDB storage use a library (`idb`, `dexie`) or a raw wrapper?

## MCP tools available (use when needed)

- `shadcn` MCP is connected: When you need shadcn/ui components/blocks/templates (landing sections, dashboard shell, forms, dialogs, tabs), prefer using the shadcn MCP tools to SEARCH/BROWSE and (if appropriate) INSTALL components from the configured registry in `components.json` rather than guessing APIs/props. Use MCP output as the source of truth.
- `next-devtools` MCP is connected: For any Next.js questions (App Router routing, Route Groups, Metadata API, Route Handlers), use next-devtools MCP documentation tools instead of memory. Start the session by calling the `init` tool. If a Next.js dev server is running (Next.js 16+), use `nextjs_index` / `nextjs_call` for runtime diagnostics (errors, routes, logs).
- If MCP tools are unavailable or don’t cover the question, fall back to `#spec` and `#codebase` context and explain the assumption.