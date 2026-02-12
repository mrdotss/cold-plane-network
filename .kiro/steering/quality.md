# Cold Network Plane — Quality & Testing Standards

## Definition of Done

A task is considered "done" when ALL of the following are true:

1. Code compiles with zero TypeScript errors (`tsc --noEmit` passes).
2. ESLint passes with no errors (warnings acceptable if documented).
3. All existing tests pass.
4. New functionality has appropriate test coverage (see below).
5. UI changes are visually consistent with the shadcn Nova/neutral theme.
6. No `any` types introduced without a justifying comment.
7. Server-only modules are guarded (`import "server-only"` or equivalent).
8. Audit events are logged for user-facing actions per the event taxonomy.

## Testing Expectations

### Unit Tests

#### Spec Validator

- MUST have unit tests covering:
  - Valid spec → no errors returned.
  - Missing required fields → appropriate error messages.
  - Invalid resource types → rejection with clear diagnostics.
  - Edge cases: empty spec, spec with only comments, duplicate resource names.

#### Audit Serializer / Redaction

- MUST have unit tests covering:
  - Allowlisted fields pass through unchanged.
  - Denylisted fields (`password`, `secret`, `specBody`, etc.) are stripped.
  - Metadata exceeding 1 KB is truncated with `_truncated: true` marker.
  - Empty metadata object is handled gracefully.
  - Nested objects with denylisted keys at depth > 1 are stripped.

### Integration Tests

#### Auth Routes

- MUST test:
  - `POST /api/auth/register` — successful registration returns 201 + session cookie.
  - `POST /api/auth/register` — duplicate username returns 409.
  - `POST /api/auth/login` — valid credentials return 200 + session cookie.
  - `POST /api/auth/login` — invalid credentials return 401 (generic message).
  - `POST /api/auth/logout` — clears session cookie, invalidates session in DB.
  - `GET /api/auth/session` — valid session returns user info; expired/missing returns 401.

#### Audit Routes

- MUST test:
  - `POST /api/audit` — valid event is persisted and returns 201.
  - `POST /api/audit` — oversized metadata is rejected or truncated.
  - `GET /api/audit` — returns paginated list, most recent first.
  - `GET /api/audit` — unauthenticated request returns 401.

### E2E Smoke Test

A basic end-to-end test MUST cover this critical path:

1. **Register** a new user → redirected to dashboard.
2. **Login** with the new user → session established.
3. Navigate to **Studio**.
4. Enter a minimal spec in the editor.
5. Click **Validate** → Diagnostics tab shows no errors.
6. Click **Generate** → Artifacts tab shows generated Terraform.
7. Click **Download** → ZIP file is downloaded.
8. Navigate to **Audit** → event log shows `STUDIO_GENERATE_ARTIFACTS` and `STUDIO_DOWNLOAD_ZIP` entries.

## Testing Framework

- Unit + integration: **Vitest** (or Jest if Vitest is not feasible with the current setup).
- E2E: **Playwright** (already used in React2AWS reference).
- Property-based testing: **fast-check** for spec parser/validator properties.
- Test files: co-locate with source using `.test.ts` / `.test.tsx` suffix, or use `__tests__/` directories.

## Code Quality Rules

- MUST NOT use `any` without a justifying `// eslint-disable-next-line` + comment.
- MUST NOT use `console.log` in production code; use structured logging or remove.
- MUST NOT commit `.env` files with real credentials; use `.env.example` with placeholders.
- SHOULD keep functions under 50 lines; extract helpers for complex logic.
- SHOULD prefer named exports over default exports for better tree-shaking and refactoring.

## CI Expectations (future)

- Lint → Type check → Unit tests → Integration tests → Build → E2E tests.
- All steps MUST pass before merge.
- Coverage thresholds: SHOULD target ≥ 80% for `lib/spec/*` and `lib/audit/*`.

## Assumptions & Open Questions

- **Assumption**: Vitest is the preferred test runner; will add to devDependencies when testing begins.
- **Assumption**: E2E tests run against a local dev server with a fresh SQLite DB.
- **Open**: Should we use `msw` (Mock Service Worker) for integration tests, or test against real Route Handlers?
- **Open**: Should coverage thresholds be enforced in CI from day one, or introduced incrementally?
- **Open**: Should we add visual regression testing (e.g., Playwright screenshots) for the Studio layout?
