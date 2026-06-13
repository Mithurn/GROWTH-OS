# Xeno Grow Design System

> Premium warm aesthetic with rust/terracotta accents and cream backgrounds

---

## Color Palette

### Primary Colors
Warm rust/terracotta palette for actions, highlights, and brand presence.

```css
--rust: #c45d3f;       /* Primary - CTAs, accents */
--rust-light: #d4715a; /* Hover states */
--rust-dark: #a84d33;  /* Pressed states */
```

**Tailwind**: `bg-[#c45d3f]`, `text-[#c45d3f]`, `border-[#c45d3f]`

---

### Neutral/Background Scale
Warm cream tones for backgrounds and surfaces.

```css
--cream: #faf8f3;        /* Primary background */
--cream-dark: #f2efe7;   /* Secondary/muted backgrounds */
--cream-darker: #e8e4da; /* Borders, dividers */
```

**Tailwind**: `bg-[#faf8f3]`, `bg-[#f2efe7]`, `border-[#e8e4da]`

---

### Text Colors
Rich brown tones for excellent readability.

```css
--brown: #2d1810;       /* Primary text, headings */
--brown-light: #4a3228; /* Secondary text */
--brown-muted: #6b5a52; /* Muted/placeholder text */
```

**Tailwind**: `text-[#2d1810]`, `text-[#4a3228]`, `text-[#6b5a52]`

---

### Semantic Colors

**Success** (Emerald)
```css
--success: #22c55e;
--success-light: #dcfce7;
```

**Warning** (Amber)
```css
--warning: #f59e0b;
--warning-light: #fef3c7;
```

**Error** (Red)
```css
--error: #dc2626;
--error-light: #fee2e2;
```

**Info** (Sky)
```css
--info: #0ea5e9;
--info-light: #e0f2fe;
```

---

## Typography

### Font Family
```css
--font-sans: "Satoshi", "Plus Jakarta Sans", "Inter", -apple-system, sans-serif;
--font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-bold: 700;
--font-black: 900;
```

### Letter Spacing
```css
--tracking-tight: -0.02em;  /* Headings */
--tracking-normal: -0.01em; /* Body text */
```

### Usage Examples

```tsx
// Page Title
<h1 className="text-[28px] font-bold tracking-tight text-[#2d1810]">
  Opportunities
</h1>

// Section Heading
<h2 className="text-lg font-bold text-[#2d1810]">
  Top Opportunities
</h2>

// Body Text
<p className="text-sm text-[#4a3228]">
  AI-discovered revenue opportunities
</p>

// Muted Text
<span className="text-xs text-[#6b5a52]">
  Last updated 2 mins ago
</span>
```

---

## Spacing System

Based on 4px grid.

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-7:  28px;
--space-8:  32px;
```

---

## Border Radius

```css
--radius-sm:   6px;   /* Small elements */
--radius-base: 10px;  /* Default - buttons, inputs */
--radius-lg:   12px;  /* Cards, panels */
--radius-xl:   16px;  /* Large cards */
--radius-2xl:  20px;  /* Modals */
--radius-full: 9999px; /* Pills, avatars */
```

---

## Button Styles

### Primary Button
```tsx
<button className="h-10 rounded-xl bg-[#c45d3f] px-5 text-sm font-semibold text-white hover:bg-[#a84d33] transition-colors">
  Explore
</button>
```

### Secondary Button
```tsx
<button className="h-10 rounded-xl bg-[#f2efe7] px-5 text-sm font-semibold text-[#2d1810] hover:bg-[#e8e4da] transition-colors">
  Cancel
</button>
```

### Ghost Button
```tsx
<button className="h-10 rounded-xl px-5 text-sm font-semibold text-[#c45d3f] hover:bg-[#fdf5f3] transition-colors">
  View Details
</button>
```

---

## Card Styles

### Default Card
```tsx
<div className="rounded-xl border border-[#e8e4da] bg-white p-4 shadow-sm">
  {/* Content */}
</div>
```

### Interactive Card (with hover effects)
```tsx
<article className="group relative rounded-xl border border-[#e8e4da] bg-white shadow-sm transition-all duration-300 hover:-translate-y-[3px] hover:shadow-lg hover:shadow-[#c45d3f]/10 hover:border-[#c45d3f]/30">
  {/* Left accent border on hover */}
  <div className="absolute left-0 top-0 h-full w-1 bg-[#c45d3f] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
  {/* Content */}
</article>
```

### Accent Card
```tsx
<div className="rounded-xl bg-[#fdf5f3] border border-[#c45d3f]/20 p-4">
  {/* Content */}
</div>
```

---

## Input Styles

### Text Input
```tsx
<input
  type="text"
  className="h-10 w-full rounded-xl border border-[#e8e4da] bg-[#faf8f3] px-4 text-sm outline-none transition placeholder:text-[#6b5a52] focus:border-[#c45d3f] focus:bg-white focus:ring-2 focus:ring-[#c45d3f]/10"
  placeholder="Search..."
/>
```

---

## Badge/Status Styles

```tsx
// Ready (Success)
<span className="rounded-lg px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50">
  Ready
</span>

// Processing (Primary)
<span className="rounded-lg px-2.5 py-1 text-[11px] font-bold bg-[#fdf5f3] text-[#c45d3f] ring-1 ring-[#c45d3f]/20">
  Processing
</span>

// Neutral
<span className="rounded-lg px-2.5 py-1 text-[11px] font-bold bg-[#f2efe7] text-[#6b5a52] ring-1 ring-[#e8e4da]">
  Pending
</span>
```

---

## Sidebar (Dark Theme)

```tsx
<div className="bg-[#2d1810] text-[#faf8f3]">
  {/* Subtle gradient overlay */}
  <div className="bg-[radial-gradient(circle_at_10%_10%,rgba(196,93,63,0.15),transparent_40%)]" />

  {/* Active nav item */}
  <button className="bg-[#c45d3f] text-white shadow-md shadow-[#c45d3f]/25">
    Active
  </button>

  {/* Inactive nav item */}
  <button className="text-[#faf8f3]/70 hover:bg-[#4a3228] hover:text-[#faf8f3]">
    Inactive
  </button>
</div>
```

---

## Shadows & Effects

```css
/* Subtle card shadow */
shadow-sm

/* Hover shadow with brand tint */
hover:shadow-lg hover:shadow-[#c45d3f]/10

/* Button shadow */
shadow-md shadow-[#c45d3f]/25
```

---

## Animations

### Card Hover Lift
```css
transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
hover:-translate-y-[3px]
```

### Pulse Status Indicator
```tsx
<span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
```

---

## Usage Guidelines

### DO's
- Use rust (#c45d3f) for primary actions and brand presence
- Keep backgrounds warm cream (#faf8f3)
- Use rich brown (#2d1810) for primary text
- Apply subtle shadows with brand color tint
- Use smooth cubic-bezier transitions
- Add left border accent on card hover

### DON'Ts
- Don't use pure white backgrounds (use cream tones)
- Don't use pure black text (use brown tones)
- Don't over-saturate the rust color
- Don't mix cold and warm tones
- Don't skip hover states on interactive elements

---

**Last Updated**: Design System Refresh
**Status**: Applied
