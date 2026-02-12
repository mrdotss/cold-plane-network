# Cold Network Plane — Project Structure

## Current State (confirmed)

```
app/
  layout.tsx              # Root layout (html/body, fonts, global providers)
  page.tsx                # Landing / redirect (to be moved into route group)
  globals.css
  login/page.tsx          # Login page (shadcn block)
  signup/page.tsx         # Signup page (shadcn block)
  dashboard/page.tsx      # Dashboard home
components/
  ui/                     # shadcn primitives (button, card, input, etc.)
  app-sidebar.tsx         # Sidebar shell
  login-form.tsx          # Login form component
  signup-form.tsx         # Signup form component
  nav-*.tsx               # Navigation components
hooks/                    # (empty — custom hooks go here)
lib/
  utils.ts                # cn() and shared utils
public/                   # Static assets
```

## Route Group Convention

MUST use Next.js Route Groups to separate public marketing pages from authenticated app pages:

```
app/
  layout.tsx              # Root layout (html/body, fonts, global CSS)
  globals.css
  (marketing)/
    layout.tsx            # Marketing layout: no sidebar, no auth
    page.tsx              # Landing page at /
  (app)/
    layout.tsx            # App layout: sidebar + auth guard
    dashboard/
      page.tsx            # Dashboard home
      studio/page.tsx     # Studio
      audit/page.tsx      # Audit log
      settings/page.tsx   # Settings
  login/page.tsx          # Standalone (no route group)
  signup/page.tsx         # Standalone (no route group)
  api/                    # API routes (outside both groups)
```

- `(marketing)` layout MUST NOT check auth or render the sidebar.
- `(app)` layout MUST validate the session and redirect to `/login` if unauthenticated.
- Login/signup pages stay outside route groups to render with their own minimal layout.
- API routes remain at `app/api/` — route groups do not affect API routing.

## Required Routes (MVP)

### Pages

| Route | Purpose |
|-------|---------|
| `app/dashboard/page.tsx` | Dashboard home (exists) |
| `app/dashboard/studio/page.tsx` | Studio — editor + preview + artifacts |
| `app/dashboard/audit/page.tsx` | Audit log viewer |
| `app/dashboard/settings/page.tsx` | User settings (password change, preferences) |

### API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `app/api/auth/login/route.ts` | POST | Login (validate credentials, create session) |
| `app/api/auth/register/route.ts` | POST | Register (create user, hash password) |
| `app/api/auth/logout/route.ts` | POST | Logout (destroy session, clear cookie) |
| `app/api/auth/session/route.ts` | GET | Validate current session (for client checks) |
| `app/api/audit/route.ts` | POST, GET | POST: log audit event; GET: list events (paginated) |

## Recommended Module Structure

### `lib/db/`

```
lib/db/
  client.ts               # Singleton Prisma client (server-only)
  index.ts                # Re-export
```

### `lib/auth/`

```
lib/auth/
  password.ts             # hashPassword(), verifyPassword()
  session.ts              # createSession(), validateSession(), destroySession()
  middleware.ts            # requireAuth() helper for Route Handlers
  index.ts
```

### `lib/audit/`

```
lib/audit/
  events.ts               # Event type enum + metadata type definitions
  writer.ts               # Server-side: writeAuditEvent(userId, type, metadata)
  redact.ts               # Metadata redaction (allowlist/denylist, size cap)
  client.ts               # Client-side: logEvent() wrapper (calls POST /api/audit)
  index.ts
```

### `lib/spec/`

```
lib/spec/
  schema.ts               # Spec schema definition (Zod or similar)
  parser.ts               # Parse raw spec text → structured AST/IR
  validator.ts            # Validate parsed spec (semantic checks)
  graph-builder.ts        # AST/IR → { nodes: Node[], edges: Edge[] }
  generators/
    terraform.ts          # Generate Terraform HCL from parsed spec
    index.ts              # Re-export all generators
  index.ts
```

### `lib/topology/`

