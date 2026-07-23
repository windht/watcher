# Design System: Watcher 1.0

## 1. Visual Theme & Atmosphere

Watcher is a cockpit-dense desktop developer tool: density 8/10, variance 4/10, and motion 4/10. It is precise, calm, technical, and tactile. Crisp dividers, controlled spacing, and asymmetric pane widths create hierarchy; floating card grids do not.

Stitch project: `projects/560896141198289714`  
Stitch design system: `assets/4103200389087770778`  
Primary workspace screen: `projects/560896141198289714/screens/910b656336e64293b99a451c802c6a0c`

Supporting screens:

- Environments: `projects/560896141198289714/screens/22441c3dbc81417f857bead95496ab5b`
- History: `projects/560896141198289714/screens/5cc6e269c4a84727b7ddb123bc7c3395`
- Settings and updates: `projects/560896141198289714/screens/3d80bb7aeb2548fd92423abc1c46db04`

## 2. Color Palette & Roles

- **Deep Graphite** (`#101216`) — dark canvas; never pure black.
- **Raised Graphite** (`#171A1F`) — toolbars, sidebars, editors, and panes.
- **Quiet Steel** (`#252A32`) — selected rows and secondary controls.
- **Chalk Ink** (`#F2F3F5`) — primary dark-mode text.
- **Muted Alloy** (`#9299A5`) — secondary text and metadata.
- **Whisper Line** (`#313741`) — structural one-pixel dividers.
- **Burnished Copper** (`#B86F47`) — the only accent, used for primary actions, active navigation, focus, and progress.
- **Light Canvas** (`#F6F7F8`), **Light Surface** (`#FFFFFF`), **Light Ink** (`#1C2026`), and **Light Line** (`#DDE1E6`) — light-theme counterparts.

HTTP methods and response statuses use semantic colors only; they never become decorative accents.

## 3. Typography Rules

- **Interface:** Geist Variable, weight-led hierarchy, tight tracking.
- **Code and data:** JetBrains Mono for URLs, request/response bodies, timestamps, status codes, and dense numbers.
- **Body:** 14px with 1.45 line height and a 65-character maximum reading width.
- **Banned:** Inter, generic serif fonts, oversized display typography, and all-caps paragraphs.

## 4. Component Styling

- Buttons are compact, flat, 8px rounded, and shift down 1px when pressed. Copper is reserved for the primary action.
- Pane groups use one-pixel dividers and negative space, not separate cards.
- Inputs are 36–40px high with quiet borders and copper focus rings.
- Tree rows, tabs, and menus use 32–36px visual density while primary actions retain 44px hit areas.
- Loading uses dimension-matched skeletons. Empty states explain the next action. Errors remain inline with the failed operation.

## 5. Layout Principles

- Desktop shell: 56px navigation rail, 292px resizable collection pane, flexible request workspace.
- Request workspace: persistent tabs, request command row, structured editor tabs, and resizable response inspector.
- Use CSS Grid and resizable panes. Never overlap content or introduce page-level horizontal scrolling.
- Minimum supported window: 960×640. Below 1080px, the collection pane can collapse.

## 6. Motion & Interaction

- Restrained 120–180ms transitions, spring-like easing, and transform/opacity only.
- Active request and update states may use a quiet copper pulse.
- Honor reduced motion and never animate pane dimensions continuously.

## 7. Anti-Patterns

Never use emojis, Inter, pure black, neon glows, purple/blue gradients, gradient text, custom cursors, overlapping content, equal-card dashboards, fake metrics, filler copy, generic names, huge rounded cards, or circular loading spinners.
