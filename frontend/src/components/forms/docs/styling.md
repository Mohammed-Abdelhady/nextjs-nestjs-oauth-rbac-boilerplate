## Global Form Styling

All form styles are centralized in `/src/lib/config/form-styles.ts` using a **three-layer token-based architecture** that eliminates repetition and provides powerful customization.

### Architecture Overview

```
TOKENS (atomic design tokens)
    ↓
BASE_COMPOSITIONS (pre-composed style groups)
    ↓
FORM_STYLES (final component styles)
```

#### Layer 1: TOKENS - Atomic Design Tokens

Single source of truth for all visual properties:

```typescript
const TOKENS = {
  colors: {
    bg: 'bg-background', // All input backgrounds
    border: 'border-input', // Border color
    // ... more color tokens
  },
  spacing: {
    width: 'w-full',
    borderRadius: 'rounded-lg',
  },
  typography: {
    fontSize: 'text-sm',
    fontWeight: 'font-medium',
  },
  input: {
    height: 'h-14',
    padding: 'px-5',
  },
  // ... component-specific tokens
};
```

#### Layer 2: BASE_COMPOSITIONS - Shared Style Groups

Pre-composed arrays of styles shared across components:

```typescript
const BASE_COMPOSITIONS = {
  formField: [
    TOKENS.spacing.width,
    TOKENS.spacing.borderRadius,
    TOKENS.typography.fontWeight,
    // ... all shared input/textarea styles
  ],
  button: [
    TOKENS.button.height,
    TOKENS.spacing.width,
    // ... all shared button styles
  ],
};
```

#### Layer 3: FORM_STYLES - Final Component Styles

Built by composing base styles with component-specific tokens:

```typescript
export const FORM_STYLES = {
  input: {
    base: [...BASE_COMPOSITIONS.formField, TOKENS.input.height, TOKENS.input.padding].join(' '),
  },
  // ... other components
};
```

### Customization Guide

#### Change All Input Backgrounds

Edit one token → affects all inputs, textareas, selects:

```typescript
// src/lib/config/form-styles.ts
const TOKENS = {
  colors: {
    bg: 'bg-blue-50', // Changed from bg-background
  },
};
```

#### Change Border Radius Globally

```typescript
const TOKENS = {
  spacing: {
    borderRadius: 'rounded-xl', // Affects all form fields and buttons
  },
};
```

#### Change Input Height Only

```typescript
const TOKENS = {
  input: {
    height: 'h-16', // Only affects inputs, not buttons or textareas
  },
};
```

#### Change Primary Button Color

```typescript
const TOKENS = {
  colors: {
    buttonPrimaryBg: 'bg-purple-500',
    buttonPrimaryBgHover: 'hover:bg-purple-700',
  },
};
```

### Helper Functions

Simplified, DRY helper functions for applying styles:

```typescript
import {
  getInputClassName,
  getTextareaClassName,
  getButtonClassName,
} from '@/lib/config/form-styles';

// Apply global input styles
const inputClass = getInputClassName();

// Apply with overrides
const tallInput = getInputClassName('h-20 px-8');

// Button variants
const primary = getButtonClassName('primary');
const secondary = getButtonClassName('secondary', 'w-auto max-w-md');
```

### Per-Component Overrides

Pass `className` prop to override specific styles:

```tsx
<FormInput
  name="email"
  className="h-16 px-6 bg-blue-50"  // Overrides height, padding, background
/>

<FormTextarea
  name="bio"
  className="min-h-40 border-2 border-blue-500"  // Custom height and border
/>

<FormSelect
  name="country"
  className="h-20"  // Taller select only
/>
```

### Design System Tokens

Current design system values:

| Category       | Token              | Value                    | Applied To               |
| -------------- | ------------------ | ------------------------ | ------------------------ |
| **Layout**     | width              | `w-full`                 | All form fields          |
|                | borderRadius       | `rounded-lg`             | All form fields, buttons |
|                | input.height       | `h-14` (56px)            | Inputs, selects          |
|                | textarea.minHeight | `min-h-30` (120px)       | Textareas                |
| **Spacing**    | input.padding      | `px-5` (20px horizontal) | Inputs, selects          |
|                | textarea.padding   | `px-5 py-3`              | Textareas                |
| **Colors**     | bg                 | `bg-background`          | All form fields          |
|                | border             | `border-input`           | All form fields          |
|                | borderFocus        | `focus:border-gray-400`  | All form fields (focus)  |
| **Typography** | fontSize           | `text-sm`                | All form fields          |
|                | fontWeight         | `font-medium`            | All form fields          |
| **Buttons**    | Primary BG         | `bg-indigo-500`          | Primary buttons          |
|                | Primary Hover      | `hover:bg-indigo-700`    | Primary buttons (hover)  |
|                | Secondary BG       | `bg-indigo-100`          | Secondary buttons        |

### Benefits of Token-Based System

✅ **No Repetition** - Define once, use everywhere via composition
✅ **Easy Theming** - Change one token → updates all related components
✅ **Type Safety** - `as const` ensures tokens can't be accidentally modified
✅ **Clear Hierarchy** - Understand which styles affect which components
✅ **Maintainable** - Add new components by composing existing tokens
✅ **Discoverable** - All customization points clearly documented

### Naming Conventions

- **Tokens**: `camelCase` nested objects (TOKENS.colors.bg)
- **Compositions**: `camelCase` (BASE_COMPOSITIONS.formField)
- **Functions**: `camelCase` (getInputClassName, buildClassName)
- **Constants**: `UPPER_SNAKE_CASE` (FORM_STYLES, TOKENS)
- **Components**: `PascalCase` (FormInput, FormPassword)
- **Props**: `camelCase` (className, showToggle, applyGlobalStyles)

---

For auth field spacing, pass `FORM_STYLES.authField` through `FormInput`'s `containerClassName` or `FormPassword`'s `className`. These apply spacing to the whole labeled field. Keep input-specific font and alignment classes in `FormInput`'s `className`.

Email inputs and inputs with `autoComplete="one-time-code"` use left-to-right direction in the shared input component. Other inputs preserve their caller or page direction.
