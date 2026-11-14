# GrowthOS Design System

Operate-mode product UI: one indigo accent on near-white surfaces, a teal agent identity,
dark ink panels only where the UI describes the system itself. Every value below is a token
in `app/globals.css`. Components use token utilities (`text-muted-foreground`, `bg-brand-tint`,
`shadow-card`), never hex literals. The landing page (`components/landing`) keeps its own
dark theme and is out of scope here.

Rules come from the Impeccable craft floor, Hallmark's floor and the Taste-skill consistency
checks, applied to an app surface rather than a marketing page.

---

## Colour roles

| Role | Tokens | Use |
|---|---|---|
| Brand | `primary` #5B4FFF, `primary-hover`, `brand-bright` (on dark), `brand-tint`, `brand-wash`, `brand-line`, `brand-soft` | actions, links, selection, one accent per screen |
| Agent | `agent` #14B8A6, `agent-tint` | the agent's identity only (avatar, status). Never for actions |
| Text | `foreground` #1A1A1A, `body` #4B5563, `muted-foreground` #6B7280 | headings, body, secondary. Smallest allowed text colour on white is `muted-foreground` (4.8:1). `subtle` #9CA3AF is for icons and disabled glyphs, never text |
| Surface | `background`/`card` white, `surface-inset` #F9FAFB (page canvas, nested wells), `muted` #F3F4F6, `line-soft` | page is `surface-inset`, cards are `card` |
| Border | `border` #E5E7EB, `border-strong` #D1D5DB (inputs, unchecked boxes) | 1px only |
| Semantic | `success`, `warning`, `danger`, `info` plus `-tint` fills | state only (delivered, pending, failed, informational). Text on a tint uses the solid token |
| Ink (dark) | `ink`, `ink-panel`, `ink-line`, `ink-muted`, `ink-faint`, `ink-deep`, `ink-raised` | sidebar, command palette, run trace, onboarding, login |
| Chart | `chart-1` indigo, `chart-2` cyan, `chart-3` amber, `chart-4` slate, `chart-5` periwinkle | categorical series in this order, max five. Funnel and heatmap use the single-hue indigo ramp in `components/analytics/config.ts` |
| Channel | WhatsApp, iMessage values live inside `phone-mockup.tsx` and `message-preview.tsx` | device previews only |

## Type

Satoshi, tabular numerals for every figure (`tabular-nums`), mono only for code, ids and timings.

| Step | Class | Use |
|---|---|---|
| 11px | `text-2xs` | badges, timestamps, kbd. Never a standalone label |
| 12px | `text-xs` | captions, table heads, form hints |
| 13px | `text-label` | metric and field labels, nav items, chips |
| 14px | `text-sm` | body, inputs, buttons |
| 18px | `text-lg` | card and state titles |
| 24px | `text-2xl` | page title (`h1`, one per page, `font-semibold tracking-tight`) |
| 30px | `text-3xl` | metric values |

Labels are sentence case and untracked. No all-caps, no kicker above a heading, no gradient text.
No arbitrary `text-[Npx]` sizes in app code.

## Space, radius, elevation

- Spacing is the Tailwind 4px scale. Page container is `PAGE_SHELL_CLASS` (1200px, `px-4 sm:px-8`, `py-6 sm:py-8`) on every app page. Gap between page sections 24px, inside a card 20px (`p-5`).
- Radius: `rounded-full` chips, badges, avatars; `rounded-xl` buttons, inputs, list items; `rounded-2xl` cards and modals (`SURFACE_CLASS`); `rounded-lg` wells nested in a card. Nothing else.
- Elevation has three levels and no others: flat (border only), `shadow-card` (every card, `SURFACE_CLASS`), `shadow-pop` (menus, drawers, tooltips, palette). `shadow-cta` belongs to the primary action only. No hairline border under a wide shadow on popups beyond this.
- One card chrome: `SURFACE_CLASS` (`rounded-2xl border border-border bg-card shadow-card`). A card never sits inside a card; use a `rounded-lg bg-surface-inset` well.

## Actions

`action-styles.ts` is the only source: `PRIMARY_ACTION_CLASS` (one per screen), `SECONDARY_ACTION_CLASS`, `GHOST_ACTION_CLASS`, `CHIP_CLASS`. 40px high, `rounded-xl`. Small inline actions use `rounded-lg h-8`. No hand-rolled `rounded-full` buttons.

## Icons

