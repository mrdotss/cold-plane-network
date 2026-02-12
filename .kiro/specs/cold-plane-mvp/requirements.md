# Requirements Document

## Introduction

Cold Network Plane is a spec-first Studio for designing hybrid cloud and network topologies. Users author a declarative spec (via code editor or structured form), see a live topology diagram of nodes and edges, generate deployment artifacts (Terraform, configs), and share or download results from a single browser tab. The MVP delivers six pillars: Authentication, Studio, Live Topology Preview, Artifact Generation, Share/Download, and Audit Logging.

## Glossary

- **System**: The Cold Network Plane web application
- **Auth_Module**: The server-side authentication subsystem handling registration, login, logout, and session management
- **Session_Manager**: The component responsible for creating, validating, and destroying user sessions via HTTP-only cookies
- **Studio**: The primary workspace page at `/dashboard/studio` containing the spec editor, live topology preview, and output panels
- **Spec_Parser**: The client-side module that parses raw spec text into a structured intermediate representation
- **Spec_Validator**: The client-side module that performs semantic validation on parsed spec data
- **Graph_Builder**: The client-side module that transforms parsed spec data into a Graph IR (nodes and edges)
- **Graph_IR**: The intermediate representation containing `GraphNode[]` and `GraphEdge[]` per the domain contracts
- **Topology_Renderer**: The client-side React Flow canvas that renders Graph IR as an interactive node-edge diagram
- **Layout_Engine**: The dagre-based module that computes node positions for the topology diagram
- **Artifact_Generator**: The client-side module that produces Terraform and config files from parsed spec data
- **Artifact_Manifest**: The structured output describing generated files, warnings, and statistics
- **Audit_Writer**: The server-side module that persists audit events to the database
- **Audit_Redactor**: The module that strips denylisted fields and enforces size limits on audit metadata
- **Share_Encoder**: The client-side module that compresses spec text into a URL-safe string using lz-string
- **Resource_List**: The table below the topology canvas showing all parsed resources
- **Diagnostics_Panel**: The output tab displaying validation errors and warnings with jump-to-source capability

## Requirements

### Requirement 1: User Registration

**User Story:** As a new user, I want to register with a username and password, so that I can access the Studio and other authenticated features.

#### Acceptance Criteria

1. WHEN a user submits a valid username and password, THE Auth_Module SHALL create a new user account with the password hashed using bcrypt at cost factor 12 or higher
2. WHEN a user submits a username that already exists, THE Auth_Module SHALL reject the registration and return a generic error message without revealing that the username is taken
3. WHEN a user submits a password shorter than 8 characters, THE Auth_Module SHALL reject the registration with a descriptive validation error
4. WHEN registration succeeds, THE Session_Manager SHALL create a new session and set an HTTP-only, Secure, SameSite=Lax cookie
5. WHEN registration succeeds, THE Audit_Writer SHALL log an `AUTH_REGISTER` event with metadata containing only the username

### Requirement 2: User Login

**User Story:** As a returning user, I want to log in with my credentials, so that I can resume working in the Studio.

#### Acceptance Criteria

1. WHEN a user submits valid credentials, THE Auth_Module SHALL authenticate the user and THE Session_Manager SHALL create a new session with an HTTP-only cookie
2. WHEN a user submits invalid credentials, THE Auth_Module SHALL return a generic "Invalid credentials" error without revealing whether the username or password was incorrect
3. WHEN login succeeds, THE Audit_Writer SHALL log an `AUTH_LOGIN_SUCCESS` event with metadata containing only the username
4. WHEN login fails, THE Audit_Writer SHALL log an `AUTH_LOGIN_FAILURE` event with metadata containing the username and a generic reason
5. WHILE a single IP address has exceeded 5 failed login attempts within 15 minutes, THE Auth_Module SHALL reject further login attempts from that IP with a rate-limit error

### Requirement 3: Session Management and Route Protection

**User Story:** As an authenticated user, I want my session to persist across page loads and all dashboard routes to be protected, so that unauthorized users cannot access the application.

