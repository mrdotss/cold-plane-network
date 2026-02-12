# Implementation Plan: ATA Migration Advisor

## Overview

Migrate the Azure-to-AWS resource mapping feature from the ATA project into Cold Network Plane as a "Migration Advisor" sidebar section. Implementation follows a bottom-up approach: schema → pure logic → validators → API routes → UI pages → integration.

## Tasks

- [x] 1. Extend Prisma schema and audit events
  - [x] 1.1 Add Project, AzureResource, and MappingRecommendation models to `cold-plane-network/prisma/schema.prisma`
    - Add `projects Project[]` relation to User model
    - Project: id, name, customerName, notes, createdById → User, timestamps
    - AzureResource: id, projectId → Project (cascade delete), name, type, kind, location, sku, tags, raw, createdAt
    - MappingRecommendation: id, azureResourceId → AzureResource (cascade delete), awsService, awsCategory, confidence, rationale, migrationNotes, alternatives, createdAt
    - Add indexes on projectId, type, azureResourceId, createdById
    - Run `npx prisma db push` to apply schema
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 1.2 Add MIGRATION_* audit event types to `lib/audit/events.ts`
    - Add MIGRATION_PROJECT_CREATE, MIGRATION_PROJECT_DELETE, MIGRATION_RESOURCE_IMPORT, MIGRATION_MAPPING_RUN, MIGRATION_REPORT_EXPORT to AUDIT_EVENT_TYPES
    - Add metadata allowlists for each new event type
    - _Requirements: 1.4, 1.5, 2.7, 3.6, 6.3_

- [x] 2. Implement mapping engine and pure logic modules
  - [x] 2.1 Copy mapping catalog `data/ata-mappings.v1.json` from ATA to CPN
    - Place at `cold-plane-network/data/ata-mappings.v1.json`
    - _Requirements: 3.1_

  - [x] 2.2 Implement mapping engine at `lib/mapping-engine.ts`
    - Port `findMapping`, `getCatalogCategories`, `getCatalogStats` from ATA
    - Adapt import path for catalog JSON
    - Matching priority: type+kind+sku > type+kind > type+sku > generic > fallback with downgraded confidence
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.3 Write property tests for mapping engine at `lib/__tests__/mapping-engine.property.test.ts`
    - **Property 1: Catalog lookup returns correct match status**
    - **Validates: Requirements 3.1, 3.3**
    - **Property 2: Matching priority ordering**
    - **Validates: Requirements 3.2**
    - **Property 3: Fallback confidence downgrade**
    - **Validates: Requirements 3.4**

  - [x] 2.4 Write unit tests for mapping engine at `lib/__tests__/mapping-engine.test.ts`
    - Test exact type match, kind-specific match, SKU match, unknown type, fallback downgrade, getCatalogCategories, getCatalogStats
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Implement validators and import utilities
  - [x] 3.1 Implement Zod validators at `lib/validators/resource.ts`
    - Port `manualResourceSchema` and `importJsonSchema` from ATA
    - manualResourceSchema: requires non-empty name and type
    - importJsonSchema: accepts bare array, {value}, {data} wrappers; flexible SKU parsing (string, {name}, {tier}); passthrough for extra fields
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 3.2 Implement import normalization at `lib/import-utils.ts`
    - Port `normalizeResource` from ATA
    - Lowercase type, extract SKU from nested objects, serialize tags and raw as JSON strings
    - _Requirements: 2.6_

  - [x] 3.3 Write property tests for validators at `lib/__tests__/validators.property.test.ts`
    - **Property 4: Import schema accepts three JSON wrapper formats**
    - **Validates: Requirements 2.4**
    - **Property 5: Import schema rejects invalid input**
    - **Validates: Requirements 2.5**
    - **Property 11: Manual resource schema rejects empty name or type**
    - **Validates: Requirements 8.1**
    - **Property 12: Import schema handles flexible SKU formats**
    - **Validates: Requirements 8.2**
    - **Property 13: Validators accept extra fields**
    - **Validates: Requirements 8.4**

  - [x] 3.4 Write property tests for import utils at `lib/__tests__/import-utils.property.test.ts`
    - **Property 6: Resource normalization lowercases type and extracts SKU**
    - **Validates: Requirements 2.6**

