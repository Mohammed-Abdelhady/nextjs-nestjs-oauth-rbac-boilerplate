# Semantic Color System

**Status**: Active
**Last Updated**: 2026-01-17

---

## Overview

This document defines the semantic color token system used throughout the application. All UI components MUST use semantic tokens from `globals.css` instead of hardcoded Tailwind color utilities.

**Benefits**:

- Automatic theme switching (light/dark mode)
- Single source of truth for all colors
- WCAG AA/AAA contrast compliance guaranteed
- Easy brand color updates (1 file change)
- Better performance (CSS variables, no re-renders)

---

## Color Token Mapping

### Hardcoded to Semantic Token Reference

| Hardcoded Class   | Semantic Token                    | Use Case            | Example                         |
| ----------------- | --------------------------------- | ------------------- | ------------------------------- |
| `bg-gray-100`     | `bg-background`                   | Page backgrounds    | Main content area               |
| `bg-white`        | `bg-card`                         | Elevated surfaces   | Cards, modals, panels           |
| `bg-indigo-500`   | `bg-primary`                      | Primary actions     | Submit buttons, CTAs            |
| `bg-indigo-100`   | `bg-primary/10`                   | Subtle primary tint | Illustration panels, highlights |
| `bg-indigo-700`   | `bg-primary` + `hover:opacity-90` | Hover states        | Use opacity instead of color    |
| `text-gray-900`   | `text-foreground`                 | Primary text        | Headings, body text             |
| `text-gray-800`   | `text-foreground`                 | Button text         | Text on buttons                 |
| `text-gray-700`   | `text-muted-foreground`           | Secondary text      | Captions, labels                |
| `text-gray-600`   | `text-muted-foreground`           | Placeholder text    | Input placeholders, hints       |
| `text-white`      | `text-primary-foreground`         | Text on primary     | Text on primary buttons         |
| `border-gray-200` | `border-border`                   | Default borders     | Card borders, dividers          |
| `border-gray-400` | `border-ring`                     | Focus borders       | Focus indicators                |
| `bg-red-50`       | `bg-destructive/10`               | Error backgrounds   | Error message backgrounds       |
| `text-red-600`    | `text-destructive`                | Error text          | Error messages, warnings        |

---

## Available Semantic Tokens

### Background Colors

