# Kast Design System

The visual language of the Kast admin panel. Everything here lives in
`apps/admin/src/app/globals.css` (tokens) and `apps/admin/src/components/ui/`
(components). Screens consume the system; they never redefine it.

Screenshots of every screen, in both themes:
[`docs/screenshots/`](../screenshots/README.md).

---

## 1. Why this exists

The admin panel previously carried three parallel colour systems:

| System                                        | Status before                               |
| --------------------------------------------- | ------------------------------------------- |
| `bg-[--color-primary]` arbitrary values       | **Dead.** Tailwind v3 syntax, removed in v4 |
| `bg-primary` theme utilities                  | Worked                                      |
| `bg-white dark:bg-gray-900` hardcoded palette | Worked, but off-system                      |

The first was the majority of the code. Tailwind v4 removed the
`bg-[--var]` shorthand in favour of `bg-(--var)`, and rather than erroring it
compiles to a literal invalid declaration:

```css
/* what the old syntax produced — dropped by every browser */
.bg-\[--color-primary\] {
  background-color: --color-primary;
}
/* what a real token produces */
.bg-primary {
  background-color: var(--primary);
}
```

279 class references across the app resolved to nothing, which is why buttons
had no fill, inputs had no background and the sidebar had no surface. The
animation utilities (`animate-in`, `zoom-in-95`, `slide-in-from-*`) were also
referenced without `tailwindcss-animate` ever being installed, so every
dialog, sheet, dropdown and toast transition was inert.

This document describes what replaced all of it.

---

## 2. Token architecture

Two layers, deliberately separated.

**Layer 1 — palette.** Raw ramps in `@theme`. Theme-independent; identical in
light and dark. `--color-brand-*`, `--color-ink-*`, `--color-success-*`,
`--color-warning-*`, `--color-danger-*`, `--color-info-*`.

**Layer 2 — semantics.** Role tokens on `:root`, re-declared on `.dark`, then
re-exported through `@theme inline`:

```css
:root {
  --primary: oklch(0.478 0.229 285.55);
}
.dark {
  --primary: oklch(0.685 0.185 285.55);
}

@theme inline {
  --color-primary: var(--primary);
}
```

`inline` is what makes runtime theming work: the compiled utility keeps the
`var()` reference instead of being frozen to a literal colour, so toggling the
`dark` class re-themes the entire app with no rebuild and no flash.

Screens should only ever use layer 2.

### Colour space

All colours are OKLCH. A given lightness step means the same _perceived_ step
on every hue, so `--success` and `--warning` carry equal visual weight instead
of one shouting over the other.

The brand hue, **285.55°**, is sampled directly from the Kast logo (`#4216a5`)
rather than picked by eye — product and mark are the same violet.

### Semantic roles

| Group   | Tokens                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| Surface | `background`, `card`, `popover`, `muted`, `secondary`, `accent`                                                  |
| Text    | `foreground`, `muted-foreground`, plus a `-foreground` pair for every surface and accent                         |
| Brand   | `primary`, `primary-hover`, `primary-subtle`, `primary-subtle-foreground`                                        |
| Status  | `success`, `warning`, `destructive`, `info` — each with `-foreground`, `-subtle`, `-subtle-foreground`           |
| Lines   | `border`, `border-strong`, `input`, `ring`, `overlay`                                                            |
| Sidebar | `sidebar`, `sidebar-foreground`, `sidebar-muted-foreground`, `sidebar-accent*`, `sidebar-border`, `sidebar-ring` |
| Charts  | `chart-1` … `chart-6`, spaced around the wheel so adjacent series stay distinguishable                           |

Each status colour comes in two strengths on purpose: **solid** (`bg-success`

- `text-success-foreground`) for high emphasis, and **subtle**
  (`bg-success-subtle` + `text-success-subtle-foreground`) for chips, banners and
  anything that appears many times in a list. Using solid everywhere is how a UI
  ends up shouting.

### Dark mode is not an inversion

Surfaces get _lighter_ as they come forward (`background` → `card` → `popover`),
chroma is pulled back on large fills to stop them vibrating, accent lightness is
raised so contrast still passes on a dark ground, and shadows are deepened
because a soft shadow is invisible on dark.

Theme selection is a class on `<html>`, written before first paint by a small
inline script in `app/layout.tsx`. `ThemeProvider` takes over after hydration
and offers light / dark / system.

---

## 3. Typography

Self-hosted variable fonts, loaded through `next/font/local`
(`apps/admin/src/lib/fonts.ts`):

| Face                 | Role                                         |
| -------------------- | -------------------------------------------- |
| **Inter Variable**   | All UI text (Latin + Latin Extended subsets) |
| **JetBrains Mono**   | IDs, tokens, slugs, JSON, code               |
| **Noto Sans Arabic** | The `ar` locale                              |

Self-hosting rather than fetching from Google Fonts means `next build` works
with no network (CI, Docker), no third-party request leaves an authenticated
admin panel, and the exact files are pinned in-repo.

