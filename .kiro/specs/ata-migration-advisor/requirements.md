# Requirements Document

## Introduction

The Migration Advisor feature integrates the Azure-to-AWS resource mapping capability from the ATA project into the Cold Network Plane (CPN) application. It enables presales engineers and solution architects to import Azure resource inventories, run deterministic catalog-driven mappings to AWS equivalents, visualize the results in table and canvas views, and export migration reports. The feature reuses CPN's existing authentication, audit logging, and UI framework.

## Glossary

- **Mapping_Engine**: Pure-logic module that looks up Azure resource types in the Mapping_Catalog and returns AWS service recommendations with confidence levels.
- **Mapping_Catalog**: Versioned JSON file (`data/ata-mappings.v1.json`) containing Azure-to-AWS service mappings with confidence, rationale, and alternatives.
- **Mapping_Recommendation**: A single Azure-to-AWS mapping result including AWS service name, category, confidence level, rationale, migration notes, and alternatives.
- **Azure_Resource**: A normalized representation of an Azure cloud resource with type, kind, SKU, location, and metadata.
- **Project**: A container that groups imported Azure resources and their mapping recommendations for a specific migration engagement.
- **Import_Panel**: UI component providing three methods to ingest Azure resources: paste JSON, upload JSON file, and manual entry.
- **Mapping_Table**: Filterable, sortable table view of mapping results using @tanstack/react-table.
- **Mapping_Canvas**: React Flow visualization showing Azure resources on the left, AWS services on the right, connected by confidence-colored edges.
- **Confidence_Level**: Rating of mapping certainty — High (1:1 equivalent), Medium (reasonable equivalent with differences), Low (1-to-many or significant differences), None (no catalog entry).
- **Export_Report**: Generated migration report in Markdown or CSV format summarizing all mappings for a project.
- **Sidebar**: CPN's navigation sidebar component that displays links to application sections.
- **Audit_System**: CPN's existing append-only event logging system for recording user actions.

## Requirements

### Requirement 1: Project Management

**User Story:** As a presales engineer, I want to create and manage migration projects, so that I can organize Azure-to-AWS migration assessments per customer engagement.

#### Acceptance Criteria

1. WHEN a user creates a new project with a name, THE Project_Manager SHALL persist the project linked to the authenticated user
2. WHEN a user views the migration dashboard, THE Project_Manager SHALL display all projects created by the authenticated user with name, customer name, resource count, and timestamps
3. WHEN a user deletes a project, THE Project_Manager SHALL remove the project and all associated Azure_Resources and Mapping_Recommendations via cascading delete
4. WHEN a project is created, THE Audit_System SHALL log a MIGRATION_PROJECT_CREATE event with the project name
5. WHEN a project is deleted, THE Audit_System SHALL log a MIGRATION_PROJECT_DELETE event with the project name

### Requirement 2: Azure Resource Import

**User Story:** As a presales engineer, I want to import Azure resource inventories via JSON paste, file upload, or manual entry, so that I can ingest customer Azure environments for mapping.

#### Acceptance Criteria

1. WHEN a user pastes valid Azure Resource Graph JSON, THE Import_Panel SHALL parse, validate, normalize, and persist the resources to the project
2. WHEN a user uploads a valid JSON file (up to 10MB), THE Import_Panel SHALL parse, validate, normalize, and persist the resources to the project
3. WHEN a user submits a manual resource entry form with valid data, THE Import_Panel SHALL persist the single resource to the project
4. WHEN imported JSON contains a top-level array, a `{value: [...]}` wrapper, or a `{data: [...]}` wrapper, THE Import_Panel SHALL accept all three formats
5. WHEN imported JSON fails Zod validation, THE Import_Panel SHALL reject the import and display descriptive error messages
6. WHEN a resource is imported, THE Import_Panel SHALL normalize the type field to lowercase and extract SKU from nested objects when present
7. WHEN resources are successfully imported, THE Audit_System SHALL log a MIGRATION_RESOURCE_IMPORT event with the resource count

### Requirement 3: Deterministic Mapping Engine

**User Story:** As a solution architect, I want the system to map Azure resources to AWS equivalents using a versioned catalog, so that I get transparent, reproducible recommendations without AI guesswork.

#### Acceptance Criteria

1. WHEN the Mapping_Engine receives an Azure resource type, THE Mapping_Engine SHALL look up the normalized type in the Mapping_Catalog and return a Mapping_Recommendation
2. WHEN the Mapping_Catalog contains entries with matching type, kind, and SKU, THE Mapping_Engine SHALL prioritize type+kind+SKU over type+kind over type+SKU over generic type match
3. WHEN no catalog entry matches the Azure resource type, THE Mapping_Engine SHALL return a result with confidence "None", matched false, and a rationale indicating no mapping is available
4. WHEN a type match exists but kind/SKU do not match any refined entry, THE Mapping_Engine SHALL fall back to the generic type entry and downgrade the confidence by one level
5. THE Mapping_Engine SHALL produce identical output for identical input regardless of invocation order or timing
6. WHEN a mapping run is executed on a project, THE Audit_System SHALL log a MIGRATION_MAPPING_RUN event with the project ID and resource count

### Requirement 4: Mapping Table View

**User Story:** As a presales engineer, I want to view mapping results in a filterable, sortable table, so that I can review and assess each Azure-to-AWS recommendation.

#### Acceptance Criteria