```
lib/topology/
  layout.ts               # dagre auto-layout: nodes+edges → positioned nodes
  node-types.ts           # React Flow custom node type definitions
  edge-types.ts           # React Flow custom edge type definitions
  utils.ts                # Graph diffing, fit-to-view helpers
  index.ts
```

### `components/studio/`

```
components/studio/
  StudioLayout.tsx         # 3-panel layout shell
  editor/
    SpecEditor.tsx         # Code editor tab (CodeMirror or Monaco)
    SpecForm.tsx           # Form-based editor tab
    EditorTabs.tsx         # Tab switcher (Editor | Form)
  preview/
    TopologyCanvas.tsx     # React Flow canvas wrapper
    ResourceList.tsx       # Inventory / resource table below canvas
    PreviewToolbar.tsx     # Validate, Generate, Share, Download buttons
  output/
    ArtifactViewer.tsx     # Generated Terraform / config viewer
    DiagnosticsPanel.tsx   # Validation errors + warnings
    DiffViewer.tsx         # Before/after diff (optional MVP)
    OutputTabs.tsx         # Tab switcher (Artifacts | Diagnostics | Diff)
```

### `components/audit/`

```
components/audit/
  AuditTable.tsx           # Paginated event table
  AuditFilters.tsx         # Filter by event type, date range, user
  AuditDetailDrawer.tsx    # Side drawer showing full event metadata
```

### `components/marketing/`

```
components/marketing/
  Navbar.tsx               # Sticky nav: logo + anchor links + CTA
  Hero.tsx                 # Hero section with headline + CTA
  Features.tsx             # Feature cards grid (3–4 cards)
  HowItWorks.tsx           # 3-step visual flow
  DemoPreview.tsx          # Static/animated Studio preview placeholder
  CTABanner.tsx            # Full-width call-to-action banner
  Footer.tsx               # Minimal footer with links + attribution
```

### `components/topology/`

```
components/topology/
  TopologyCanvas.tsx       # React Flow wrapper (pan/zoom/select/fit)
  CustomNode.tsx           # Custom React Flow node component
  CustomEdge.tsx           # Custom React Flow edge component
  TopologyControls.tsx     # Fit-to-view, zoom controls overlay
```

### `lib/contracts/`

```
lib/contracts/
  graph-ir.ts              # GraphNode, GraphEdge, GraphIR type definitions
  artifact-manifest.ts     # ArtifactManifest, ArtifactFile type definitions
  index.ts                 # Re-export all contract types
```

## Client / Server Boundary Rules

- `lib/db/*` — server-only. Add `"use server"` or `import "server-only"` guard.
- `lib/auth/*` — server-only.
- `lib/audit/writer.ts` — server-only. `lib/audit/client.ts` — client-safe (fetch wrapper).
- `lib/spec/*` — client-side. No server imports.
- `lib/topology/*` — client-side.
- `components/studio/*` — client components (`"use client"`).
- `components/audit/*` — MAY be server components if data is fetched server-side.
- UI components MUST NEVER import `@prisma/client` or any `lib/db/*` module.

## Prisma Schema Location

```
prisma/
  schema.prisma            # User, Session, AuditEvent models
  dev.db                   # SQLite file (gitignored)
```

## Multi-Root Workspace Rule

- If `React2AWS/` is present as a second workspace root, treat it as READ-ONLY reference.
- MUST NOT write, edit, or delete any file under `React2AWS/**`.
- MAY read and copy patterns from `React2AWS/` into `cold-plane-network/`.

## Assumptions & Open Questions

- **Assumption**: `app/(app)/layout.tsx` will wrap all dashboard sub-routes with sidebar + auth guard.
- **Assumption**: Studio is desktop-first; mobile layout is a non-goal for MVP.
- **Assumption**: Route group migration from current flat `app/` structure is a one-time refactor early in implementation.
- **Open**: Should `lib/spec/generators/` support pluggable generator registration, or hardcode Terraform only for MVP?
- **Open**: Should the editor use CodeMirror (like React2AWS) or Monaco? CodeMirror is lighter; Monaco has richer LSP support.
- **Open**: Should `components/studio/` follow the React2AWS pattern of co-located `index.tsx` barrel files per subfolder?