#### Acceptance Criteria

1. THE Session_Manager SHALL generate session tokens using cryptographically random bytes of at least 32 bytes
2. WHEN a request is made to any `/dashboard/**` route, THE System SHALL validate the session cookie against the database and redirect to `/login` if the session is invalid or expired
3. WHEN a user clicks logout, THE Session_Manager SHALL destroy the session in the database and clear the session cookie
4. WHEN logout succeeds, THE Audit_Writer SHALL log an `AUTH_LOGOUT` event

### Requirement 4: Spec Input

**User Story:** As a network engineer, I want to author a topology spec using either a code editor or a structured form, so that I can define my network resources in my preferred mode.

#### Acceptance Criteria

1. WHEN a user navigates to the Studio, THE System SHALL display a spec input area with two tabs: Editor (code) and Form (structured input)
2. WHEN a user edits the spec in the Editor tab, THE System SHALL update the underlying spec data structure
3. WHEN a user edits the spec in the Form tab, THE System SHALL update the underlying spec data structure
4. WHEN a user switches between Editor and Form tabs, THE System SHALL preserve all unsaved edits
5. WHEN the Studio page loads, THE System SHALL restore the last-edited spec from client-side storage (IndexedDB) if available
6. THE System SHALL persist spec content to client-side storage only and MUST NOT send spec content to the server

### Requirement 5: Spec Validation and Diagnostics

**User Story:** As a network engineer, I want real-time validation feedback on my spec, so that I can catch errors as I type.

#### Acceptance Criteria

1. WHEN the user edits the spec, THE Spec_Parser SHALL parse the spec after a debounce period of 150 to 300 milliseconds
2. WHEN parsing completes, THE Spec_Validator SHALL perform semantic validation and produce a list of diagnostics (errors, warnings, info)
3. WHEN diagnostics are produced, THE Diagnostics_Panel SHALL display each diagnostic with severity, message, and a clickable reference
4. WHEN a user clicks a diagnostic entry, THE System SHALL focus the Editor cursor on the offending line or highlight the corresponding Form field
5. WHEN the spec is valid, THE Diagnostics_Panel SHALL display zero errors
6. WHEN the user clicks the Validate toolbar button, THE Spec_Validator SHALL run a full validation pass and THE Audit_Writer SHALL log a `STUDIO_VALIDATE` event with metadata containing resourceCount and errorCount

### Requirement 6: Live Topology Preview

**User Story:** As a network engineer, I want to see a live node-edge diagram of my topology that updates as I edit, so that I can visually verify my design.

#### Acceptance Criteria

1. WHEN the Spec_Parser produces a valid parse result, THE Graph_Builder SHALL transform the parsed spec into a Graph_IR containing nodes and edges
2. THE Graph_Builder SHALL derive edges in priority order: containment edges first, then explicit reference edges, then conservatively inferred edges
3. WHEN an edge is inferred, THE Graph_Builder SHALL emit an info-level diagnostic so the user can verify or make the relationship explicit
4. THE Graph_Builder SHALL assign canonical stable IDs to nodes (format: `{type}:{name}`) and edges (format: `{source}:{target}:{relationType}`)
5. WHEN the Graph_IR changes, THE Topology_Renderer SHALL update the React Flow canvas by diffing against the previous Graph_IR using stable IDs and patching only changed nodes and edges
6. WHEN the graph structure changes (nodes or edges added or removed), THE Layout_Engine SHALL recompute positions using dagre auto-layout
7. WHEN only metadata changes occur (label edits, meta field updates), THE Layout_Engine SHALL preserve existing positions without re-layout
8. THE Topology_Renderer SHALL support pan, zoom, node selection, and fit-to-view interactions
9. WHEN a node is selected in the topology canvas, THE System SHALL highlight the corresponding row in the Resource_List and scroll the Editor to the relevant spec block
10. WHEN a row is selected in the Resource_List, THE System SHALL center and highlight the corresponding node in the canvas and scroll the Editor to the relevant block

