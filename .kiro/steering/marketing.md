# Cold Network Plane — Marketing Landing Page

## Overview

The root route `/` serves a public marketing landing page. It is unauthenticated and
acts as the entry point for new visitors. All authenticated app routes live under
`/dashboard/**`.

## Route Organization (Route Groups)

MUST use Next.js Route Groups to separate public and authenticated layouts:

```
app/
  (marketing)/
    layout.tsx            # Minimal layout: no sidebar, no auth check
    page.tsx              # Landing page at /
  (app)/
    layout.tsx            # Authenticated layout: sidebar + auth guard
    dashboard/
      page.tsx            # Dashboard home
      studio/page.tsx     # Studio
      audit/page.tsx      # Audit log
      settings/page.tsx   # Settings
  login/page.tsx          # Login (outside both groups — standalone layout)
  signup/page.tsx         # Signup (outside both groups — standalone layout)
  layout.tsx              # Root layout (html/body, fonts, global providers)
  globals.css
```

- `(marketing)` group MUST NOT import or check auth state.
- `(app)` group MUST validate session in its layout and redirect to `/login` if unauthenticated.
- Login and signup pages remain outside route groups so they render without sidebar chrome.

## Landing Page Sections

The landing page MUST include these sections in order:

### 1. Navbar

- Logo / product name ("Cold Network Plane") on the left.
- Nav links: Features, How It Works, Demo (anchor links to sections below).
- CTA button on the right: "Open Studio" (primary variant).
- SHOULD be sticky on scroll.
- MUST use shadcn `Button` and standard HTML nav elements.

### 2. Hero

- Headline: concise value proposition (spec-first network topology design).
- Subheadline: one sentence expanding on the headline.
- Primary CTA: "Open Studio" → `/dashboard/studio`.
- Secondary CTA (optional): "Learn More" → scrolls to Features section.
- SHOULD include a hero visual (screenshot, illustration, or animated topology preview placeholder).

### 3. Features

- 3–4 feature cards highlighting MVP pillars:
  - Live Topology Preview (node/edge diagram updates as you type).
  - Artifact Generation (Terraform / config files from your spec).
  - Share & Download (share links + ZIP export).
  - Audit Trail (who did what, when).
- MUST use shadcn `Card` components. Keep copy concise.
- Icons from hugeicons library.

### 4. How It Works

- 3-step visual flow:
  1. Write your spec (code or form).
  2. See the topology live.
  3. Generate & download artifacts.
- SHOULD use numbered steps or a horizontal stepper layout.

### 5. Demo Placeholder

- A static or lightly animated preview of the Studio UI.
- MAY be a screenshot, a short looping video, or an embedded read-only topology canvas.
- MUST NOT be a fully functional Studio instance on the landing page.

### 6. CTA Banner

- Full-width banner with a repeated call to action: "Start Designing" → `/dashboard/studio`.
- Keep it simple: headline + button.

### 7. Footer

- Product name, copyright, links (GitHub, docs if available).
- SHOULD include a "Built with Next.js + React Flow" attribution line.
- Keep minimal; no complex footer grid for MVP.

## CTA Behavior

- All "Open Studio" / "Start Designing" buttons MUST link to `/dashboard/studio`.
- If the user is unauthenticated, the `(app)` layout MUST redirect to `/login`.
- After successful login, the user SHOULD be redirected back to `/dashboard/studio` (use a `redirect` or `callbackUrl` query param).
- MUST NOT show login/signup forms inline on the landing page.

## Metadata & SEO

- MUST use the Next.js Metadata API for the landing page.
- Prefer a static `metadata` export in `(marketing)/page.tsx` or `(marketing)/layout.tsx`:
  ```ts
  export const metadata: Metadata = {
    title: "Cold Network Plane — Spec-First Network Topology Studio",
    description: "Design hybrid cloud and network topologies with a live preview. Generate Terraform and config artifacts instantly.",
    // openGraph, twitter, etc.
  };
  ```
- Use `generateMetadata()` only if metadata depends on runtime data (not expected for the landing page).
- SHOULD include Open Graph and Twitter card meta tags for social sharing.
- Favicon and apple-touch-icon MUST be present in `app/` or `public/`.

## Component Placement

```
components/marketing/
  Navbar.tsx              # Sticky nav with logo + links + CTA
  Hero.tsx                # Hero section
  Features.tsx            # Feature cards grid
  HowItWorks.tsx          # 3-step flow
  DemoPreview.tsx         # Static/animated Studio preview
  CTABanner.tsx           # Full-width CTA
  Footer.tsx              # Minimal footer
```

- All marketing components MUST be client or server components as appropriate (most can be server components since they are static).
- MUST use shadcn primitives (`Button`, `Card`, etc.) and hugeicons.
- MUST follow the Nova/neutral aesthetic — no custom color palette for marketing.

## Visual Consistency

- The landing page MUST feel like the same product as the dashboard.
- Same font (geist), same color tokens (neutral), same button styles.
- SHOULD use slightly more generous spacing than the dense Studio UI (landing pages need breathing room).
- Hero section MAY use a subtle gradient or background pattern, but keep it understated.

## Assumptions & Open Questions

- **Assumption**: Landing page is static content; no server-side data fetching needed.
- **Assumption**: Route group migration from current flat `app/` structure is a one-time refactor.
- **Open**: Should the demo placeholder be an interactive read-only React Flow canvas, or a static image/video?
- **Open**: Should we add a "Pricing" section placeholder even though billing is out of MVP scope?
- **Open**: Should the navbar show "Login" / "Sign Up" links alongside the "Open Studio" CTA?
