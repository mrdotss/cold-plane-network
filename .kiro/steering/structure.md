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
      csp/page.tsx        # CSP Security Analysis
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
    cfm/                  # CFM Analysis routes
      accounts/route.ts   # Account CRUD
      scan/route.ts       # SSE scan endpoint
      export/route.ts     # Excel/PDF export
    csp/                  # CSP Analysis routes
      scan/route.ts       # SSE security scan endpoint
      [scanId]/route.ts   # Scan results
    notifications/        # Notification routes
      route.ts            # GET (list), PATCH (mark-read/dismiss)
      digest/
        route.ts          # POST (trigger manual digest generation)
        cron/route.ts     # GET (Vercel Cron — evaluates per-user schedules hourly)
        schedule/route.ts # GET, PUT (user's digest cron schedule)
    insights/             # Insights API routes
      forecast/route.ts   # GET (forecast with linear regression)
      correlations/route.ts # GET (cross-domain correlations)
      savings-tracker/route.ts # GET (savings verification status)
components/
  ui/                     # shadcn primitives (button, card, input, etc.)
  sizing/                 # Sizing feature components
  chat/                   # Chat feature components
  audit/                  # Audit log components
  dashboard/              # Dashboard layouts
  cfm/                    # CFM Analysis components
  csp/                    # CSP Security Analysis components
  marketing/              # Landing page components
  studio/                 # Terraform Studio components
  migration/              # Migration Advisor components
  notifications/          # Notification center components
  insights/               # Insights feature components (forecast, correlation, savings)
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
  cfm/                    # CFM Analysis logic (aws-connection, scanner, queries, export)
  csp/                    # CSP Analysis logic (scanner, security-rules, aws-security-collector)
  notifications/          # Notification CRUD, digest generation, scheduling
  insights/               # Forecast engine, correlation engine, savings verifier
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
| `app/(app)/dashboard/csp/page.tsx` | CSP Security Analysis |
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
| `app/api/projects/[projectId]/relationships/route.ts` | GET, POST | Azure resource relationships |
| `app/api/cfm/accounts/route.ts` | GET, POST, DELETE | CFM account CRUD |
| `app/api/cfm/scan/route.ts` | POST | Start CFM scan (SSE progress) |
| `app/api/cfm/export/route.ts` | POST | Export CFM report (Excel/PDF) |
| `app/api/csp/scan/route.ts` | POST | Start CSP scan (SSE progress) |
| `app/api/csp/[scanId]/route.ts` | GET | Get CSP scan results |
| `app/api/notifications/route.ts` | GET, PATCH | List / mark-read / dismiss notifications |
| `app/api/notifications/digest/route.ts` | POST | Trigger manual digest generation |
| `app/api/notifications/digest/cron/route.ts` | GET | Vercel Cron — evaluates per-user digest schedules hourly |
| `app/api/notifications/digest/schedule/route.ts` | GET, PUT | Get/update user's digest cron schedule |
| `app/api/insights/forecast/route.ts` | GET | Linear regression forecast (spend/security/findings) |
| `app/api/insights/correlations/route.ts` | GET | Cross-domain CFM↔CSP resource correlations |
| `app/api/insights/savings-tracker/route.ts` | GET | Savings verification status per recommendation |

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
  attachment-context.ts   # Build context strings from file attachments
  insights-prompt.ts      # System prompt builder for "insights" chat mode (injects MCP DB instructions)
  format-date.ts          # Date formatting utilities for chat
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
  ChatModeSelector.tsx     # Toggle between "general" and "insights" chat modes
  FileAttachment.tsx       # File attachment preview chip
  MarkdownRenderer.tsx     # Render AI markdown responses
```

### `lib/migration/`

```
lib/migration/
  relationship-engine.ts    # Pure logic: extract Azure resource relationships (name heuristic, ARM ID, properties, RG)
  aws-topology-builder.ts   # Pure logic: generate mirrored AWS topology from Azure relationships + mappings
  aws-service-icons.tsx     # AWS service name → official AWS icon component mapping
  azure-icons.tsx           # Azure resource type → category-colored hugeicons icon mapping
  __tests__/                # Property-based + unit tests for relationship engine and topology builder
```

### `lib/notifications/`

```
lib/notifications/
  service.ts              # createNotification(), getNotifications(), markAsRead(), unread count queries
  digest.ts               # generateDigest() — AI agent summarization of CFM/CSP deltas
  types.ts                # Notification type definitions (6 types, metadata shapes)
  index.ts                # Re-exports