### Requirement 7: Artifact Generation

**User Story:** As a platform engineer, I want to generate Terraform and config files from my spec, so that I can deploy my topology.

#### Acceptance Criteria

1. WHEN the user clicks the Generate toolbar button and the spec has no validation errors, THE Artifact_Generator SHALL produce an Artifact_Manifest containing generated files
2. THE Artifact_Generator SHALL produce at minimum: `manifest.json`, `artifacts.json`, and `README.md`
3. WHEN generation completes, THE System SHALL display the generated files in the Artifacts output tab
4. WHEN generation completes, THE Audit_Writer SHALL log a `STUDIO_GENERATE_ARTIFACTS` event with metadata containing artifactTypes and resourceCount
5. IF the spec has validation errors, THEN THE Generate button SHALL be disabled with a tooltip explaining why

### Requirement 8: Download and Share

**User Story:** As a platform engineer, I want to download generated artifacts as a ZIP and share my spec via a URL, so that I can distribute my work.

#### Acceptance Criteria

1. WHEN the user clicks the Download toolbar button and artifacts have been generated, THE System SHALL bundle all files from the Artifact_Manifest into a ZIP file and trigger a browser download
2. THE System SHALL name the ZIP file `cold-network-plane-{timestamp}.zip` using an ISO 8601 date format
3. THE System SHALL include `manifest.json` at the root of the ZIP archive and include all files listed in the manifest
4. WHEN download completes, THE Audit_Writer SHALL log a `STUDIO_DOWNLOAD_ZIP` event with metadata containing artifactCount and totalSizeBytes
5. WHEN the user clicks the Share toolbar button, THE Share_Encoder SHALL compress the spec text using lz-string, encode it as a URL-safe string, and copy the share link to the clipboard
6. WHEN the Studio page loads with a share payload in the URL, THE System SHALL decompress the payload and hydrate the Editor with the shared spec
7. IF the compressed spec exceeds approximately 8000 characters in URL length, THEN THE System SHALL display a warning and suggest downloading instead
8. WHEN a share link is copied, THE Audit_Writer SHALL log a `STUDIO_COPY_SHARE_LINK` event

### Requirement 9: Audit Logging

**User Story:** As a team lead, I want an append-only audit log of user actions, so that I can review who did what and when.

#### Acceptance Criteria

1. THE Audit_Writer SHALL persist each audit event with: id, userId, eventType, metadata (JSON string), optional ipAddress, optional userAgent, and createdAt timestamp
2. THE Audit_Redactor SHALL strip all fields from metadata that appear on the denylist: password, passwordHash, secret, token, apiKey, credential, specBody, specContent, artifactContent, terraformCode
3. THE Audit_Redactor SHALL strip any metadata field whose serialized value exceeds 256 characters
4. IF the total serialized metadata exceeds 1 KB, THEN THE Audit_Redactor SHALL truncate non-essential fields and add a `_truncated: true` marker
5. THE System SHALL enforce append-only semantics on audit events: no UPDATE or DELETE operations on audit records in the MVP
6. THE Audit_Writer SHALL accept events matching the taxonomy: AUTH_REGISTER, AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILURE, AUTH_LOGOUT, STUDIO_VALIDATE, STUDIO_GENERATE_ARTIFACTS, STUDIO_DOWNLOAD_ZIP, STUDIO_COPY_SHARE_LINK

### Requirement 10: Audit UI

**User Story:** As a team lead, I want to view audit events in a paginated table with filters, so that I can investigate specific actions.

#### Acceptance Criteria

1. WHEN a user navigates to `/dashboard/audit`, THE System SHALL display a paginated table of audit events sorted by most recent first
2. THE System SHALL display only events belonging to the authenticated user
3. WHEN a user applies filters (event type, date range, text search), THE System SHALL update the table to show only matching events
4. WHEN a user clicks an event row, THE System SHALL open a detail drawer (sheet) showing the full event metadata

### Requirement 11: Marketing Landing Page