| Token            | Usage                                   | Light Mode           | Dark Mode            |
| ---------------- | --------------------------------------- | -------------------- | -------------------- |
| `bg-background`  | Page-level backgrounds                  | Gray-100 (#f3f4f6)   | Slate-950 (#020617)  |
| `bg-card`        | Elevated surfaces (cards, modals)       | White (#ffffff)      | Slate-950 (#020617)  |
| `bg-popover`     | Floating overlays (tooltips, dropdowns) | White (#ffffff)      | Slate-950 (#020617)  |
| `bg-primary`     | Primary brand color                     | Indigo-500 (#6366f1) | Indigo-500 (#6366f1) |
| `bg-secondary`   | Secondary actions                       | Gray-100 (#f3f4f6)   | Slate-800 (#1e293b)  |
| `bg-muted`       | Muted/subtle backgrounds                | Gray-100 (#f3f4f6)   | Slate-800 (#1e293b)  |
| `bg-accent`      | Accent highlights                       | Gray-100 (#f3f4f6)   | Slate-800 (#1e293b)  |
| `bg-destructive` | Destructive actions (delete, error)     | Red-500 (#ef4444)    | Red-900 (#7f1d1d)    |
| `bg-input`       | Unchecked switch track, never a field   | `hsl(220 13% 58%)`   | `hsl(215 20% 41%)`   |

Form fields are filled with `bg-background`. `--input` is the field border colour, so `bg-input` on a field paints it in the border colour.

### Text Colors

| Token                       | Usage                         | Light Mode           | Dark Mode            |
| --------------------------- | ----------------------------- | -------------------- | -------------------- |
| `text-foreground`           | Primary text content          | Gray-900 (#111827)   | Gray-50 (#f9fafb)    |
| `text-muted-foreground`     | Secondary/muted text          | Gray-600 (#4b5563)   | Gray-400 (#9ca3af)   |
| `text-primary`              | Primary brand color text      | Indigo-500 (#6366f1) | Indigo-500 (#6366f1) |
| `text-primary-foreground`   | Text on primary backgrounds   | White (#ffffff)      | Gray-900 (#111827)   |
| `text-secondary-foreground` | Text on secondary backgrounds | Gray-900 (#111827)   | Gray-50 (#f9fafb)    |
| `text-destructive`          | Error/warning text            | Red-600 (#dc2626)    | Red-400 (#f87171)    |

### Border Colors

| Token           | Usage                 | Light Mode           | Dark Mode            |
| --------------- | --------------------- | -------------------- | -------------------- |
| `border-border` | Default borders       | Gray-200 (#e5e7eb)   | Slate-800 (#1e293b)  |
| `border-input`  | Input field borders   | `hsl(220 13% 58%)`   | `hsl(215 20% 41%)`   |
| `border-ring`   | Focus ring indicators | Indigo-500 (#6366f1) | Indigo-500 (#6366f1) |

---

## Usage Guidelines

### ✅ Correct Usage

```tsx
// Page layout
<div className="min-h-screen bg-background text-foreground">

// Card component
<div className="bg-card border border-border rounded-lg p-6">

// Primary button
<button className="bg-primary text-primary-foreground hover:opacity-90">
  Submit
</button>

// Secondary button
<button className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
  Cancel
</button>

// Error message
<div className="bg-destructive/10 text-destructive p-3 rounded-md">
  Error message here
</div>

// Input field
<input className="bg-background border-input focus:border-ring" />
```

### ❌ Incorrect Usage (DO NOT USE)

```tsx
// ❌ Hardcoded colors
<div className="bg-gray-100 text-gray-900">

// ❌ Dark variants (use semantic tokens instead)
<div className="bg-white dark:bg-gray-800">

// ❌ Specific color shades
<button className="bg-indigo-500 hover:bg-indigo-700">

// ❌ Hardcoded error colors
<div className="bg-red-50 text-red-600">
```

---

## Opacity Modifiers

Use Tailwind's opacity syntax for color variations:

```tsx
// 10% opacity primary color
<div className="bg-primary/10">

// 80% opacity secondary color (hover state)
<button className="bg-secondary hover:bg-secondary/80">

// 90% opacity for subtle darkening
<button className="bg-primary hover:opacity-90">
```

---

## Token Pairing Rules

Always pair background and foreground tokens correctly for WCAG compliance:

| Background Token | Foreground Token            | Contrast Ratio |
| ---------------- | --------------------------- | -------------- |
| `bg-background`  | `text-foreground`           | 15.8:1 (AAA)   |
| `bg-card`        | `text-foreground`           | 21:1 (AAA)     |
| `bg-primary`     | `text-primary-foreground`   | 4.5:1 (AA)     |
| `bg-secondary`   | `text-secondary-foreground` | 15.8:1 (AAA)   |
| `bg-destructive` | `text-primary-foreground`   | 4.5:1 (AA)     |

A form field is `bg-background` with `text-foreground`, the first row above. Its `border-input` border needs 3:1 against the page and the card. `npm run check:contrast` checks both in light and dark.

---

## Adding New Tokens

To add a new semantic token:

1. **Define CSS variable in `globals.css`**:

   ```css
   :root {
     --new-token: 200 90% 50%; /* HSL values */
   }

   .dark {
     --new-token: 200 80% 60%; /* Dark mode variant */
   }
   ```

2. **Map to Tailwind utility in `@theme inline`**:

   ```css
   @theme inline {
     --color-new-token: hsl(var(--new-token));
   }
   ```

3. **Use in components**:

   ```tsx
   <div className="bg-new-token text-new-token-foreground">
   ```

4. **Verify contrast ratios** meet WCAG AA (4.5:1 minimum)

---

## Migration Guide

### Before Migration (Hardcoded)

```tsx
<div className="min-h-screen bg-gray-100 text-gray-900">
  <div className="bg-white shadow rounded-lg p-6">
    <h1 className="text-2xl font-bold text-gray-900">Title</h1>
    <p className="text-gray-600">Description</p>
    <button className="bg-indigo-500 text-white hover:bg-indigo-700">Submit</button>
  </div>
</div>
```

### After Migration (Semantic Tokens)

```tsx
<div className="min-h-screen bg-background text-foreground">
  <div className="bg-card shadow rounded-lg p-6">
    <h1 className="text-2xl font-bold text-foreground">Title</h1>
    <p className="text-muted-foreground">Description</p>
    <button className="bg-primary text-primary-foreground hover:opacity-90">Submit</button>
  </div>
</div>
```

**Changes Made**:

- `bg-gray-100` → `bg-background`
- `bg-white` → `bg-card`
- `text-gray-900` → `text-foreground`
- `text-gray-600` → `text-muted-foreground`
- `bg-indigo-500 text-white` → `bg-primary text-primary-foreground`
- `hover:bg-indigo-700` → `hover:opacity-90`

---

## Automated Checks

### CI Validation

The project includes automated checks to prevent hardcoded color regression:

```bash
# Run color validation
npm run check:colors

# This checks for:
# - Hardcoded gray colors: bg-gray-*, text-gray-*, border-gray-*
# - Hardcoded brand colors: bg-indigo-*, text-indigo-*
# - Dark variants: dark:bg-*, dark:text-*, dark:border-*
```

---

## Troubleshooting

### Issue: Theme not switching

**Symptom**: Theme toggle button works but colors don't change

**Cause**: Components using hardcoded colors instead of semantic tokens

**Solution**:

1. Search for hardcoded colors: `rg "(bg|text|border)-(gray|indigo)-\d+" src/`
2. Replace with semantic tokens using mapping table above
3. Remove any `dark:` variant classes

### Issue: Poor contrast in dark mode

**Symptom**: Text hard to read in dark mode

**Cause**: Wrong token pairing or custom colors

**Solution**:

1. Use correct token pairs from "Token Pairing Rules" section
2. Verify with browser DevTools contrast checker
3. All pairs must meet WCAG AA (4.5:1 minimum)

### Issue: Hover state not visible

**Symptom**: Button hover state barely noticeable

**Solution**: Use opacity modifiers instead of color changes:

```tsx
// ❌ Before
<button className="bg-primary hover:bg-primary-dark">

// ✅ After
<button className="bg-primary hover:opacity-90">
```

---

## CSS Variable Reference

All semantic tokens map to CSS variables defined in `globals.css`:

```css
/* Light mode (default) */
:root {
  --background: 220 14% 96%;
  --foreground: 224 71% 4%;
  --card: 0 0% 100%;
  --primary: 239 84% 67%;
  --secondary: 220 14% 96%;
  --muted: 220 14% 96%;
  --accent: 220 14% 96%;
  --destructive: 0 84% 60%;
  --border: 220 13% 91%;
  --input: 220 13% 58%; /* field border, not a field fill */
  --ring: 239 84% 67%;
  /* ... see globals.css for complete list */
}

/* Dark mode */
.dark {
  --background: 224 71% 4%;
  --foreground: 210 20% 98%;
  --input: 215 20% 41%;
  /* ... see globals.css for complete list */
}
```

---

## Additional Resources

- **shadcn/ui Documentation**: [ui.shadcn.com/docs/theming](https://ui.shadcn.com/docs/theming)
- **Tailwind CSS Variables**: [tailwindcss.com/docs/customizing-colors](https://tailwindcss.com/docs/customizing-colors)
- **WCAG Contrast Guidelines**: [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/)
- **Project globals.css**: `frontend/src/app/globals.css`

---

## Maintenance

This color system requires minimal maintenance:

- **Brand color change**: Update `--primary` in `globals.css` only
- **New theme addition**: Add new selector (e.g., `.high-contrast`) with variable definitions
- **Token addition**: Follow "Adding New Tokens" section above
- **Contrast verification**: Run automated checks or use browser DevTools

**Last Reviewed**: 2026-01-17
**Next Review**: When adding new major UI components or brand updates
