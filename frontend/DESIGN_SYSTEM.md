# Xeno Grow Design System

> Inspired by Xeno's visual language, adapted for a data-intensive CRM/SaaS application

---

## 🎨 Color Palette

### Primary Colors
Warm, energetic orange/amber palette for actions, highlights, and brand presence.

```css
--primary-50:  #FFFBEB;  /* Lightest - backgrounds, hover states */
--primary-100: #FEF3C7;  /* Very light - subtle highlights */
--primary-200: #FDE68A;  /* Light - badges, pills */
--primary-300: #FCD34D;  /* Medium light */
--primary-400: #FBBF24;  /* Medium - secondary actions */
--primary-500: #F59E0B;  /* Base primary - main CTAs */
--primary-600: #D97706;  /* Dark - primary hover */
--primary-700: #B45309;  /* Darker - pressed states */
--primary-800: #92400E;  /* Very dark */
--primary-900: #78350F;  /* Darkest */
```

**Tailwind**: `bg-amber-500`, `text-amber-600`, `border-amber-200`

---

### Neutral/Gray Scale
Clean, professional grays for text, borders, and backgrounds.

```css
--neutral-50:  #FAFAFA;  /* Off-white backgrounds */
--neutral-100: #F5F5F5;  /* Light gray backgrounds */
--neutral-200: #E5E5E5;  /* Borders, dividers */
--neutral-300: #D4D4D4;  /* Disabled states */
--neutral-400: #A3A3A3;  /* Placeholder text */
--neutral-500: #737373;  /* Secondary text */
--neutral-600: #525252;  /* Body text */
--neutral-700: #404040;  /* Headings */
--neutral-800: #262626;  /* Dark text */
--neutral-900: #171717;  /* Darkest - hero text */
--neutral-950: #0A0A0A;  /* Near black */
```

**Tailwind**: `bg-neutral-50`, `text-neutral-700`, `border-neutral-200`

---

### Semantic Colors

**Success** (Green)
```css
--success-50:  #F0FDF4;
--success-100: #DCFCE7;
--success-500: #22C55E;  /* Base */
--success-600: #16A34A;  /* Hover */
--success-700: #15803D;  /* Active */
```

**Warning** (Amber - aligns with primary)
```css
--warning-50:  #FFFBEB;
--warning-100: #FEF3C7;
--warning-500: #F59E0B;  /* Base */
--warning-600: #D97706;
```

**Error** (Red)
```css
--error-50:  #FEF2F2;
--error-100: #FEE2E2;
--error-500: #EF4444;  /* Base */
--error-600: #DC2626;  /* Hover */
--error-700: #B91C1C;  /* Active */
```

**Info** (Blue)
```css
--info-50:  #EFF6FF;
--info-100: #DBEAFE;
--info-500: #3B82F6;  /* Base */
--info-600: #2563EB;  /* Hover */
```

**Purple Accent** (for special features, AI indicators)
```css
--purple-50:  #FAF5FF;
--purple-100: #F4F0FF;
--purple-500: #A855F7;
--purple-600: #9333EA;
```

---

### Background Colors

```css
--bg-primary: #FFFFFF;           /* Main background */
--bg-secondary: #FAFAFA;         /* Alternate sections */
--bg-tertiary: #F5F5F5;          /* Cards, panels */
--bg-accent: #FFFBEB;            /* Highlight sections */
--bg-purple-subtle: #F4F0FF;     /* AI features */
--bg-success-subtle: #F0FDF4;    /* Success states */
```

---

## 📝 Typography

### Font Family
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-display: 'Inter Display', 'Inter', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Type Scale

**Headings** (semibold to bold)
```css
--text-xs:   0.75rem;  /* 12px - small labels */
--text-sm:   0.875rem; /* 14px - body, table text */
--text-base: 1rem;     /* 16px - primary body */
--text-lg:   1.125rem; /* 18px - large body, small headings */
--text-xl:   1.25rem;  /* 20px - h4 */
--text-2xl:  1.5rem;   /* 24px - h3 */
--text-3xl:  1.875rem; /* 30px - h2 */
--text-4xl:  2.25rem;  /* 36px - h1 (dashboard) */
--text-5xl:  3rem;     /* 48px - h1 (marketing) */
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Line Heights
```css
--leading-tight: 1.25;   /* Headings */
--leading-snug: 1.375;   /* Subheadings */
--leading-normal: 1.5;   /* Body text */
--leading-relaxed: 1.625; /* Comfortable reading */
```

### Letter Spacing
```css
--tracking-tighter: -0.05em;  /* Large headings */
--tracking-tight: -0.025em;   /* Medium headings */
--tracking-normal: 0;         /* Body text */
--tracking-wide: 0.025em;     /* Uppercase labels */
```

### Usage Examples

```tsx
// Page Title
<h1 className="text-4xl font-semibold text-neutral-900 tracking-tight">
  Customer Intelligence
