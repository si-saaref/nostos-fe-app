# Color contract

The NOSTOS color system is defined in [src/styles/globals.css](../src/styles/globals.css).
This document explains the existing contract and how to use it. The stylesheet is
the source of truth for current color values; update this document when token
roles or theme behavior change.

## How colors reach the UI

1. Each theme assigns semantic CSS custom properties such as `--card` and `--ink`.
2. The `@theme inline` block maps those properties to `--color-*` aliases used by
   the app's utility classes, such as `bg-card`, `text-ink`, and `border-hair`.
3. Components choose tokens by meaning. Direct CSS and SVG styles can reference
   the same properties with `var(--token)`.

The contract requires colors to be owned by `globals.css`. Avoid adding hex,
RGB, HSL, or named color literals to components. Reuse an appropriate semantic
token, or add a token to every theme when a new role is necessary.

```tsx
<section className="bg-card text-ink border-hair rounded-xl border">
  <p className="text-muted">Secondary context</p>
  <button className="bg-accent text-accent-ink">Primary action</button>
</section>
```

## Token reference

### Surfaces and text

| Token      | Role                                           | Example utility |
| ---------- | ---------------------------------------------- | --------------- |
| `--ground` | Page canvas; also applied to `html` and `body` | `bg-ground`     |
| `--card`   | Cards, plates, dialogs, and popovers           | `bg-card`       |
| `--ink`    | Primary text; inherited from `body`            | `text-ink`      |
| `--muted`  | Secondary text and supporting context          | `text-muted`    |
| `--hair`   | Subtle borders and separators                  | `border-hair`   |
| `--chip`   | Input wells, chips, and highlighted rows       | `bg-chip`       |

### Summary strips

Strips use a dark gradient with their own foreground colors. Use the strip
foregrounds on that surface rather than assuming the regular card text works.

| Token                        | Role                                                                 | Example usage                                                 |
| ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `--strip-from`, `--strip-to` | Gradient endpoints                                                   | `linear-gradient(178deg, var(--strip-from), var(--strip-to))` |
| `--strip-cell`               | Individual strip cell background                                     | `bg-strip-cell`                                               |
| `--on-strip`                 | Primary strip text                                                   | `text-on-strip`                                               |
| `--on-strip-muted`           | Supporting strip text                                                | `text-on-strip-muted`                                         |
| `--strip-key`                | Strip headings and labels                                            | `text-strip-key`                                              |
| `--delta`                    | Movement or deviation worth noticing                                 | `text-delta`                                                  |
| `--color-strip-favorable`    | Favorable summary result; currently fixed at `#a3e6c5` across themes | `text-strip-favorable`                                        |
| `--color-strip-unfavorable`  | Unfavorable summary result; aliases `--delta`                        | `text-strip-unfavorable`                                      |

The two result colors are declared directly in `@theme inline`; there are no
`--strip-favorable` or `--strip-unfavorable` properties in the theme blocks.
`StripShell` maps its `delta` note tone to `text-strip-unfavorable` as well.

### Categories, money direction, and destructive actions

These roles carry different meanings even when some hues look similar.

| Token                       | Meaning                                                        | Example utility                    |
| --------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| `--rim-1` through `--rim-8` | Category identity                                              | `bg-rim-1`                         |
| `--flow-out`                | Money spent by the household                                   | `bg-flow-out`, `text-flow-out`     |
| `--flow-in`                 | Money received by the household                                | `bg-flow-in`, `text-flow-in`       |
| `--flow-moved`              | Money moved between the household's own sources                | `bg-flow-moved`, `text-flow-moved` |
| `--danger`                  | Destructive action color; also used by existing error feedback | `text-danger`                      |
| `--danger-bg`               | Background for destructive/error feedback                      | `bg-danger-bg`                     |
| `--danger-line`             | Border for destructive/error feedback                          | `border-danger-line`               |

A category rim answers **which category**; a flow color answers **which way the
money went**. The calendar can show both channels together. Do not substitute
`--danger` for an expense flow or use it as a category rim. Spending is a money
direction, not inherently a destructive action.

