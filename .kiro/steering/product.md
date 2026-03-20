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

## MVP Scope (this iteration)

The MVP delivers eight pillars:

1. **Auth** — Register, login, logout with credential-based sessions.
2. **Studio** — Spec editor (code + form tabs), live topology preview, artifact output.
3. **Live Topology Preview** — Node/edge diagram derived from the spec, updating as the user edits.
4. **Artifacts** — Generate Terraform / config files from the parsed spec.
5. **Share / Download** — Copy a share link; download a ZIP of generated artifacts.
6. **Audit** — Append-only event log of user actions with bounded metadata.
7. **Sizing** — Single Generate Report feature with AI-powered auto-fill for AWS pricing data.
8. **Chatbot** — AI-powered conversational analysis integrated alongside Sizing report generation, using Azure AI Foundry's `cpn-agent` for multi-turn conversations about pricing and cost optimization.

## Explicit Non-Goals (MVP)

- NO network automation execution (push configs to devices).
- NO insider / device log ingestion or analysis.
- NO multi-tenant organization model (single-user or flat user list).
- NO real-time collaboration (multi-cursor editing).
- NO paid tier or billing.

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

## Future Roadmap (out of MVP)

- MikroTik RouterOS + Cisco IOS automation (push generated configs to devices).
- Insider log management: ingest device/syslog streams, correlate with topology.
- Multi-tenant organizations with RBAC.
- Real-time collaborative editing.
- Audit log export (CSV, JSON) and retention policies.

## Assumptions & Open Questions

- **Assumption**: Single-user or flat user list is sufficient for MVP.
- **Assumption**: Spec format (DSL vs JSON vs YAML) will be defined during the Studio spec; steering does not prescribe it.
- **Open**: Should share links be time-limited or permanent?
- **Open**: Should audit events be queryable by event type in the UI, or just a flat chronological list?
- **Open**: Will workspace concept map 1:1 to a spec file, or can a workspace contain multiple specs?
