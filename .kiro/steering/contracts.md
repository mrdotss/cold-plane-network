# Cold Network Plane — Domain Contracts

These contracts are authoritative. All modules that produce or consume these data
structures MUST conform to the shapes defined here. Breaking changes require a version bump
and coordinated updates across parser, graph-builder, generators, and topology renderer.

## Graph IR v1

The Graph IR is the intermediate representation produced by `lib/spec/graph-builder.ts`
and consumed by `lib/topology/` (layout + React Flow rendering) and `lib/spec/generators/`
(artifact generation).

### Node

```ts
interface GraphNode {
  /** Stable unique ID. See "Canonical Stable IDs" below. */
  id: string;

  /** Resource type identifier (e.g., "vpc", "subnet", "router", "firewall"). */
  type: string;

  /** Human-readable display label. */
  label: string;

  /**
   * Optional parent group ID for containment relationships.
   * Example: a subnet's groupId points to its parent VPC node.
   * null/undefined means top-level (no parent).
   */
  groupId?: string;

  /**
   * Arbitrary key-value metadata from the spec.
   * Renderers MAY use this for tooltips, detail panels, etc.
   * Generators MUST use this for resource-specific config.
   */
  meta: Record<string, unknown>;
}
```

### Edge

```ts
interface GraphEdge {
  /** Stable unique ID. Derived from source + target + relationType. */
  id: string;

  /** Source node ID. */
  source: string;

  /** Target node ID. */
  target: string;

  /**
   * Relation classification:
   * - "containment"  — parent/child grouping (VPC contains subnet)
   * - "reference"    — explicit field reference (dependsOn, connectTo, target)
   * - "inferred"     — best-effort inference (see inference rules below)
   */
  relationType: "containment" | "reference" | "inferred";

  /** Optional metadata (e.g., port, protocol, label for the connection). */
  meta: Record<string, unknown>;
}
```

### Graph Container

```ts
interface GraphIR {
  version: "1";
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

### Edge Resolution Rules (v1)

Edges MUST be resolved in this priority order:

1. **Containment edges** — When a resource is nested inside a group/parent in the spec
   (e.g., a subnet declared inside a VPC block), emit an edge with
   `relationType: "containment"`. The child node's `groupId` MUST match the parent node's `id`.

2. **Explicit reference edges** — When a resource field explicitly references another
   resource by name or ID (e.g., `dependsOn: "firewall-1"`, `target: "subnet-a"`,
   `connectTo: "router-core"`), emit an edge with `relationType: "reference"`.
   The parser MUST resolve the reference to a valid node ID or emit a diagnostic warning.

3. **Inferred edges** — When the parser can safely infer a relationship that is not
   explicitly declared (e.g., two resources in the same subnet likely communicate),
   emit an edge with `relationType: "inferred"`. Inference MUST be conservative:
   - SHOULD only infer when confidence is high (same group, matching types).
   - MUST emit a diagnostic warning (severity: "info") for every inferred edge so the
     user can verify or make it explicit.
   - MUST NOT infer edges that contradict explicit declarations.

### Canonical Stable IDs

Node and edge IDs MUST be deterministic and stable across re-parses of the same spec:

- **Node ID**: derived from the resource's declared name/identifier in the spec.
  Format: `{type}:{name}` (e.g., `vpc:production`, `subnet:web-tier`).
  If the user renames a resource, the ID changes (this is expected).
- **Edge ID**: derived from `{source}:{target}:{relationType}`
  (e.g., `vpc:production:subnet:web-tier:containment`).
- IDs MUST be lowercase, alphanumeric + hyphens + colons only.
- Stable IDs enable efficient diffing: the topology renderer can compare previous and
  current ID sets to determine adds/removes/updates without deep equality checks.

## Artifact Manifest v1

The Artifact Manifest describes the output of artifact generation. It is produced by
`lib/spec/generators/` and consumed by the Studio output panel, ZIP export, and share links.

### Manifest Shape

```ts
interface ArtifactManifest {
  /** Schema version for forward compatibility. */
  version: "1";

  /** ISO 8601 timestamp of generation. */
  generatedAt: string;

  /** Total number of resources in the source spec. */
  resourcesCount: number;

  /** List of generated output files. */
  files: ArtifactFile[];

  /** Non-fatal warnings from generation (e.g., unsupported resource types skipped). */
  warnings: string[];

  /** Summary statistics. */
  stats: {
    totalFiles: number;
    totalSizeBytes: number;
    generatorDurationMs: number;
  };
}

interface ArtifactFile {
  /** Relative path within the export (e.g., "main.tf", "variables.tf", "README.md"). */
  path: string;

  /** MIME type or file type hint (e.g., "text/plain", "application/json"). */
  type: string;

  /** File content as a string. */
  content: string;

