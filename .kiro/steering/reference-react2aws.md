# Cold Network Plane — React2AWS Read-Only Reference

## Purpose

When the multi-root workspace includes `React2AWS/` as a second folder, it serves as a
read-only reference for UX patterns, component architecture, and studio layout conventions.

## Rules

- MUST NOT write, edit, or delete any file under `React2AWS/**`.
- MUST NOT copy source code verbatim from React2AWS into cold-plane-network.
- MAY read React2AWS files to understand patterns, then reimplement from scratch in
  cold-plane-network using the project's own stack (shadcn/nova, hugeicons, etc.).

## What to Extract (patterns only)

| Area | React2AWS Reference | How to Adapt |
|------|---------------------|--------------|
| Studio layout | `src/components/studio/layout/` — DesktopLayout, TitleBar | Reimplement as `components/studio/StudioLayout.tsx` using shadcn + resizable panels. |
| Editor integration | `src/components/studio/Editor/` — CodeMirror setup, theme, highlighting | Use as reference for CodeMirror config; adapt theme to Nova/neutral palette. |
| Preview panel | `src/components/studio/Preview/` — ResourceCard, constants | Replace with React Flow topology canvas + resource list. React2AWS uses static cards; we need interactive nodes/edges. |
| Output panel | `src/components/studio/TerraformOutput/` — tokenizer, highlighted lines | Adapt output viewer pattern; use shadcn code block styling instead of custom tokenizer. |
| Parser architecture | `src/lib/parser/` — jsx-parser, class-parser | Study the parse → IR → generate pipeline. Our spec format differs, but the architecture (parser → graph-builder → generators) is analogous. |
| Generator modules | `src/lib/generators/` — per-resource generators | Follow the pattern of one generator per resource type. Our generators target network resources, not AWS-only. |
| Test structure | `src/__tests__/` — co-located test directories | Follow the same pattern: `__tests__/` directories mirroring `lib/` structure. |
| Landing page | `src/components/landing/` — Hero, Features, HowItWorks, CTA, Footer | Use as section-order reference. Reimplement with shadcn components and our own copy/visuals. |

## What NOT to Extract

- React2AWS-specific AWS resource types, constants, or Terraform templates.
- Lucide icons (we use hugeicons).
- Mermaid diagram rendering (we use React Flow).
- Any runtime code or utility functions — rewrite from scratch.

## When React2AWS Is Not Present

- If the workspace only contains `cold-plane-network/`, all steering rules still apply.
- The absence of React2AWS MUST NOT block any implementation.
- This file is informational guidance, not a hard dependency.

## Assumptions & Open Questions

- **Assumption**: React2AWS will remain in the workspace as a reference during initial development, then MAY be removed.
- **Open**: Should we document specific React2AWS file paths to consult for each cold-plane-network feature, or keep it general?
