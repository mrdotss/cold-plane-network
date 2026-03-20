# Cold Network Plane — Project Structure

## Current State (confirmed)

```
app/
  layout.tsx              # Root layout (html/body, fonts, global providers)
  globals.css
  (marketing)/
    layout.tsx            # Marketing layout: no sidebar, no auth
    page.tsx              # Landing page at /
  (app)/
    layout.tsx            # App layout: sidebar + auth guard
    dashboard/
      page.tsx            # Dashboard home
      sizing/page.tsx     # Sizing tool (report + chat)
      studio/page.tsx     # Terraform Studio
      migration/page.tsx  # Migration Advisor
      cfm/page.tsx        # CFM Analysis
      audit/page.tsx      # Audit log viewer
      settings/page.tsx   # User settings
  login/page.tsx          # Login page
  signup/page.tsx         # Signup page
  api/
    auth/                 # Auth routes (login, register, logout, session)
    audit/                # Audit event routes
    dashboard/            # Dashboard data routes
    projects/             # Migration project routes
    sizing/               # Sizing report + autofill routes
      route.ts            # GET (list), POST (create report)
      autofill/route.ts   # POST (AI pricing autofill)
    chat/                 # Chat routes
      route.ts            # POST (send message, stream response)
      [chatId]/route.ts   # GET (chat history), DELETE (remove chat)
    files/
      upload/route.ts     # POST (upload file attachment)
components/
  ui/                     # shadcn primitives (button, card, input, etc.)
  sizing/                 # Sizing feature components
  chat/                   # Chat feature components
  audit/                  # Audit log components
  dashboard/              # Dashboard layouts
  marketing/              # Landing page components
  studio/                 # Terraform Studio components
  migration/              # Migration Advisor components
hooks/                    # Custom React hooks
lib/
  db/                     # Drizzle ORM client + schema
    client.ts             # Singleton Drizzle client (server-only)
    schema.ts             # All table definitions (pg-core)
    migrations/           # Drizzle-kit generated migrations
  auth/                   # Authentication
  audit/                  # Audit logging
  sizing/                 # Sizing feature logic
  chat/                   # Chat feature logic
  export/                 # Export utilities
  utils.ts                # cn() and shared utils
public/                   # Static assets
drizzle.config.ts         # Drizzle-kit configuration
```

## Route Group Convention

MUST use Next.js Route Groups to separate public marketing pages from authenticated app pages:

- `(marketing)` layout MUST NOT check auth or render the sidebar.
- `(app)` layout MUST validate the session and redirect to `/login` if unauthenticated.
- Login/signup pages stay outside route groups to render with their own minimal layout.
- API routes remain at `app/api/` — route groups do not affect API routing.

## Required Routes

### Pages

| Route | Purpose |
|-------|---------|
| `app/(app)/dashboard/page.tsx` | Dashboard home |
| `app/(app)/dashboard/sizing/page.tsx` | Sizing — report generation + chatbot |
| `app/(app)/dashboard/studio/page.tsx` | Studio — editor + preview + artifacts |
| `app/(app)/dashboard/migration/page.tsx` | Migration Advisor |
| `app/(app)/dashboard/cfm/page.tsx` | CFM Analysis |
| `app/(app)/dashboard/audit/page.tsx` | Audit log viewer |
| `app/(app)/dashboard/settings/page.tsx` | User settings |

### API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `app/api/auth/login/route.ts` | POST | Login |
| `app/api/auth/register/route.ts` | POST | Register |
| `app/api/auth/logout/route.ts` | POST | Logout |
| `app/api/auth/session/route.ts` | GET | Validate session |
| `app/api/audit/route.ts` | POST, GET | Log / list audit events |
| `app/api/sizing/route.ts` | GET, POST | List / create sizing reports |
| `app/api/sizing/autofill/route.ts` | POST | AI pricing tier autofill |
| `app/api/chat/route.ts` | POST | Send message, stream AI response |
| `app/api/chat/[chatId]/route.ts` | GET, DELETE | Get chat history / delete chat |
| `app/api/chat/list/route.ts` | GET | List user's chat conversations |
| `app/api/files/upload/route.ts` | POST | Upload file attachment |
| `app/api/projects/route.ts` | GET, POST | Migration projects |

## Module Structure

### `lib/db/`

```
lib/db/
  client.ts               # Singleton Drizzle client (server-only, uses pg Pool)
  schema.ts               # All table definitions using drizzle-orm/pg-core
  migrations/             # Drizzle-kit generated SQL migrations
  index.ts                # Re-export client + schema
```

