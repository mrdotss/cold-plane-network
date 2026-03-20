# Cold Network Plane — Security Guidelines

## Password Handling

- MUST hash passwords with `bcrypt` (cost ≥ 12) or `argon2id`.
- MUST NOT store plaintext passwords anywhere (DB, logs, audit metadata).
- MUST NOT log password values, even partially.
- MUST validate password strength on registration:
  - Minimum 8 characters.
  - SHOULD require at least one uppercase, one lowercase, one digit.

## Session Cookies

- Session token MUST be a cryptographically random string (≥ 32 bytes, hex or base64url).
- Cookie attributes:
  - `HttpOnly`: MUST be true.
  - `Secure`: MUST be true in production; MAY be false in local dev.
  - `SameSite`: MUST be `Lax` (or `Strict`).
  - `Path`: `/`.
  - `Max-Age`: SHOULD match session TTL (e.g., 7 days).
- Session lookup via Drizzle MUST happen on every protected request (no trust-the-cookie-alone).

## Brute-Force Mitigation

- Auth endpoints (`/api/auth/login`, `/api/auth/register`) SHOULD implement basic rate limiting.
- MVP approach: in-memory counter per IP or username, reset after window (e.g., 5 attempts / 15 min).
- MUST return generic error messages ("Invalid credentials") — never reveal whether username exists.
- SHOULD log `AUTH_LOGIN_FAILURE` events for monitoring.

## Audit Metadata Redaction

### Allowlist Approach

- Audit metadata MUST only contain fields from a predefined allowlist per event type.
- Any field not on the allowlist MUST be stripped before DB write.

### Denylist Fields (always strip)

These fields MUST NEVER appear in audit metadata:

- `password`, `passwordHash`, `secret`, `token`, `apiKey`, `credential`
- `specBody`, `specContent`, `artifactContent`, `terraformCode`
- Any field whose serialized value exceeds 256 characters

### Bounded Metadata

- Total serialized metadata per event MUST be ≤ 1 KB.
- If metadata exceeds the limit, truncate or drop non-essential fields and add `{ "_truncated": true }`.

## Data Persistence Rules

| Category | Allowed in DB? |
|----------|---------------|
| User account (id, username, passwordHash, createdAt) | YES |
| Session (id, userId, expiresAt) | YES |
| Audit event (id, userId, eventType, metadata, createdAt) | YES |
| Spec body / content | NO — client-side only |
| Generated artifacts (Terraform, configs) | NO — client-side only |
| Secrets, API keys, device credentials | NO — never persisted |
| Large unbounded text blobs | NO |

## Append-Only Audit Logs

- In MVP, audit log rows MUST NOT be updated or deleted.
- No `DELETE FROM audit_events` or `UPDATE audit_events` queries.
- Future: add soft-delete or archival with retention policies.

## Database Connection Security

- Database connections MUST use SSL (`sslmode=require` in the connection string).
- PostgreSQL credentials MUST be stored in the `DATABASE_URL` environment variable, never hardcoded.
- `DATABASE_URL` MUST NOT appear in logs, audit metadata, or client-side code.
- Connection pooling via `pg.Pool` MUST be configured with reasonable limits (e.g., `max: 10`).

## CSRF Protection

- Route Handlers that mutate state (POST/PUT/DELETE) SHOULD validate the `Origin` header matches the app's origin.
- SameSite=Lax cookies provide baseline CSRF protection for top-level navigations.

## Assumptions & Open Questions

- **Assumption**: HTTPS is handled by the deployment layer (Vercel, reverse proxy), not by Next.js itself.
- **Assumption**: Rate limiting in MVP is in-memory; acceptable for single-server deployment.
- **Open**: Should we add CAPTCHA on registration to prevent automated signups?
- **Open**: Should session tokens be rotated on sensitive actions (password change)?
