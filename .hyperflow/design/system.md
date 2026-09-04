# Design system

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| Owner           | orchestrator                                          |
| Applies to      | frontend/src (Tailwind 4, shadcn/ui, Radix)           |
| Status          | adopted 2026-09-04; implemented by T15, T16, T17, T18 |
| Source findings | A07 to A12, A17, A19 to A29, A31, A36, A40            |

## TL;DR

One token set, contrast-checked in both themes, consumed only through Tailwind utilities. Text is never faded with alpha. Every direction utility is logical so Arabic mirrors without extra work. Focus is always visible. Loading, empty and error states exist for every list and guard.

## Color tokens

Values are HSL triplets for `globals.css`. Every text/background pair listed must reach 4.5:1 (WCAG 1.4.3) and every large-text or UI-boundary pair 3:1 (1.4.11). The implementer verifies with a small node script (`scripts/check-contrast.mjs`, wcag formula) and pastes the table in the report.

| Token                                | Light       | Dark        | Pairs with                                          |
| ------------------------------------ | ----------- | ----------- | --------------------------------------------------- |
| background                           | 220 14% 97% | 224 71% 5%  | foreground                                          |
| foreground                           | 224 71% 6%  | 210 20% 96% | background, card                                    |
| card                                 | 0 0% 100%   | 224 40% 9%  | card-foreground                                     |
| muted-foreground                     | 220 10% 40% | 217 12% 72% | background, card (must be >= 4.5:1 alone, no alpha) |
| text-tertiary (new, for helper text) | 220 8% 45%  | 217 10% 66% | background, card (>= 4.5:1)                         |
| primary                              | 239 65% 50% | 239 80% 74% | primary-foreground                                  |
| primary-foreground                   | 0 0% 100%   | 224 71% 6%  | primary                                             |
| destructive                          | 0 72% 45%   | 0 70% 66%   | destructive-foreground (white light, dark fg dark)  |
| success                              | 142 62% 30% | 142 55% 60% | success-foreground (white light, dark fg dark)      |
| warning                              | 38 92% 50%  | 38 92% 60%  | warning-foreground = 224 71% 6% in both themes      |
| info                                 | 201 90% 34% | 201 85% 66% | info-foreground (white light, dark fg dark)         |
| status-success (text on background)  | 142 60% 27% | 142 55% 62% | background                                          |
| status-warning (text)                | 32 85% 30%  | 38 90% 62%  | background                                          |
| status-danger (text)                 | 0 65% 40%   | 0 70% 68%   | background                                          |
| border                               | 220 13% 88% | 215 20% 20% | background (3:1 for inputs)                         |
| input                                | 220 13% 80% | 215 20% 28% | background (3:1)                                    |
| ring                                 | 239 65% 50% | 239 80% 74% | background (3:1)                                    |

Rules:

- Remove the parallel `surface-*`, `text-*`, `accent-*` token family (lines 84 to 97 of globals.css) after migrating its few consumers to the shadcn tokens above. One family only.
- No `text-muted-foreground/60` or any alpha on text. Use `text-muted-foreground` or `text-tertiary`.
- Disabled controls may use opacity 0.5 as a whole element, never on text alone.
- Theme provider: `defaultTheme="system"`, `enableSystem`, keep `disableTransitionOnChange`.

## Typography and spacing

- Font: Geist Sans, Geist Mono as already wired. Sizes: page title `text-2xl font-semibold tracking-tight` (not 4xl light), section title `text-lg font-medium`, body `text-sm`, helper `text-xs text-tertiary`.
- One `h1` per page (the page title). Brand in the sidebar is a link, not a heading. Cards use `h3` under a section `h2`; card headings never skip levels.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48. Page gutter `px-4 md:px-8`, page max width `max-w-7xl`, vertical rhythm `space-y-6`.
- Radius stays 0.5rem. Shadows: `shadow-sm` on cards, none on inputs.

## Direction and RTL