```

### `lib/insights/`

```
lib/insights/
  forecast.ts             # Linear regression engine — computeLinearRegression(), generateForecast()
  correlations.ts         # Cross-domain correlation — normalizeResourceId(), findCorrelations()
  savings-verifier.ts     # Post-scan savings verification — verifySavings(), compare pre/post metrics
```

### `components/notifications/`

```
components/notifications/
  NotificationBell.tsx     # Bell icon with unread badge, Popover trigger (hydration-safe)
  NotificationCenter.tsx   # Notification list in popover — type icons, relative time, markdown digest expand
  DigestTrigger.tsx        # Manual digest generation button with loading state
```

### `components/insights/`

```
components/insights/
  ForecastChart.tsx        # Recharts LineChart — historical + dashed forecast, metric/horizon selectors, Ask AI
  CorrelationTable.tsx     # Cross-domain correlation results table (CFM ↔ CSP matches)
  SavingsTracker.tsx       # Savings verification status with progress badges
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

### `lib/cfm/`

```
lib/cfm/
  aws-connection.ts        # STS AssumeRole, test connection
  aws-collector.ts         # Collect AWS resource data (EC2, RDS, S3, Lambda, etc.)
  scanner.ts               # CFM scan orchestrator + agent calls
  queries.ts               # Account/scan/recommendation DB queries
  export-generator.ts      # Excel + PDF report generation
  scan-events.ts           # In-memory event bus for SSE progress
  types.ts                 # CFM type definitions
  validators.ts            # Zod schemas for CFM
```

### `lib/csp/`

```
lib/csp/
  aws-security-collector.ts  # Collect IAM, SG, S3, CloudTrail, Config, Access Analyzer data
  security-rules.ts          # 20+ security rules with detailed remediation steps
  scanner.ts                 # CSP scan orchestrator + exponential decay scoring
  types.ts                   # CSP type definitions
```

### `components/cfm/`

```
components/cfm/
  CfmDashboard.tsx         # Dashboard with summary cards + service grid
  CfmLanding.tsx           # Saved accounts list + add account
  AccountWizard.tsx        # 3-step connection wizard (Sheet)
  ScanProgress.tsx         # SSE-driven scan progress
  ServiceDeepDive.tsx      # Per-service recommendations + chat
  ExportDialog.tsx         # Export format selection
```

### `components/csp/`

```
components/csp/
  CspDashboard.tsx         # Security dashboard with score + findings
  CspLanding.tsx           # Account list for CSP scanning
  SecurityScoreCard.tsx    # Radial gauge score visualization
  FindingsTable.tsx        # Findings grid with Sheet detail panel
  CategoryBreakdown.tsx    # Category-level severity breakdown
  TopFindings.tsx          # Top critical/high findings summary
```

### `components/marketing/`

```
components/marketing/
  Navbar.tsx               # Sticky nav
  Hero.tsx                 # Hero section
  Features.tsx             # Feature cards grid (8 features)
  HowItWorks.tsx           # 3-step visual flow
  DemoPreview.tsx          # Studio preview placeholder
  MigrationAdvisor.tsx     # Migration Advisor section
  Sizing.tsx               # Sizing section
  CfmAnalysis.tsx          # CFM Analysis section
  CspAnalysis.tsx          # CSP Analysis section
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
- `lib/cfm/*` — server-only (AWS SDK, Drizzle queries).
- `lib/csp/*` — server-only (AWS SDK, Drizzle queries).
- `lib/notifications/*` — server-only.
- `lib/insights/*` — server-only (Drizzle queries, regression computations).
- `lib/chat/insights-prompt.ts` — server-only (injected into agent calls).
- `lib/spec/*` — client-side. No server imports.
- `lib/topology/*` — client-side.
- `components/studio/*` — client components (`"use client"`).
- `components/chat/*` — client components (`"use client"`).
- `components/sizing/*` — client components (`"use client"`).
- `components/audit/*` — MAY be server components if data is fetched server-side.
- `components/cfm/*` — client components (`"use client"`).
- `components/csp/*` — client components (`"use client"`).
- `components/notifications/*` — client components (`"use client"`).
- `components/insights/*` — client components (`"use client"`).
- UI components MUST NEVER import `drizzle-orm` or any `lib/db/*` module.

## Drizzle Schema Location

```
lib/db/
  schema.ts               # All table definitions (users, sessions, audits, projects, sizing, chat, cfm*, csp*, notifications, digestSchedules)
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