lucide-react only, 16px (`size-4`) in controls and nav, 14px (`size-3.5`) inside metrics and chips, 24px in state panels. Default stroke width, `aria-hidden` when decorative. No emoji as icons in app chrome (phone previews render the device's own glyphs).

## Motion

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 150ms | hover, colour, focus |
| `--duration-base` | 200ms | state changes, toggles |
| `--duration-slow` | 350ms | step-in of list items |
| `--duration-reveal` | 500ms | one-time reveals |
| `--ease-out-expo` | cubic-bezier(0.16, 1, 0.3, 1) | all entrances |

Animate `transform`, `opacity` and colour only. Never `transition-all`, never width, height, top or left (bars use `scaleX`). Everything sits behind `prefers-reduced-motion`. Looping motion is limited to the agent orb, the live pulse and the model-wait shimmer.

## States and accessibility

- Every interactive element gets a 2px `--ring` outline on `:focus-visible` from the base layer; components may add `focus-visible:ring-2`.
- Loading: `AiLoader` for model waits, skeletons that match the final layout for data. Error: `StatePanel tone="error"` with a retry. Empty: `StatePanel tone="empty"` with the next step.
- Text contrast 4.5:1, large text 3:1. `cn` in `lib/utils.ts` knows the custom `text-2xs`, `text-label` and `shadow-*` names so tailwind-merge does not drop them.

## Density

Operate mode: scannable rows, tabular numbers, at most one accent-filled metric per strip, labels in sentence case.

## Known exceptions

- `app/opportunities/[id]/intelligence/page.tsx` is an unlinked legacy route kept for old links. It was moved onto tokens but keeps its bespoke layout and categorical avatar palette.
- Phone and message previews use real device and channel colours and tiny type to mimic a handset.
- Chart ramps (funnel, heatmap, SHADES) are single-hue data ramps held in config files, not UI colours.
- `ai-shimmer` is the only gradient text, a loading affordance that stops under reduced motion.
- `app/privacy` and `app/terms` are dark legal pages outside the app shell.

---

## AI-native patterns

**Orb.** `components/ui/ai-orb.tsx` wraps `thinking-orbs` (MIT), the dotted canvas orbs from libraries.dev/orbs, tinted indigo.
Three sizes (`sm`, `md`, `lg`) and a `state` per task: `working`, `searching`, `composing`, `connecting`, `weaving`.
Pass `theme="dark"` on dark surfaces. It marks anything the model is doing: the
hero agent card, the final landing CTA, onboarding setup, model-backed waits.

**Loading.** Waits on the model use `AiLoader` (`components/ui/ai-loader.tsx`): the orb,
a shimmering title and optional rotating steps. Copy and timing live in
`lib/loading-copy.ts` and `lib/use-cycling-index.ts`, never inline in a page. Plain data
loads use `AiLoader` with `size="md"` and no steps. A `Loader2` spinner is still right
inside a button that is submitting.

**Errors and empty states.** `StatePanel` (`components/ui/state-panel.tsx`): an icon
well, a title, one plain sentence, and an action. Errors always offer a retry, empty
states always point at the next step.

**Motion.** Every animation sits behind `prefers-reduced-motion`. Orb, shimmer and the
landing agent card reveal are CSS keyframes in `globals.css`; the reveal timing is the
`--agent-step-delay` variable. The libraries.dev packages (`thinking-orbs`, `border-beam`,
`bot-avatars`, `metal-fx`) honour reduced motion themselves or are gated by `useReducedMotion`.

---

## Agent UI kit

The app is operated like an agent, not filled in like a form. Shared pieces live in
`components/agent/`; tunable values (sizes, tones, intervals) sit in `agent-config.ts`.

- **AgentAvatar** wraps `bot-avatars` (`idle`, `working`, `sleeping`). It is the agent's identity in the sidebar and dashboard.
- **AgentPromptInput** is the command bar. `border-beam` runs while focused or busy and stops under reduced motion.
- **AgentActivityFeed** is the live timeline: a `thinking-orbs` orb in the header, one row per agent action.
- **StatusPill** is the only status chip: `live`, `success`, `warning`, `danger`, `neutral`.
- **ConfidenceMeter** shows a 0 to 100 score as ten segments.
- **PrimaryAction** is the one `metal-fx` button allowed per screen, the main call to action.

**Shell.** A dark ink 240px sidebar (agent card, search, grouped navigation, account) on large screens, matching the landing console; a top bar with a drawer below `lg`. Content stays on the light canvas. `Cmd+K` opens the command palette (`components/command-palette.tsx`, destinations in `nav-config.ts`).

**Responsive.** Multi-column layouts collapse below `lg` (`grid-cols-1 lg:grid-cols-3`,
`flex-col lg:flex-row`). Fixed side panels stack; page padding is `p-4 sm:p-8`.

**Light only.** The app has no dark mode. The root sets `color-scheme: light` and a
`darkreader-lock` meta so extensions do not invert it. The dark analytics page is a
designed surface, not a theme.

**Considered and not adopted.** AI Elements (chat-oriented, tied to the AI SDK, deprecated in
favour of shadcn). Patterns borrowed instead: staged step lists from the Reasoning and
Task elements, and the shimmer title from 21st.dev text loaders.