- Only logical utilities: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `border-s`, `border-e`, `rounded-s-`, `rounded-e-`, `text-start`, `text-end`. The lint pass in T17 greps for `\b(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right)-` and must return zero hits in `frontend/src` except inside `ltr:`/`rtl:` variants.
- Wrap the app in Radix `DirectionProvider dir={locale === 'ar' ? 'rtl' : 'ltr'}` in the locale layout; pass `dir` to Sonner's `Toaster` and position it `bottom-end` semantics (bottom-right in LTR, bottom-left in RTL).
- Icons that imply direction (chevrons for "next", arrows) get `rtl:rotate-180`. Icons that do not (external link, close) do not.
- Sidebar sits at `start-0`, drawer slides from the start edge, dashboard header controls live inside the dashboard header row (no fixed global header overlapping the sidebar).
- Numbers and dates use `useFormatter` from next-intl; Arabic keeps Western digits (`numberingSystem: 'latn'`) for consistency with codes users type.

## Focus, keyboard, and motion

- Focus style everywhere: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`. Delete every `focus:outline-none` that is not paired with a visible ring, and every `focus:shadow-outline`.
- Anything that reveals on hover also reveals on `focus-within` and is always visible on touch (`@media (hover: none)`).
- Minimum target 24x24 css px (2.5.8); icon buttons default to `h-9 w-9`; dense table actions `h-8 w-8` minimum.
- Motion: list entrance animations run once on mount, not on data updates. All animation utilities are wrapped in `motion-safe:`; `prefers-reduced-motion` disables transforms entirely.
- Skip link as the first element in the locale layout: `<a href="#main" class="sr-only focus:not-sr-only ...">`; the page content wrapper is `<main id="main" tabindex="-1">` exactly once per page.

## Component rules

- Use the shadcn primitives in `components/ui` for dialog, alert dialog, dropdown, select, tabs, switch, checkbox, tooltip (add `tooltip.tsx` and `sheet.tsx` from shadcn when needed). Never hand-roll a modal, menu or tooltip.
- Mobile navigation drawer is a `Sheet` (Radix Dialog): focus trap, `aria-modal`, Escape, focus return.
- Static informational banners use `Alert` with `role="note"`; only live problems use `role="alert"`.
- Buttons in a loading state keep their label visible, set `aria-busy`, and show the spinner with `aria-hidden`. Never replace the label with a spinner.
- Icon-only buttons always carry a translated `aria-label`; language options carry `lang`.
- Every list page has four states: skeleton (matching the card layout), empty (icon, one sentence, one action), error (message plus retry), and data. Lists are paginated server-side, 1-based, page size 20, with a debounced search (300 ms).
- Forms: visible label above the field, helper text below, error text below in `text-destructive` linked by `aria-describedby`, submit disabled only while submitting. Password fields expose a visibility toggle and a live rule checklist.
- Toasts come from one module, `@/lib/toast`, with success, error and info helpers. No direct `sonner` imports elsewhere.

## Page layouts

- Auth pages: single centered card, max width 28rem, product name as a link above, form title as `h1`, OAuth buttons below a labelled divider, secondary links under the form.
- Dashboard shell: sidebar 16rem at the start edge on `md+`, sheet drawer below `md`, header row with page title, language and theme switches, user menu at the end edge. Content area `max-w-7xl` with page header (title, one-line description, primary action at the end).
- Admin lists: toolbar (search, filters) above a responsive card grid or table; actions in a dropdown menu per row; destructive actions confirm through `AlertDialog`.
- Sessions: current session first and marked, others in a timeline list with device icon, browser and OS text, relative time, and a labelled sign-out button.

## Acceptance for design tasks

- Contrast table produced by the script, all pairs passing.
- Zero physical direction utilities outside `ltr:`/`rtl:` variants.
- Browser check in Chrome for `/en` and `/ar` on login, register, dashboard, users, roles, sessions and settings: no console errors, focus ring visible on Tab, drawer traps focus, screenshots attached to the report.