Category assignment is centralized in [src/theme/rims.ts](../src/theme/rims.ts):
`rimFor(order)` wraps a stable category order across eight slots, and `RIM_CLASS`
maps those slots to background classes. Use the stable order rather than a
category's current position in a filtered array. Colors repeat after eight
slots, so the category name must remain visible.

### Actions, charts, and elevation

| Token          | Role                                                     | Example usage                  |
| -------------- | -------------------------------------------------------- | ------------------------------ |
| `--accent`     | Primary actions, selection, and the global focus outline | `bg-accent`, `text-accent`     |
| `--accent-ink` | Foreground on an accent-filled control                   | `text-accent-ink`              |
| `--bar`        | Ordinary or historical chart bars                        | `bg-bar`                       |
| `--bar-now`    | Current chart bar                                        | `bg-bar-now`                   |
| `--track`      | Chart track or empty indicator                           | `bg-track`                     |
| `--shadow-rgb` | Space-separated RGB channels for theme-tinted shadows    | `rgb(var(--shadow-rgb) / 0.1)` |

`--bar-now` is a separate role from `--accent`: Tegel Kunci gives them different
values. Preserve that distinction when editing a theme.

The shared elevation utilities consume `--shadow-rgb`: `plate-shadow` lifts
plates, `lift-shadow` gives stronger elevation, `well-shadow` creates inset
wells, and `strip-shadow` lifts summary strips. White inset highlights are
defined centrally in those utilities. `--shadow-rgb`, `--strip-from`, and
`--strip-to` do not have `--color-*` aliases in the stylesheet.

## Themes and runtime selection

| Theme ID | Display name | Selector                           |
| -------- | ------------ | ---------------------------------- |
| `mawar`  | Mawar        | `:root` and `[data-theme='mawar']` |
| `kobalt` | Kobalt       | `[data-theme='kobalt']`            |
| `tegel`  | Tegel Kunci  | `[data-theme='tegel']`             |

Mawar provides the root defaults. The registry and runtime helpers live in
[src/theme/themes.ts](../src/theme/themes.ts). `applyTheme()` sets `data-theme`
on the document root and saves the selection under `nostos.theme` in local
storage. `readStoredTheme()` falls back to Mawar for missing or invalid values
and storage errors. A storage write failure still allows the theme to apply
for the current session.

To add a theme:

1. Add a `[data-theme='new-id']` block to `globals.css`, defining every property
   present in the existing theme blocks, including all eight rims and three flows.
2. Add its ID and label to `THEMES` in `src/theme/themes.ts`.
3. Check representative cards, strips, controls, charts, category markers, and
   calendar flows in the new theme. Components should require no color changes.

If a new token is needed, define it in all themes and add its `--color-*` alias
when components need a utility class. A missing property can silently inherit
Mawar's root value, so an incomplete theme may appear to work.

## Accessibility requirements

The stylesheet's contract sets these requirements for every theme:

- Each flow color must reach **3:1 against `--card`**, and all three directions
  must remain distinguishable from each other.
- Category rim colors must reach **3:1 against `--card`** and remain mutually
  distinguishable. Apply this requirement to all eight implemented slots.
- `--ink` on `--card` must reach **4.5:1**.
- `--on-strip` on the strip background must reach **4.5:1**; check both gradient
  endpoints and the background behind the actual text.
- Color must never carry meaning alone. Category rims and deviation markers
  need accompanying text; flow labels and symbols must explain direction.

These are requirements recorded by the source, not a statement that every
current pairing has been verified. Check actual foreground/background pairs,
including opacity, when changing tokens. The 3:1 graphical-marker requirement
does not establish sufficient contrast for small text using the same token.

## Current implementation notes

- The opening CSS comment still says “four” rims; the theme blocks, utility
  aliases, and category helper define **eight**.
- All themes currently use `#dc2626` for outgoing flows and `#16a34a` for incoming
  flows. Older alternatives remain in CSS comments and are inactive.
- The no-hardcoded-colors rule describes the intended contract. Existing
  components include exceptions, such as literal black in signin scene styles
  and white opacity utilities in `StripShell`. Their presence is not a reason
  to introduce more component-owned colors.

This document records the existing implementation; it does not change the
stylesheet or resolve those discrepancies.