Noto Sans Arabic sits _after_ Inter in the `--font-sans` stack. Browsers fall
through per glyph, so Arabic resolves automatically without a locale-conditional
class — and it is marked `preload: false` so its 162 KB never touches the
critical path for Latin locales.

**Base size is 14px, not 16px.** This is a dense data application; 16px body
text pushes tables off the screen. The scale carries its own line-heights and
tracking, so `text-sm` alone produces typographically correct text:

`text-2xs` 11 · `text-xs` 12 · `text-sm` 13 · `text-base` 14 · `text-md` 15 ·
`text-lg` 17 · `text-xl` 20 · `text-2xl` 24 · `text-3xl` 30 · `text-4xl` 36

Inter's `cv11` and `ss01` features are enabled globally (single-storey
alternates, disambiguated `I`/`l`), and tables get `tabular-nums` so numeric
columns line up.

---

## 4. Shape, depth and motion

**Radius** derives from one variable. Change `--radius` and the whole UI
re-rounds:

```css
--radius: 0.625rem;
--radius-md: calc(var(--radius) - 0.125rem);
```

**Shadows** are layered — a tight contact shadow plus a wider ambient one. A
single blur reads as a smudge; two read as a real object. Six steps,
`shadow-2xs` → `shadow-xl`, each redefined for dark mode.

**Motion** is short by design: 150 ms with `ease-out-quad` for state changes,
`ease-spring` for anything that travels. An admin panel is used all day —
anything slower starts to feel like it is in the way. All of it collapses under
`prefers-reduced-motion`.

---

## 5. Components

`apps/admin/src/components/ui/`. Radix primitives underneath, so keyboard
navigation, focus trapping and ARIA are handled.

| Component                                                                                | Notes                                                                      |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Button`                                                                                 | 9 variants × 8 sizes, `loading` prop, 1px press translation                |
| `Input` / `Textarea` / `Select`                                                          | Share `fieldBaseClasses`, so every field is pixel-identical                |
| `Card` + header/title/description/action/content/footer                                  | `default`, `elevated`, `flat`, `dashed`; `interactive` for clickable cards |
| `Badge`                                                                                  | 9 variants, 3 sizes, optional status `dot`                                 |
| `Alert`                                                                                  | Auto-selects its icon from the variant                                     |
| `Table`                                                                                  | Sticky header, tabular numerals, own scroll container                      |
| `Dialog` / `Sheet`                                                                       | `SheetBody` keeps header and footer pinned while the middle scrolls        |
| `DropdownMenu`                                                                           | Items, checkbox items, radio items, submenus, shortcuts                    |
| `Tooltip` + `Hint`                                                                       | `Hint` wraps the 90 % case in one component                                |
| `Skeleton` / `SkeletonText`                                                              | Travelling sheen, not a pulse                                              |
| `EmptyState`                                                                             | One definition of "nothing here yet"                                       |
| `PageHeader`                                                                             | One definition of what a page title looks like                             |
| `Spinner` / `LoadingBlock`                                                               | Arc with a round cap — legible at 12px                                     |
| `Progress`, `Kbd`, `Separator`, `Avatar`, `Tabs`, `Switch`, `Checkbox`, `Label`, `Toast` |                                                                            |

### Focus

One treatment everywhere: a 2px `ring` in the ring colour, offset by 2px
against the surface behind it. Interactive components opt into the richer
ring-plus-glow through the `.focus-ring` helper. Focus is never removed.

### RTL

The admin ships an Arabic locale, so all components use logical properties —
`ps-`/`pe-`, `ms-`/`me-`, `start-`/`end-` — never `pl-`/`pr-`/`left-`/`right-`.
Directional affordances (switch thumb travel, submenu chevrons, sheet slide
direction) flip explicitly under `rtl:`.

---

## 6. Rules for screens

1. **Only semantic tokens.** No `gray-500`, no `bg-white`, no hex values.
2. **No `dark:` variants.** The token layer already handles both themes. A
   `dark:` class in a screen is a bug — it means the light value was hardcoded.
3. **Compose, don't re-implement.** If you are writing
   `rounded-lg border bg-card p-5`, you want `<Card>`.
4. **The layout owns page padding.** `(dashboard)/layout.tsx` wraps every screen
   in `.page-container`; screens must not add their own outer padding.
5. **Vertical rhythm:** `space-y-6` between major blocks, `space-y-4` within a
   block, `gap-2` between adjacent controls.
6. **Icon-only buttons need `aria-label`.**

### Guarding against regressions

These greps must all return nothing across `apps/admin/src`:

```bash
grep -rn "\[--color-" --include=*.tsx src            # dead Tailwind v3 syntax
grep -rn "dark:"      --include=*.tsx src            # off-system theming
grep -rnE "(bg|text|border|ring)-(gray|slate|zinc|neutral|stone|indigo|blue|red|green|emerald|yellow|amber|orange|purple|violet|sky|rose|teal|cyan|lime|pink|fuchsia)-[0-9]" --include=*.tsx src
grep -rnE "(bg|text)-(white|black)\b" --include=*.tsx src
```

The first one is worth keeping permanently: it fails silently at runtime and is
invisible in code review.