- [x] 4. Checkpoint - Ensure all pure logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement canvas utilities and export module
  - [x] 5.1 Implement canvas graph builder at `lib/canvas-utils.ts`
    - Port `buildCanvasGraph` from ATA with CanvasNode, CanvasEdge, AzureResourceWithRecommendation types
    - Azure nodes on left, deduplicated AWS nodes on right with count, edges with confidence data
    - dagre layout with LR direction
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 5.2 Write property tests for canvas utils at `lib/__tests__/canvas-utils.property.test.ts`
    - **Property 7: Canvas graph structure with AWS deduplication**
    - **Validates: Requirements 5.1, 5.2**
    - **Property 8: Dagre layout produces left-to-right positioning**
    - **Validates: Requirements 5.4**

  - [x] 5.3 Implement export module at `lib/export.ts`
    - Port `generateMarkdownReport` and `generateCsvReport` from ATA
    - Markdown: summary table + per-resource detail sections
    - CSV: all required columns via json2csv Parser
    - _Requirements: 6.1, 6.2_

  - [x] 5.4 Write property tests for export at `lib/__tests__/export.property.test.ts`
    - **Property 9: Markdown export contains all resource data**
    - **Validates: Requirements 6.1**
    - **Property 10: CSV export contains all required columns and data**
    - **Validates: Requirements 6.2**

