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

**Loading.** A spinning `Loader2` from lucide-react, in the accent colour, centred in
the region that is loading. Never a full-page spinner once the shell has rendered.