</h1>

// Section Heading
<h2 className="text-2xl font-semibold text-neutral-800 tracking-tight">
  Growth Opportunities
</h2>

// Card Title
<h3 className="text-lg font-medium text-neutral-700">
  Dormant VIP Recovery
</h3>

// Body Text
<p className="text-sm text-neutral-600 leading-normal">
  431 high-value customers haven't purchased in 60+ days
</p>

// Small Label
<span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
  Campaign Status
</span>
```

---

## 📐 Spacing System

Based on 4px grid.

```css
--space-0:   0px;
--space-1:   4px;
--space-2:   8px;
--space-3:   12px;
--space-4:   16px;
--space-5:   20px;
--space-6:   24px;
--space-8:   32px;
--space-10:  40px;
--space-12:  48px;
--space-16:  64px;
--space-20:  80px;
--space-24:  96px;
```

**Tailwind**: `p-4`, `m-6`, `gap-8`, `space-y-4`

---

## 🔲 Border Radius

```css
--radius-none: 0px;
--radius-sm:   2px;    /* Subtle - inputs, small cards */
--radius-base: 8px;    /* Default - buttons, cards */
--radius-md:   10px;   /* Medium - larger cards */
--radius-lg:   12px;   /* Large - modals, panels */
--radius-xl:   20px;   /* Extra large - feature cards */
--radius-2xl:  32px;   /* Huge - hero sections */
--radius-full: 9999px; /* Pills, badges, avatars */
```

**Tailwind**: `rounded-lg`, `rounded-full`

---

## 🎯 Button Styles

### Primary Button
```tsx
<button className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors">
  Generate Intelligence
</button>
```

### Secondary Button
```tsx
<button className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-700 font-medium text-sm rounded-lg transition-colors">
  Cancel
</button>
```

### Ghost Button
```tsx
<button className="px-4 py-2.5 hover:bg-neutral-100 active:bg-neutral-200 text-neutral-700 font-medium text-sm rounded-lg transition-colors">
  View Details
</button>
```

### Outline Button
```tsx
<button className="px-4 py-2.5 border-2 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-medium text-sm rounded-lg transition-all">
  Export
</button>
```

### Destructive Button
```tsx
<button className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium text-sm rounded-lg transition-colors">
  Delete Campaign
</button>
```

### Button Sizes
```tsx
// Small
className="px-3 py-1.5 text-xs"

// Medium (default)
className="px-4 py-2.5 text-sm"

// Large
className="px-6 py-3 text-base"
```

---

## 🃏 Card Styles

### Default Card
```tsx
<div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
  {/* Content */}
</div>
```

### Elevated Card
```tsx
<div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
  {/* Content */}
</div>
```

### Subtle Card
```tsx
<div className="bg-neutral-50 rounded-lg p-6">
  {/* Content */}
</div>
```

### Accent Card
```tsx
<div className="bg-amber-50 border border-amber-100 rounded-lg p-6">
  {/* Content */}
</div>
```

### Interactive Card (clickable)
```tsx
<div className="bg-white border border-neutral-200 rounded-lg p-6 hover:border-amber-300 hover:shadow-md cursor-pointer transition-all">
  {/* Content */}
</div>
```

---

## 📝 Input Styles

### Text Input
```tsx
<input
  type="text"
  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
  placeholder="Enter customer name..."
/>
```

### Input with Error
```tsx
<input
  className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
/>
<p className="mt-1 text-xs text-red-600">This field is required</p>
```

### Input with Icon
```tsx
<div className="relative">
  <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
  <input
    className="w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
    placeholder="Search customers..."
  />
</div>
```

---

## 🎭 Shadows & Elevation

```css
/* Subtle - cards, inputs */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