1. WHEN a user views the mapping table, THE Mapping_Table SHALL display each Azure resource with its name, type, location, mapped AWS service, category, confidence level, and rationale
2. WHEN a user filters by confidence level, THE Mapping_Table SHALL display only resources matching the selected confidence levels
3. WHEN a user filters by category, THE Mapping_Table SHALL display only resources matching the selected categories
4. WHEN a user clicks a table row, THE Mapping_Table SHALL expand a detail panel showing migration notes, alternatives, and full rationale
5. THE Mapping_Table SHALL display confidence levels with color-coded badges (High=green, Medium=yellow, Low=orange, None=red)

### Requirement 5: Mapping Canvas View

**User Story:** As a solution architect, I want to visualize Azure-to-AWS mappings as a node-edge diagram, so that I can see the overall migration topology at a glance.

#### Acceptance Criteria

1. WHEN a user views the mapping canvas, THE Mapping_Canvas SHALL render Azure resources as nodes on the left and deduplicated AWS services as nodes on the right, connected by edges
2. WHEN multiple Azure resources map to the same AWS service, THE Mapping_Canvas SHALL display a single AWS node with a count indicator
3. THE Mapping_Canvas SHALL color edges based on confidence level using the same color scheme as the Mapping_Table badges
4. THE Mapping_Canvas SHALL use dagre for automatic left-to-right layout of nodes
5. WHEN a user clicks a node, THE Mapping_Canvas SHALL display a detail sidebar with the resource or service information
6. THE Mapping_Canvas SHALL support pan, zoom, and fit-to-view interactions

### Requirement 6: Report Export

**User Story:** As a consultant, I want to export migration reports in Markdown and CSV formats, so that I can share findings with customers and stakeholders.

#### Acceptance Criteria

1. WHEN a user exports a Markdown report, THE Export_Report SHALL generate a document with a summary table and per-resource detail sections including AWS service, confidence, rationale, migration notes, and alternatives
2. WHEN a user exports a CSV report, THE Export_Report SHALL generate a file with columns for Azure resource name, type, location, AWS service, category, confidence, rationale, migration notes, and alternatives
3. WHEN a report is exported, THE Audit_System SHALL log a MIGRATION_REPORT_EXPORT event with the export format
4. WHEN the export is triggered, THE Export_Report SHALL trigger a browser download of the generated file

### Requirement 7: Sidebar Navigation Integration

**User Story:** As a user, I want to access the Migration Advisor from the CPN sidebar, so that I can navigate to the feature alongside existing tools.

#### Acceptance Criteria

1. THE Sidebar SHALL include a "Migration Advisor" navigation item after the existing items, linking to `/dashboard/migration`
2. WHEN the user is on any migration route, THE Sidebar SHALL highlight the "Migration Advisor" item as active

### Requirement 8: Zod Input Validation

**User Story:** As a developer, I want all external input validated with Zod schemas before database writes, so that the system rejects malformed data with clear error messages.

#### Acceptance Criteria

1. THE Validator SHALL validate manual resource entries against a Zod schema requiring non-empty name and type fields
2. THE Validator SHALL validate imported JSON arrays against a Zod schema that accepts Azure Resource Graph format with flexible SKU parsing (string or nested object)
3. WHEN validation fails, THE Validator SHALL return structured error messages identifying which fields failed and why
4. THE Validator SHALL accept JSON with extra fields beyond the schema without rejecting the payload

### Requirement 9: API Route Authorization

**User Story:** As a developer, I want all migration API routes protected by session authentication, so that unauthenticated users cannot access project data.

#### Acceptance Criteria

1. WHEN an unauthenticated request reaches any migration API route, THE API SHALL return a 401 status with an error message
2. WHEN an authenticated user requests projects, THE API SHALL return only projects belonging to that user
3. WHEN an authenticated user requests resources or mappings for a project they do not own, THE API SHALL return a 404 status

### Requirement 10: Marketing Page Integration

**User Story:** As a visitor, I want to see the Migration Advisor feature highlighted on the CPN marketing landing page, so that I understand the platform includes Azure-to-AWS migration capabilities.

#### Acceptance Criteria

1. THE Features section SHALL include a new "Migration Advisor" feature card with a hugeicons icon, title, and description highlighting Azure-to-AWS catalog-driven mapping
2. THE Navbar SHALL include a "Migration" anchor link pointing to a migration-specific section on the landing page
3. THE Marketing_Page SHALL include a dedicated Migration Advisor section (between existing sections or after Features) showing key capabilities: import Azure inventory, deterministic mapping, table + canvas views, and report export
4. THE Migration Advisor marketing section SHALL include a CTA button linking to `/dashboard/migration`
5. THE HowItWorks section SHALL be updated to include a migration-related step or the Migration Advisor section SHALL include its own workflow steps (Import → Map → Export)

### Requirement 11: Database Schema Extension

**User Story:** As a developer, I want the CPN Prisma schema extended with Project, AzureResource, and MappingRecommendation models, so that migration data is persisted alongside existing CPN data.

#### Acceptance Criteria

1. THE Database_Schema SHALL include a Project model with id, name, customerName, notes, createdById (foreign key to User), and timestamps
2. THE Database_Schema SHALL include an AzureResource model with id, projectId (foreign key to Project), name, type, kind, location, sku, tags (JSON string), raw (JSON string), and timestamps
3. THE Database_Schema SHALL include a MappingRecommendation model with id, azureResourceId (foreign key to AzureResource), awsService, awsCategory, confidence, rationale, migrationNotes, alternatives (JSON string), and timestamps
4. WHEN a Project is deleted, THE Database_Schema SHALL cascade delete all associated AzureResources and MappingRecommendations

### Requirement 12: Zod Input Validation

Note: This was previously Requirement 8. Renumbered due to insertion of Requirement 10 (Marketing Page Integration).