**User Story:** As a visitor, I want to see a compelling landing page that explains the product and directs me to the Studio, so that I can understand the value and get started.

#### Acceptance Criteria

1. WHEN a visitor navigates to `/`, THE System SHALL display a public landing page without requiring authentication
2. THE System SHALL display sections in order: Navbar, Hero, Features (3-4 cards), How It Works (3 steps), Demo placeholder, CTA Banner, Footer
3. WHEN a visitor clicks any "Open Studio" or "Start Designing" CTA button, THE System SHALL navigate to `/dashboard/studio`
4. WHEN an unauthenticated user reaches a `/dashboard/**` route, THE System SHALL redirect to `/login` and redirect back after successful authentication
5. THE System SHALL include Next.js Metadata API exports for title, description, and Open Graph tags on the landing page

### Requirement 12: Studio Layout and Toolbar

**User Story:** As a network engineer, I want a compact three-panel Studio layout with a toolbar, so that I can efficiently edit, preview, and review output.

#### Acceptance Criteria

1. THE Studio SHALL display three resizable panels: Spec Input (left), Live Topology Preview (center), and Output (right)
2. THE Studio toolbar SHALL include four buttons: Validate (default variant), Generate (default variant), Share (outline variant), Download (outline variant)
3. WHILE the spec is empty, THE Validate and Share buttons SHALL be disabled with tooltips explaining why
4. WHILE the spec has validation errors, THE Generate button SHALL be disabled with a tooltip explaining why
5. WHILE no artifacts have been generated, THE Download button SHALL be disabled with a tooltip explaining why
6. WHILE a toolbar action is in progress, THE corresponding button SHALL display a loading state and prevent double-clicks
7. THE Studio SHALL render the Resource_List below the topology canvas showing one row per GraphNode with columns: type icon, label, type, group, connection count

### Requirement 13: Dashboard Navigation

**User Story:** As an authenticated user, I want consistent sidebar navigation, so that I can move between Dashboard, Studio, Audit, and Settings pages.

#### Acceptance Criteria

1. THE System SHALL display a sidebar with navigation items in order: Dashboard (`/dashboard`), Studio (`/dashboard/studio`), Audit (`/dashboard/audit`), Settings (`/dashboard/settings`)
2. WHEN a user clicks a navigation item, THE System SHALL navigate to the corresponding route
3. THE System SHALL visually indicate the currently active navigation item

### Requirement 14: Non-Functional — Performance

**User Story:** As a network engineer, I want the topology preview to update smoothly without lag, so that I can maintain my editing flow.

#### Acceptance Criteria

1. THE System SHALL debounce spec parsing between 150 and 300 milliseconds after the last keystroke
2. THE Topology_Renderer SHALL update the canvas without triggering full React tree rerenders by using memoized node and edge arrays
3. THE Layout_Engine SHALL re-layout only when the graph structure changes (node or edge additions or removals), not on metadata-only updates

### Requirement 15: Non-Functional — Accessibility

**User Story:** As a user with accessibility needs, I want all interactive elements to be keyboard-navigable and properly labeled, so that I can use the application with assistive technology.

#### Acceptance Criteria

1. THE System SHALL ensure all interactive elements are keyboard-navigable
2. THE System SHALL associate labels with all form inputs using the shadcn Label component
3. THE System SHALL ensure color contrast meets WCAG 2.1 AA standards for text on background
4. THE System SHALL provide aria-label or visible text on all toolbar buttons

### Requirement 16: Non-Functional — Data Privacy

**User Story:** As a security-conscious user, I want assurance that my spec content and generated artifacts are never stored on the server, so that my intellectual property remains private.

#### Acceptance Criteria

1. THE System SHALL store spec content exclusively on the client side using IndexedDB or localStorage
2. THE System SHALL treat generated artifacts as ephemeral client-side data that is never persisted to the server database
3. THE System SHALL store only bounded metadata in the server database: user accounts, session tokens, and audit event rows
4. THE System SHALL ensure that audit event metadata never contains spec bodies, artifact contents, secrets, API keys, or credentials
