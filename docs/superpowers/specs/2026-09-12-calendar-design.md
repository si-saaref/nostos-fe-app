# Calendar — design

Status: approved 2026-09-12. Shaped with `/impeccable shape`; composition
"Strip, Grid, Sheet" locked by the user from three dealt structures.

## The question this surface answers

`/expenses` answers _what did we spend_. `/income` answers _what arrived, and
what only moved_. Neither answers **what did this month look like** — where the
weight fell, which days were quiet, whether income landed before or after the
spending it had to cover.

The calendar answers that and nothing else. It is a reading surface: no create,
no edit, no delete, no filters.

## Audience and mode

Operate. The admin mid-review on a laptop is the primary reader; a member sees
exactly the same page, because the permission matrix only restricts writes and
there are no writes here.

## Scope

Expenses and income. Savings is not built, and the legend names two streams
rather than promising a third.

### Anti-goals

- No create, edit or delete. Phase 2 may make an entry clickable through to its
  ledger; this phase does not.
- No filters, no search, no sort.
- **No position card.** Position is cumulative to a date; this page is
  month-scoped. Keeping the two clocks apart is the whole design of
  `/income`, and importing half of it here would undo that.
- No per-day running balance — it needs an endpoint that does not exist, and
  even `GET /positions` answers a different question.
- No category breakdown chart. The day sheet lists the rows themselves.

## Data

No new API. Two existing endpoints, one request each per month:

```
GET /expenses?date_from=<first>&date_to=<last>&limit=500&page=1
GET /income  ?date_from=<first>&date_to=<last>&limit=500&page=1
```

Both accept inclusive `date_from` / `date_to` with a `limit` ceiling of 500
(`docs/API-SPEC-EXPENSE.md` §3.4–3.5, `docs/API-SPEC-INCOME.md`). That ceiling
exists because the expenses tape already decided on one request per month; the
calendar inherits the decision rather than reopening it.

| Figure                   | Source                                                   |
| ------------------------ | -------------------------------------------------------- |
| Day marks, transfer flag | the rows, grouped by `datePaid` / `date`                 |
| Strip — Out              | expenses `totals.sum`                                    |
| Strip — In               | income `totals.sum`, already net (`sum(to) − sum(from)`) |
| Strip — Moved            | income `totals.moved`, via `incomeMonthFigures`          |
| Strip — Entries          | `pagination.total` on each response                      |
| Day sheet rows           | the same rows; no detail fetch                           |

**Completeness is a hard gate.** If either response reports
`items.length < pagination.total`, the month is not drawn at all. A grid missing
days is a false statement about the household's month, and PRODUCT.md already
forbids the partial-sum version of this. `incomeMonthFigures` implements the
same guard and is reused rather than re-derived.

## Composition

Pinned strip → month grid → day sheet. The strip states, the grid shapes, the
sheet details. On `lg` and up the sheet sits beside the grid and never covers
it, so the month stays in view while a day is read; below `lg` it stacks under
the grid.

### Strip

`StripShell`, four cells, the shipped `MonthStepper` beside the title with
forward blocked past the current month.

**Out · In · Moved · Entries.**

`Moved` earns a cell rather than a note: a transfer is not income, and the
income surface's central rule should not weaken on a page that shows both
streams at once. `Net` was rejected — a flow total sitting where a reader
expects a balance is exactly the confusion PRODUCT.md warns against.
`Busiest day` was rejected — the grid already shows it.

### Grid

Seven columns at every width, Monday-start. Each day cell carries:

- the date;
- an **out** mark and an **in** mark, bottom-aligned, side by side;
- a third, muted **moved** mark when the day holds a transfer.

The moved mark is a bar, not a corner glyph: a glyph is legible at 1440 and
invisible at 375.

**Scale: each stream against its own busiest day of the month.** One shared
scale is wrong, and the preview proved it — a Rp 8.500.000 salary draws at full
height and flattens every grocery run in the month to a stub, so the month
reads as one spike and thirty nothings. Day-to-day comparison within a stream
is the comparison a reader actually makes; out-versus-in at month scale is what
the strip is for. The legend states the rule, because an unstated scale is an
unreadable chart.

Three day states that must stay distinguishable:

| State                              | Drawn as                                 |
| ---------------------------------- | ---------------------------------------- |
| Had activity                       | marks, on the raised cell                |
| Quiet — happened, nothing recorded | cell drawn, no marks, labelled           |
| Not yet arrived                    | outlined, unfilled, never as a quiet day |

Colour never carries meaning alone: mark position is fixed, the legend names
each stream in words, and every cell's accessible name spells its figures out
in full.

### Day sheet

Opens on today when the viewed month contains it, otherwise on nothing with a
quiet prompt. Header, three figures (Out / In / Moved), then the day's entries:
expenses with category, source and payer; income with its type and its route.

A transfer renders **unsigned and muted with both source pills and an arrow**,
exactly as `IncomePlate` does. A `+` in front of a withdrawal is a wrong
number, not a styling choice.

Footer states plainly that this is a reading surface and where changes are made.

## States

- **Loading** — grid scaffold drawn, marks absent, figures as `—`. Never
  `IDR 0` before a response lands. One loading indicator app-wide: the rotating
  arc from `globals.css`, no second shimmer.
- **Empty month** — the grid renders quiet with one sentence. A month with
  nothing in it is an answer, not a failure.
- **Incomplete** — the over-500 band described above.
- **Error** — one band naming the problem and offering retry.

## Interaction

- Month and day both live in the URL: `?month=YYYY-MM&day=YYYY-MM-DD`, so a day
  is a real link someone can hold, matching the ledgers' URL-backed filters.
- The grid is a keyboard grid: `role="grid"`, roving tabindex, arrows walk days,
  Enter and Space open one.
- Cells are 44px minimum at phone width.

## Constraints

- WCAG 2.1 AA. Both mark colours clear 3:1 on `--card`.
- Every string through paraglide, prefix `cal_`, EN and ID both written.
- No colour named in a component; `--rim-*` via `rimFor(order)`.
- TanStack Query owns the fetches, the URL owns month and day, `useState` owns
  the nothing that is left. No store.
- Reuses `StripShell`, `MonthStepper`, `incomeMonthFigures`, `rimFor`,
  `sumMoney`, `formatCurrency`, `monthRange`, `isoDay`, `fromIsoDay`.

## Files

| Path                                                 | Role                                         |
| ---------------------------------------------------- | -------------------------------------------- |
| `src/modules/financial/lib/calendarMonth.ts`         | pure: rows → day cells, scales, completeness |
| `src/modules/financial/hooks/useCalendarMonth.ts`    | URL state + the two queries                  |
| `src/modules/financial/components/MonthGrid.tsx`     | the grid and its cells                       |
| `src/modules/financial/components/DaySheet.tsx`      | the opened day                               |
| `src/modules/financial/components/CalendarStrip.tsx` | the four month figures                       |
| `src/modules/financial/pages/CalendarPage.tsx`       | composition and states                       |
| `src/routes/index.tsx`                               | `/calendar`, lazy                            |
| `src/components/Layout/Sidebar.tsx`                  | nav entry after Income                       |
| `messages/{en,id}.json`                              | `cal_*`                                      |

## Open

- Whether Phase 2 makes a day-sheet entry a link into its ledger.
- Whether the reserved **Plan** nav slot eventually absorbs this. It ships as
  its own entry; Plan stays planned.
