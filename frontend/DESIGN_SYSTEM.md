# Xeno Grow Design System

> Clean, high-contrast product UI: a single indigo accent on near-white surfaces, with
> dark panels reserved for moments that should feel like infrastructure.

Colours are written as Tailwind arbitrary values (`bg-[#5B4FFF]`) rather than theme
tokens, so the hexes below are the source of truth. If you add a colour, check this
list first — the palette is deliberately small.

---

## Color Palette

### Accent

One accent carries every action, link, and highlight in the product.

```css
--indigo:        #5B4FFF;  /* Primary — CTAs, links, active states, chart series */
--indigo-hover:  #4B3FE5;  /* Hover / pressed */
--indigo-bright: #7C6AFF;  /* Accent on dark surfaces */
--indigo-tint:   #EEF2FF;  /* Selected rows, badges, icon wells */
--indigo-wash:   #F8F7FF;  /* Subtle section backgrounds */
```

**Tailwind**: `bg-[#5B4FFF]`, `text-[#5B4FFF]`, `border-[#5B4FFF]`

---

### Surfaces

Light by default. `#FAFAFA` is the page, white is the card.

```css
--page:     #FAFAFA;  /* Page background */
--card:     #FFFFFF;  /* Cards, panels, modals */
--muted:    #F3F4F6;  /* Muted fills, disabled, table stripes */
--border:   #E5E7EB;  /* Borders, dividers */
```

---

### Dark Surfaces

Used only where the UI is describing the system itself — the landing page's
architecture section and the campaign launch overlay. Not a dark mode.

```css
--ink:         #0A0E1A;  /* Dark section background */
--ink-panel:   #141929;  /* Raised panel on ink */
--ink-border:  #1E2545;  /* Borders on ink */
--ink-muted:   #8B92A5;  /* Secondary text on ink */
```

---

### Text

```css
--text:           #1A1A1A;  /* Headings, primary text */
--text-secondary: #6B7280;  /* Body, labels */
--text-muted:     #9CA3AF;  /* Hints, timestamps, placeholders */
```

---

### Status

```css
--success: #10B981;  /* Delivered, launched, healthy */
--warning: #F59E0B;  /* Pending, degraded */
--error:   #EF4444;  /* Failed, destructive */
--info:    #3B82F6;  /* Neutral informational */
```

---

### Channel Brand Colors

Used only on channel badges and previews, so a WhatsApp preview reads as WhatsApp.

```css
--whatsapp: #075E54;
--whatsapp-bubble: #ECE5DD;
--imessage: #007AFF;
```

---

## Conventions

**Radii.** `rounded-xl` for buttons and inputs, `rounded-2xl` for cards and modals.

**Elevation.** Borders do the work, not shadows. The exception is the primary CTA,
which carries a coloured glow: `boxShadow: '0 4px 14px 0 rgba(99,102,241,0.4)'`.

**Type.** Headings are `font-extrabold` and `tracking-tight`. Labels that sit above a
value are `text-[11px] uppercase tracking-wider`. Body copy is `text-sm`.

**Type.** The landing headline pairs the sans face with one italic serif phrase
(`font-serif`, Instrument Serif) in the accent colour. Serif is for that one phrase per
page, never body copy.

---

## AI-native patterns

**Orb.** `components/ui/ai-orb.tsx` is a breathing indigo sphere with a rotating halo,
pure CSS, three sizes (`sm`, `md`, `lg`). It marks anything the model is doing: the
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
`--agent-step-delay` variable. No animation library is installed.

**Responsive.** Multi-column layouts collapse below `lg` (`grid-cols-1 lg:grid-cols-3`,
`flex-col lg:flex-row`). Fixed side panels stack; page padding is `p-4 sm:p-8`.

**Light only.** The app has no dark mode. The root sets `color-scheme: light` and a
`darkreader-lock` meta so extensions do not invert it. The dark analytics page is a
designed surface, not a theme.

**Considered and not adopted.** `thinking-orbs` (MIT, 130 KB, richer particle orbs, the
best states are paid) and AI Elements (chat-oriented, tied to the AI SDK, deprecated in
favour of shadcn). Patterns borrowed instead: staged step lists from the Reasoning and
Task elements, and the shimmer title from 21st.dev text loaders.