/* Default - elevated cards */
--shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
               0 1px 2px -1px rgba(0, 0, 0, 0.1);

/* Medium - hover states, dropdowns */
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
             0 2px 4px -2px rgba(0, 0, 0, 0.1);

/* Large - modals, popovers */
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
             0 4px 6px -4px rgba(0, 0, 0, 0.1);

/* Extra large - drawers */
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
             0 8px 10px -6px rgba(0, 0, 0, 0.1);

/* Glow - special highlights */
--shadow-glow: 0 0 24px rgba(245, 158, 11, 0.2);
```

**Tailwind**: `shadow-sm`, `shadow-md`, `shadow-lg`

---

## 📊 Table Styles

```tsx
<div className="border border-neutral-200 rounded-lg overflow-hidden">
  <table className="w-full">
    <thead className="bg-neutral-50 border-b border-neutral-200">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
          Customer
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-neutral-200">
      <tr className="hover:bg-neutral-50 transition-colors">
        <td className="px-6 py-4 text-sm text-neutral-700">
          Sarah Kumar
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 🏷️ Badge & Pill Styles

### Status Badges
```tsx
// Success
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
  Active
</span>

// Warning
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
  Pending
</span>

// Error
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
  Failed
</span>

// Info
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
  Processing
</span>
```

---

## 🎨 Background Patterns

### Gradient Backgrounds
```tsx
// Subtle gradient
<div className="bg-gradient-to-b from-neutral-50 to-white">
  {/* Content */}
</div>

// Accent gradient
<div className="bg-gradient-to-br from-amber-50 via-white to-purple-50">
  {/* Content */}
</div>

// Dark gradient
<div className="bg-gradient-to-b from-neutral-900 to-neutral-800">
  {/* Content */}
</div>
```

---

## 🧭 Navigation Patterns

### Sidebar Navigation
```tsx
<nav className="w-64 h-screen bg-white border-r border-neutral-200 p-4">
  <a href="#" className="flex items-center px-3 py-2 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors">
    <Users className="mr-3 h-5 w-5" />
    Customers
  </a>
  {/* Active state */}
  <a href="#" className="flex items-center px-3 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg">
    <TrendingUp className="mr-3 h-5 w-5" />
    Opportunities
  </a>
</nav>
```

### Tabs
```tsx
<div className="border-b border-neutral-200">
  <nav className="-mb-px flex space-x-8">
    <button className="border-b-2 border-amber-500 py-4 px-1 text-sm font-medium text-amber-600">
      Overview
    </button>
    <button className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-neutral-500 hover:text-neutral-700 hover:border-neutral-300">
      Campaigns
    </button>
  </nav>
</div>
```

---

## 📱 Layout Patterns

### Container Widths
```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

**Tailwind**: `max-w-7xl mx-auto`, `container`

### Grid Layouts
```tsx
// Dashboard grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Cards */}
</div>

// Content + Sidebar
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  <div className="lg:col-span-3">{/* Main */}</div>
  <div className="lg:col-span-1">{/* Sidebar */}</div>
</div>
```

---

## ✨ Animation & Transitions

```css
--transition-fast: 150ms;
--transition-base: 200ms;
--transition-slow: 300ms;

--ease-out: cubic-bezier(0.0, 0.0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0.0, 1, 1);
--ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1);
```

**Tailwind**: `transition-colors`, `transition-all`, `duration-200`

---

## 🎯 Usage Guidelines

### DO's ✅
- Use amber for primary actions and brand presence
- Keep backgrounds clean (white/neutral-50)
- Use plenty of whitespace (24px, 32px, 48px gaps)
- Use rounded corners consistently (8px for cards, 12px for modals)
- Apply subtle shadows for elevation
- Use medium font weights (500-600) for headings
- Keep text tight with negative letter spacing

### DON'Ts ❌
- Don't use bright, saturated colors excessively
- Don't over-use gradients or effects
- Don't mix border radius sizes arbitrarily
- Don't use small font sizes (<12px) for body text
- Don't stack heavy shadows
- Don't use more than 2-3 accent colors per screen

---

## 🔧 Tailwind Configuration

Update `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter Display', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        'sm': '2px',
        DEFAULT: '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '20px',
        '2xl': '32px',
      },
    },
  },
  plugins: [],
}
export default config
```

---

**Last Updated**: Phase 2B
**Status**: Ready for Implementation