  /** Byte size of content (UTF-8). */
  sizeBytes: number;
}
```

### Minimum Output Files

Every successful generation MUST produce at least:

| File | Purpose |
|------|---------|
| `manifest.json` | The ArtifactManifest itself (serialized). |
| `artifacts.json` | Machine-readable structured output (all generated resources). |
| `README.md` | Human-readable summary: what was generated, resource list, warnings. |

Additional files (e.g., `main.tf`, `variables.tf`, per-resource configs) are generator-specific.

### Export ZIP Rules

- ZIP export MUST include `manifest.json` at the root of the archive.
- All files listed in `manifest.files` MUST be present in the ZIP.
- ZIP MUST NOT include files not listed in the manifest.
- ZIP filename: `cold-network-plane-{timestamp}.zip` (ISO 8601 date, no colons).

### Share Link Rules

- Share links encode the **spec source** (not generated artifacts) client-side.
- Encoding: compress spec text with `lz-string` → base64url → append as URL hash or query param.
- Share links MUST NOT involve server persistence (no DB writes for share data).
- The Studio page MUST detect a share payload in the URL on load and hydrate the editor.
- Maximum share link length: SHOULD stay under 8,000 characters (URL length limits vary by browser).
- If the spec is too large to encode in a URL, MUST show a user-facing warning and suggest download instead.

## Contract Versioning

- Both Graph IR and Artifact Manifest include a `version` field.
- Version is a string (e.g., `"1"`, `"2"`).
- Consumers MUST check the version field and handle unknown versions gracefully (warn + best-effort, or reject).
- Breaking changes to either contract MUST bump the version.

## Chat Message Contract v1

The Chat Message contract defines the shape of messages exchanged between the client,
server, and database for the Sizing chatbot feature.

### ChatMessage

```ts
interface ChatMessage {
  /** Unique message ID (UUID). */
  id: string;

  /** Parent chat conversation ID (UUID). FK → chat.id. */
  chatId: string;

  /** Message author role. */
  role: "user" | "assistant";

  /** Message text content (markdown for assistant messages). */
  content: string;

  /** File attachments associated with this message. */
  attachments: FileRef[];

  /** ISO 8601 timestamp of message creation. */
  createdAt: Date;
}
```

### FileRef

```ts
interface FileRef {
  /** Unique file ID (UUID, assigned on upload). */
  id: string;

  /** Original file name. */
  name: string;

  /** MIME type (e.g., "application/json", "application/pdf"). */
  type: string;

  /** File size in bytes. */
  size: number;

  /**
   * Extracted text content (for PDF files).
   * Populated server-side on upload via `pdf-parse`.
   * undefined for non-PDF file types.
   */
  extractedText?: string;
}
```

### Rules

- `ChatMessage.attachments` MUST conform to `FileRef[]`. Empty array if no attachments.
- `FileRef.extractedText` MUST only be populated for PDF files where extraction succeeded.
- `FileRef.type` MUST be one of the allowed MIME types defined in `chatbot.md`.
- `FileRef.size` MUST NOT exceed 10 MB (10,485,760 bytes).
- Messages with `role: "assistant"` MUST NOT have attachments (only user messages attach files).

## AutofillServiceInput v2

The AutofillServiceInput contract defines the payload sent to the Azure AI Foundry agent
for pricing auto-fill requests. v2 adds the full `properties` object and current pricing context.

### Shape

```ts
interface AutofillServiceInput {
  /** Schema version. */
  version: "2";

  /** AWS service name (e.g., "Amazon EC2", "Amazon RDS"). */
  serviceName: string;

  /**
   * Full resource properties from the AWS pricing JSON.
   * Keys are property names (e.g., "instanceType", "region", "operatingSystem").
   * Values are the property values as strings.
   * MUST include ALL properties for the service, not just top-level identifiers.
   */
  properties: Record<string, string>;

  /**
   * Current pricing data already known for this service.
   * Allows the agent to fill gaps without re-deriving existing values.
   * null/undefined if no pricing data exists yet.
   */
  currentPricing?: {
    /** On-demand hourly price (USD). */
    onDemandPrice?: number;
    /** Reserved 1-year price (USD). */
    reserved1YearPrice?: number;
    /** Reserved 3-year price (USD). */
    reserved3YearPrice?: number;
    /** Currency code (default "USD"). */
    currency?: string;
  };
}
```

### Rules

- `properties` MUST contain the full set of resource properties from the AWS pricing JSON.
  Sending only top-level service names results in inaccurate auto-fill.
- `currentPricing` SHOULD be included when partial pricing data already exists, to avoid
  overwriting user-confirmed values.
- The agent response MUST be valid JSON conforming to the expected autofill output schema.
- Autofill requests MUST use `store: false` (stateless) to avoid persisting pricing data
  in Azure AI Foundry.
- Autofill prompts MUST NOT instruct the agent to use MCP tools (avoids 429 rate limiting).

## Assumptions & Open Questions

- **Assumption**: Graph IR and Artifact Manifest are client-side-only data structures; they are never persisted to the DB.
- **Assumption**: `artifacts.json` is a flat JSON representation; the exact schema depends on generator output and will be defined per-generator.
- **Open**: Should `GraphNode.meta` have a typed subset of well-known keys (e.g., `ip`, `cidr`, `vendor`), or remain fully dynamic?
- **Open**: Should inferred edges be toggleable in the UI (show/hide inferred connections)?
- **Open**: Should the manifest include a hash/checksum of the source spec for integrity verification?
