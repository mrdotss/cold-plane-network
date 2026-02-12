# Cold Network Plane — UI/UX Guidelines

## Dashboard Navigation

Primary nav (sidebar or top bar) MUST include these items in order:

1. **Dashboard** — `/dashboard` — overview / home
2. **Studio** — `/dashboard/studio` — spec editor + preview + artifacts
3. **Audit** — `/dashboard/audit` — event log viewer
4. **Settings** — `/dashboard/settings` — user preferences, password change

The sidebar already exists (`components/app-sidebar.tsx`). Update its nav items to match.

## Studio Layout — 3-Area Mental Model

The Studio page MUST be organized into three distinct areas, arranged for a desktop-first
split-pane experience:

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar: [Validate] [Generate] [Share] [Download]      │
├──────────────────┬──────────────────┬───────────────────┤
│  SPEC INPUT      │  LIVE TOPOLOGY   │  OUTPUT           │
│                  │  PREVIEW         │                   │
│  Tabs:           │                  │  Tabs:            │
│  · Editor        │  React Flow      │  · Artifacts      │
│  · Form          │  canvas          │  · Diagnostics    │
│                  │  + Resource List  │  · Diff (opt.)    │
│                  │  below canvas    │                   │
├──────────────────┴──────────────────┴───────────────────┤
│  Status Bar (optional): parse status, node/edge count   │
└─────────────────────────────────────────────────────────┘
```

### Area 1: Spec Input (left)

- MUST have two tabs: **Editor** (code) and **Form** (structured input).
- Editor tab: syntax-highlighted code editor (CodeMirror or Monaco).
- Form tab: shadcn form components for guided resource entry.
- Both tabs MUST produce the same underlying spec data structure.
- Switching tabs MUST NOT lose unsaved edits.

### Area 2: Live Topology Preview (center)

- MUST render a React Flow (`@xyflow/react`) canvas showing nodes and edges.
- Nodes represent network/cloud resources from the spec.
- Edges represent connections/dependencies between resources.
- MUST update live as the user edits (debounced, not on every keystroke).
- MUST support: pan, zoom, node selection, fit-to-view (toolbar or keyboard shortcut).
- Below the canvas: a **Resource List / Inventory** table showing all parsed resources.
- Selecting a node in the canvas MUST highlight the corresponding row in the resource list.

### Area 3: Output (right)

- MUST have tabs: **Artifacts** and **Diagnostics**. **Diff** is optional for MVP.
- Artifacts tab: read-only viewer showing generated Terraform / config files.
- Diagnostics tab: validation errors and warnings from the spec parser/validator.
- Diagnostics MUST support "jump to" — clicking an error focuses the relevant field in the Editor or Form.

## Live Topology Interactions

### Node Selection → Cross-Highlight

- Selecting a node in the React Flow canvas MUST:
  1. Highlight the corresponding row in the Resource List below the canvas.
  2. Scroll the Editor to the relevant spec block (or focus the Form field).
- Selecting a row in the Resource List MUST:
  1. Center and highlight the corresponding node in the canvas.
  2. Scroll/focus the Editor or Form to the relevant block.

### Diagnostics → Jump-To

- Each diagnostic (error/warning) in the Diagnostics tab MUST include a clickable reference.
- Clicking it MUST focus the Editor cursor on the offending line, or highlight the Form field.

### Toolbar Actions

| Action | Button Variant | Disabled When | Loading State | Behavior |
|--------|---------------|---------------|---------------|----------|
| **Validate** | `default` | Spec is empty | Spinner + "Validating…" | Parse + validate the current spec. Update Diagnostics tab. Show toast on success/failure. |
| **Generate** | `default` | Spec has validation errors | Spinner + "Generating…" | Run artifact generators. Populate Artifacts tab. Log `STUDIO_GENERATE_ARTIFACTS` event. |
| **Share** | `outline` | Spec is empty | Brief "Copied!" feedback | Compress spec to URL-safe string, copy share link to clipboard. Log `STUDIO_COPY_SHARE_LINK`. |
| **Download** | `outline` | No artifacts generated yet | Spinner + "Packaging…" | Bundle generated artifacts into a ZIP, trigger browser download. Log `STUDIO_DOWNLOAD_ZIP`. |

- Validate and Generate SHOULD be keyboard-accessible (e.g., `Ctrl+Shift+V`, `Ctrl+Shift+G`).
- All toolbar buttons MUST use shadcn `Button` with the variants specified above.
- Disabled buttons MUST show a tooltip explaining why they are disabled.
- Loading states MUST prevent double-clicks (disable button while processing).

## Visual Design Constraints

- shadcn preset: `radix-nova`, baseColor `neutral`, theme `neutral`.
- Icon library: `hugeicons` (`@hugeicons/react` + `@hugeicons/core-free-icons`).
- Font: `geist` (already in Next.js config).
- MUST keep UI compact and dense — minimize padding, use small/default size variants.
- MUST use consistent spacing: `gap-2` / `gap-4` for layouts, `p-2` / `p-4` for containers.
- Dark mode: SHOULD support via shadcn theme toggle; MAY defer to post-MVP.
- Resizable panels: SHOULD use a splitter/resizer between the three Studio areas.

## Component Usage Rules

- MUST use existing `components/ui/*` shadcn primitives for all standard UI elements.
- MUST NOT introduce a second component library (no Material UI, Chakra, Ant Design, etc.).
- New shadcn components SHOULD be added via `npx shadcn@latest add <name>`.
- Custom components MUST follow shadcn patterns: `cva` for variants, `cn()` for class merging.

## Accessibility Baseline

- All interactive elements MUST be keyboard-navigable.
- Form inputs MUST have associated labels (shadcn `Label` + `Field`).
- Topology canvas: React Flow handles keyboard nav for nodes; ensure focus ring is visible.
- Color contrast MUST meet WCAG 2.1 AA for text on background.
- Toolbar buttons MUST have `aria-label` or visible text.

## Studio ↔ Contracts Integration

The Studio UI consumes the domain contracts defined in `contracts.md`. This section maps
UI interactions to contract data flows.

### Topology Canvas ↔ Graph IR

- The topology canvas renders `GraphIR.nodes` as React Flow nodes and `GraphIR.edges` as React Flow edges.
- Each `GraphNode` maps to a custom React Flow node type (defined in `lib/topology/node-types.ts`).
- `GraphNode.type` determines the visual style (icon, color, shape) of the rendered node.
- `GraphNode.groupId` determines containment rendering (nested groups / sub-flows in React Flow).
- `GraphEdge.relationType` determines edge style:
  - `"containment"` → dashed, muted color
  - `"reference"` → solid, default color
  - `"inferred"` → dotted, with an info icon or label indicating inference

### Resource List ↔ Graph IR

- The Resource List table renders one row per `GraphNode`.
- Columns: type icon, label, type, group (parent), connection count.
- Selecting a row MUST call `fitView` on the corresponding React Flow node and highlight it.

### Diagnostics ↔ Spec Parser

- Each diagnostic entry includes: severity (error/warning/info), message, and a `nodeId` or
  `sourceRange` (line/column in the editor).
- Clicking a diagnostic with a `nodeId` MUST highlight that node in the canvas AND scroll
  the editor to the relevant spec block.
- Inferred edges (from `contracts.md` § Edge Resolution Rules) generate info-level diagnostics
  so the user can review and optionally make them explicit.

### Artifacts Panel ↔ Artifact Manifest

- The Artifacts tab renders `ArtifactManifest.files` as a file tree or flat list.
- Selecting a file shows its `content` in a read-only code viewer.
- `ArtifactManifest.warnings` MUST be displayed as a banner or inline alerts above the file list.
- `ArtifactManifest.stats` MAY be shown in the Status Bar (total files, size, generation time).

## Assumptions & Open Questions

- **Assumption**: Studio is desktop-first; responsive/mobile layout is out of MVP scope.
- **Assumption**: Three-panel layout uses CSS Grid or a resizable splitter library (e.g., `react-resizable-panels`).
- **Open**: Should the Resource List be collapsible to give more canvas space?
- **Open**: Should the Form tab auto-generate from the spec schema, or be hand-crafted per resource type?
- **Open**: Should we show a minimap in the React Flow canvas for large topologies?
- **Open**: Should inferred edges be toggleable (show/hide) via a toolbar toggle or canvas control?
