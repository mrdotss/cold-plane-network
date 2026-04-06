---
inclusion: manual
---

# Cold Network Plane — Product Vision & Scope

## Vision

Cold Network Plane is a spec-first Studio for designing hybrid cloud and network planes.
Users author a declarative spec (code or form), see a LIVE topology diagram of nodes and
edges, generate deployment artifacts (Terraform, configs), and share/download results —
all from a single browser tab.

## Personas

| Persona | Description |
|---------|-------------|
| Network Engineer | Designs multi-vendor topologies (MikroTik, Cisco, cloud VPCs). Wants visual feedback while editing. |
| Platform / DevOps Engineer | Generates Terraform from a topology spec. Needs artifact download + share links. |
| Team Lead / Auditor | Reviews who did what and when. Reads the audit log, never edits specs directly. |

## Current Scope

The platform delivers ten pillars across three phases:

### Phase 1–3 (Delivered)

1. **Auth** — Register, login, logout with credential-based sessions.
2. **Studio** — Spec editor (code + form tabs), live topology preview, artifact output.
3. **Live Topology Preview** — Node/edge diagram derived from the spec, updating as the user edits.
4. **Artifacts** — Generate Terraform / config files from the parsed spec.
5. **Share / Download** — Copy a share link; download a ZIP of generated artifacts.
6. **Audit** — Append-only event log of user actions with bounded metadata.
7. **Sizing** — Single Generate Report feature with AI-powered auto-fill for AWS pricing data.
8. **Chatbot** — AI-powered conversational analysis integrated alongside Sizing report generation, using Azure AI Foundry's `cpn-agent` for multi-turn conversations about pricing and cost optimization.
9. **Migration Advisor** — Import Azure resource inventories and get AWS migration recommendations with confidence ratings and topology visualization.
10. **CFM Analysis** — Connect AWS accounts via IAM roles and scan for cost optimization opportunities across EC2, RDS, S3, Lambda, NAT Gateway, CloudWatch, ECS, and CloudTrail using 50+ AI-powered CFM MCP tools.
11. **CSP Analysis** — Cloud Security Posture scanning across IAM, networking (VPC/SG), S3, CloudTrail, AWS Config, and Access Analyzer with exponential decay scoring (0–100), severity classification (Critical/High/Medium/Low), and step-by-step remediation guidance.

### Phase 4 (Delivered — AI-Powered Insights & Automation)

12. **Notification Center** — In-app notification system with bell icon, popover dropdown, unread badges, and "Mark all as read". Supports 6 notification types: `cfm_scan_complete`, `csp_scan_complete`, `digest_summary`, `correlation_alert`, `savings_verified`, `security_regression`. Client polls every 30s for unread count.
13. **Weekly Digest** — Scheduled or manual AI-generated summary of spend changes, new findings, and security posture deltas. Stored as `digest_summary` notifications with markdown body rendered via `react-markdown`. Scheduling uses per-user cron expressions (validated via `cron-parser` CronExpressionParser) stored in `digestSchedules` table. Vercel Cron (`/api/notifications/digest/cron`) polls hourly and evaluates each user's schedule.
14. **Natural Language Queries** — "Insights" chat mode (`ChatModeSelector`) enabling users to query CFM recommendations and CSP findings via natural language. Agent uses MCP postgres tools (9 read-only tools) with mode-specific system prompt injection (`lib/chat/insights-prompt.ts`).
15. **Predictive Forecasting** — Server-side linear regression on scan history (`lib/insights/forecast.ts`) with configurable horizon (7d/30d/90d) for spend, security score, and finding count metrics. Client renders via Recharts `LineChart` with historical + dashed forecast lines. Optional "Ask AI" button streams agent narrative analysis.
16. **Cross-Domain Correlation** — Server-side SQL join with resource ID normalization (`lib/insights/correlations.ts`) correlating CFM cost recommendations with CSP security findings by normalized resource ID. Client renders `CorrelationTable` showing resources that are both over-provisioned AND insecure.
17. **Savings Realization Tracker** — Automated post-scan verification (`lib/insights/savings-verifier.ts`) comparing resource metrics pre/post recommendation implementation. Tracks `actualSavings`, `verificationStatus`, `verifiedAt` on `cfmRecommendationTracking`. Client renders `SavingsTracker` component with verification status badges.

### Phase 5 (Next — Professional Dashboard UX)

18. **Dark Mode** — Full dark mode support with `next-themes` provider, toggle, and chart theming.
19. **Saved Views** — Save and recall filter combinations across CFM and CSP dashboards (e.g., "prod accounts in ap-southeast-1 with critical findings").
20. **Annotations** — Add timestamped notes to data points, scans, and findings (e.g., "Spike due to load test on March 15").
21. **Real-Time Indicators** — WebSocket/SSE for live cost updates and security posture changes when billing data is available.