### `lib/auth/`

```
lib/auth/
  password.ts             # hashPassword(), verifyPassword()
  session.ts              # createSession(), validateSession(), destroySession()
  middleware.ts            # requireAuth() helper for Route Handlers
  cookie.ts               # Session cookie configuration
  rate-limit.ts           # Login rate limiting
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

### `lib/sizing/`

```
lib/sizing/
  agent-client.ts         # Azure AI Foundry agent calls (autofill + streaming)
  parser.ts               # AWS pricing JSON parser
  excel-generator.ts      # Excel workbook generation
  merge.ts                # Autofill data merging
  types.ts                # Type definitions
  validators.ts           # Zod schemas
  serializer.ts           # JSON round-trip
  __tests__/              # Property-based tests
```

### `lib/chat/`

```
lib/chat/
  agent-client.ts         # Azure AI Foundry chat agent (conversations API)
  queries.ts              # DB queries: createChat, getChat, listChats, saveMessage, deleteChat
  file-handler.ts         # File validation, temp storage, PDF text extraction
  types.ts                # Chat type definitions (ChatMessage, ChatConversation, etc.)
  index.ts
```

### `components/sizing/`

```
components/sizing/
  SizingPage.tsx           # Main sizing page layout (report panel + chat panel)
  FileUpload.tsx           # JSON upload & parse
  ReportPanel.tsx          # Generate Excel with autofill (formerly ReportTab)
  AutofillProgress.tsx     # Loading animation
```

### `components/chat/`

```
components/chat/
  ChatPanel.tsx            # Chat container with message list + input
  ChatMessages.tsx         # Scrollable message list
  ChatMessage.tsx          # Individual message bubble (user/assistant)
  ChatInput.tsx            # Multimodal input (text + file attachments)
  ChatSidebar.tsx          # Chat history list (past conversations)
  FileAttachment.tsx       # File attachment preview chip
  MarkdownRenderer.tsx     # Render AI markdown responses
```

### `components/studio/`

```
components/studio/
  StudioLayout.tsx         # 3-panel layout shell
  editor/                  # Spec editor components
  preview/                 # Topology canvas components
  output/                  # Artifact viewer components
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
  Navbar.tsx               # Sticky nav
  Hero.tsx                 # Hero section
  Features.tsx             # Feature cards grid
  HowItWorks.tsx           # 3-step visual flow
  DemoPreview.tsx          # Studio preview placeholder
  CTABanner.tsx            # Call-to-action banner
  Footer.tsx               # Footer
```

## Client / Server Boundary Rules

- `lib/db/*` — server-only. Add `import "server-only"` guard.
- `lib/auth/*` — server-only.
- `lib/audit/writer.ts` — server-only. `lib/audit/client.ts` — client-safe (fetch wrapper).
- `lib/sizing/agent-client.ts` — server-only.
- `lib/chat/agent-client.ts` — server-only.
- `lib/chat/queries.ts` — server-only.
- `lib/chat/file-handler.ts` — server-only.
- `lib/spec/*` — client-side. No server imports.
- `lib/topology/*` — client-side.
- `components/studio/*` — client components (`"use client"`).
- `components/chat/*` — client components (`"use client"`).
- `components/sizing/*` — client components (`"use client"`).
- `components/audit/*` — MAY be server components if data is fetched server-side.
- UI components MUST NEVER import `drizzle-orm` or any `lib/db/*` module.

## Drizzle Schema Location

```
lib/db/
  schema.ts               # All table definitions (users, sessions, audits, projects, sizing, chat)
  client.ts               # Drizzle client singleton
  migrations/             # SQL migration files
drizzle.config.ts         # Config pointing to schema.ts + migrations/
```

## Multi-Root Workspace Rule

- If `React2AWS/` is present as a second workspace root, treat it as READ-ONLY reference.
- MUST NOT write, edit, or delete any file under `React2AWS/**`.
- MAY read and copy patterns from `React2AWS/` into `cold-plane-network/`.

## Assumptions & Open Questions

- **Assumption**: `app/(app)/layout.tsx` wraps all dashboard sub-routes with sidebar + auth guard.
- **Assumption**: Studio is desktop-first; mobile layout is a non-goal for MVP.
- **Assumption**: Sizing page uses a split-panel layout (report left, chat right) on desktop.
- **Resolved**: Route group migration from flat `app/` to `(marketing)` + `(app)` groups is complete.
- **Resolved**: Migrated from Prisma/SQLite to Drizzle/PostgreSQL.