- [x] 6. Implement API routes
  - [x] 6.1 Implement project routes at `app/api/projects/route.ts`
    - GET: list projects for authenticated user (with resource count)
    - POST: create project, log MIGRATION_PROJECT_CREATE audit event
    - _Requirements: 1.1, 1.2, 1.4, 9.1, 9.2_

  - [x] 6.2 Implement project delete route at `app/api/projects/[projectId]/route.ts`
    - DELETE: verify ownership, cascade delete, log MIGRATION_PROJECT_DELETE audit event
    - _Requirements: 1.3, 1.5, 9.3_

  - [x] 6.3 Implement resource routes at `app/api/projects/[projectId]/resources/route.ts`
    - GET: list resources for project (verify ownership)
    - POST: import resources (validate with Zod, normalize, persist), log MIGRATION_RESOURCE_IMPORT audit event
    - Accept `mode: "manual"` or `mode: "json"` in request body
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 9.1, 9.3_

  - [x] 6.4 Implement mapping routes at `app/api/projects/[projectId]/mapping/route.ts`
    - GET: return resources with their recommendations (verify ownership)
    - POST: run mapping engine on all project resources, persist MappingRecommendation rows, log MIGRATION_MAPPING_RUN audit event
    - _Requirements: 3.1, 3.6, 9.1, 9.3_

  - [x] 6.5 Implement export route at `app/api/projects/[projectId]/export/route.ts`
    - POST: accept `format: "markdown" | "csv"`, generate report, log MIGRATION_REPORT_EXPORT audit event, return file content
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 9.1, 9.3_

  - [x] 6.6 Write integration tests for API routes at `lib/__tests__/api-routes.test.ts`
    - Test auth checks (401 for unauthenticated), ownership checks (404 for non-owner), CRUD operations, validation errors
    - Mock Prisma client
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 7. Checkpoint - Ensure all API route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement UI pages and components
  - [x] 8.1 Update sidebar at `components/app-sidebar.tsx`
    - Add "Migration Advisor" nav item with hugeicons icon, linking to `/dashboard/migration`
    - Active state when pathname starts with `/dashboard/migration`
    - _Requirements: 7.1, 7.2_

  - [x] 8.2 Implement project list page at `app/(app)/dashboard/migration/page.tsx`
    - Fetch and display user's projects with name, customer name, resource count, timestamps
    - "New Project" button linking to `/dashboard/migration/new`
    - _Requirements: 1.2_

  - [x] 8.3 Implement new project page at `app/(app)/dashboard/migration/new/page.tsx`
    - Form with name (required), customerName, notes fields
    - Submit creates project via API, redirects to project detail
    - _Requirements: 1.1_

  - [x] 8.4 Implement project detail page at `app/(app)/dashboard/migration/[projectId]/page.tsx`
    - Show project info, resource count, mapping status
    - Navigation links to import, mapping (table), mapping/canvas, export sub-pages
    - Delete project button with confirmation
    - _Requirements: 1.2, 1.3_

  - [x] 8.5 Implement import page at `app/(app)/dashboard/migration/[projectId]/import/page.tsx`
    - 3-tab import panel: Paste JSON, Upload File, Manual Entry
    - Paste tab: textarea + submit button
    - Upload tab: file input (accept .json, max 10MB) + submit button
    - Manual tab: form with name, type, kind, location, sku fields
    - Display validation errors from API response
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 8.6 Implement mapping table page at `app/(app)/dashboard/migration/[projectId]/mapping/page.tsx`
    - Fetch resources with recommendations from API
    - @tanstack/react-table with columns: name, type, location, AWS service, category, confidence (color badge), rationale
    - Confidence filter dropdown, category filter dropdown
    - Expandable row detail panel with migration notes, alternatives, full rationale
    - "Run Mapping" button to trigger POST /api/projects/[id]/mapping
    - Link to canvas view
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 8.7 Write property test for table filtering logic at `lib/__tests__/filtering.property.test.ts`
    - **Property 14: Table filtering returns only matching items**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 8.8 Implement mapping canvas page at `app/(app)/dashboard/migration/[projectId]/mapping/canvas/page.tsx`
    - Fetch resources with recommendations, build canvas graph via `buildCanvasGraph`
    - React Flow canvas with custom Azure and AWS node components
    - Confidence-colored edges (High=green, Medium=yellow, Low=orange, None=red)
    - Node click opens detail sidebar
    - Pan, zoom, fit-to-view controls
    - Link back to table view
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 8.9 Implement export page at `app/(app)/dashboard/migration/[projectId]/export/page.tsx`
    - Format selection (Markdown, CSV) with radio buttons or tabs
    - Preview of generated report
    - Download button triggering browser download
    - _Requirements: 6.1, 6.2, 6.4_

- [x] 9. Update marketing landing page
  - [x] 9.1 Add Migration Advisor feature card to `components/marketing/Features.tsx`
    - Add a new entry to the features array with hugeicons migration icon, "Migration Advisor" title, and description about Azure-to-AWS catalog-driven mapping
    - _Requirements: 10.1_

  - [x] 9.2 Create Migration Advisor marketing section at `components/marketing/MigrationAdvisor.tsx`
    - Dedicated section with id="migration" for anchor linking
    - 3-step workflow visual: Import Azure Inventory → Run Mapping Engine → Export Reports
    - Key highlights: 30+ service mappings, confidence ratings, table + canvas views, Markdown/CSV export
    - CTA button linking to `/dashboard/migration`
    - Use shadcn Card components and hugeicons, consistent with existing marketing sections
    - _Requirements: 10.3, 10.4, 10.5_

  - [x] 9.3 Update Navbar and landing page to include migration section
    - Add "Migration" anchor link to `components/marketing/Navbar.tsx` nav items
    - Insert `<MigrationAdvisor />` component in `app/(marketing)/page.tsx` between Features and HowItWorks (or after HowItWorks)
    - _Requirements: 10.2_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including tests are required
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The mapping engine is pure logic — no Prisma mocking needed for its tests
- API route integration tests mock Prisma client
- All UI components use shadcn/ui with radix-nova preset, hugeicons, geist font