## Explicit Non-Goals (Current)

- NO network automation execution (push configs to devices).
- NO insider / device log ingestion or analysis.
- NO multi-tenant organization model / RBAC (single-user or flat user list).
- NO real-time collaboration (multi-cursor editing).
- NO paid tier or billing.
- NO customizable drag-and-drop dashboard widgets (deferred).
- NO team sharing / dashboard sharing (deferred, requires RBAC).

## Hard Data-Handling Policy

| Rule | Detail |
|------|--------|
| DB stores ONLY bounded metadata | User records, session tokens, audit event rows. |
| DB MUST NOT store spec bodies | Plane spec content lives client-side only. |
| DB MUST NOT store artifact contents | Generated Terraform / configs are ephemeral, client-side. |
| DB MUST NOT store secrets/tokens/credentials | No API keys, device passwords, or cloud credentials in PostgreSQL. |
| DB MUST NOT store large unbounded text blobs | Audit payloads MUST be bounded (see event taxonomy). |

## Event Taxonomy

All audit events use a `CATEGORY_ACTION` naming convention.

### AUTH_*

| Event | Metadata |
|-------|----------|
| `AUTH_REGISTER` | `{ username }` |
| `AUTH_LOGIN_SUCCESS` | `{ username }` |
| `AUTH_LOGIN_FAILURE` | `{ username, reason }` |
| `AUTH_LOGOUT` | `{}` |

### STUDIO_*

| Event | Metadata |
|-------|----------|
| `STUDIO_VALIDATE` | `{ resourceCount, errorCount }` |
| `STUDIO_GENERATE_ARTIFACTS` | `{ artifactTypes: string[], resourceCount }` |
| `STUDIO_DOWNLOAD_ZIP` | `{ artifactCount, totalSizeBytes }` |
| `STUDIO_COPY_SHARE_LINK` | `{ linkId }` |

### WORKSPACE_*

| Event | Metadata |
|-------|----------|
| `WORKSPACE_CREATE` | `{ name }` |
| `WORKSPACE_RENAME` | `{ oldName, newName }` |
| `WORKSPACE_DELETE` | `{ name }` |

### CHAT_*

| Event | Metadata |
|-------|----------|
| `CHAT_CREATED` | `{ chatId }` |
| `CHAT_MESSAGE_SENT` | `{ chatId, hasAttachments, attachmentTypes }` |
| `CHAT_DELETED` | `{ chatId }` |
| `CHAT_FILE_UPLOADED` | `{ fileType, fileSize }` |

> Metadata values MUST be bounded scalars or short arrays. Never include spec bodies,
> artifact contents, or credentials in metadata.

### CFM_*

| Event | Metadata |
|-------|----------|
| `CFM_ACCOUNT_CONNECTED` | `{ accountId, awsAccountId }` |
| `CFM_ACCOUNT_DELETED` | `{ accountId }` |
| `CFM_SCAN_STARTED` | `{ scanId, accountId, services, regions }` |
| `CFM_SCAN_COMPLETED` | `{ scanId, totalSavings, recommendationCount }` |
| `CFM_REPORT_EXPORTED` | `{ scanId, format }` |

### CSP_*

| Event | Metadata |
|-------|----------|
| `CSP_SCAN_STARTED` | `{ scanId, accountId }` |
| `CSP_SCAN_COMPLETED` | `{ scanId, securityScore, findingCount }` |
| `CSP_FINDING_RESOLVED` | `{ findingId, ruleId }` |

### NOTIFICATION_*

| Event | Metadata |
|-------|----------|
| `NOTIFICATION_DIGEST_TRIGGERED` | `{ triggerType: "scheduled" \| "manual", accountCount }` |
| `NOTIFICATION_DISMISSED` | `{ notificationId }` |

## Future Roadmap (deferred)

- MikroTik RouterOS + Cisco IOS automation (push generated configs to devices).
- Insider log management: ingest device/syslog streams, correlate with topology.
- Multi-tenant organizations with RBAC and team sharing.
- Real-time collaborative editing.
- Audit log export (CSV, JSON) and retention policies.
- Customizable drag-and-drop dashboard widgets.
- Email/Slack notification delivery channels.

## Assumptions & Open Questions

- **Assumption**: Single-user or flat user list is sufficient for MVP.
- **Assumption**: Spec format (DSL vs JSON vs YAML) will be defined during the Studio spec; steering does not prescribe it.
- **Open**: Should share links be time-limited or permanent?
- **Open**: Should audit events be queryable by event type in the UI, or just a flat chronological list?
- **Open**: Will workspace concept map 1:1 to a spec file, or can a workspace contain multiple specs?
