# Surface brief — Income

Confirmed 2026-09-08. Source PRD: `notes/MASTER_PRD_INCOME.md` v1.0.
Route: `/financial/income`. Mode: **Operate**. Visual world: inherited unchanged.

This document owns the income surface's structure and its rules. `PRODUCT.md` owns product
truth; `src/styles/globals.css` owns the visual system. Where this disagrees with shipped
code, the code is the bug.

---

## 1. Job and audience

A member opens Income to answer two questions that never had one home:

- **What did we take in this month?**
- **How much do we actually have, per source, right now?**

The admin arrives at a laptop to review and correct. The member arrives on a phone right
after a paycheck lands or after withdrawing cash at an ATM. Both questions are weighted
equally — neither is a footnote to the other.

**Transfers dominate the data.** Most entries move money the household already had. A design
that renders a withdrawal like a salary is not a cosmetic failure, it is a wrong number.

## 2. Outcome and proof

Success is a member reading their real position across every source without reconstruction,
and never mistaking money that merely moved for money that arrived. The proof is the ledger
itself. No invented households, no targets shown as results.

## 3. Structure

Top to bottom, one column:

1. **Month strip** — four cells, month stepper. `InflowStrip`.
2. **Position card** — stated, not a filter. Grouped `kind → source` with kind subtotals,
   its own date stamp. `PositionCard`.
3. **Action row** — scope line plus _Record income_.
4. **Day-to-day statement** — all sources, date order, newest first, on **day shelves**:
   a sticky header naming weekday, day and month, a hairline rule, and the day's figures on
   the right. Identical to the expense tape's device. `IncomeStatement` / `IncomePlate`.

Items 1–3 are pinned; only the statement scrolls. The two questions this page answers are
co-equal, and a position you have to scroll back up to find is not — and it is what the
sticky day shelves stick beneath.

**Reversed on 2026-09-08 — day shelves, not a day column.** This document originally
specified "no day shelves as containers: a four-entry month cannot pay for four shelf
headers", and the first build put the day in a column inside each row, printed once per day
and blank on repeats. Built, it read as `4 FRI` with no month, gave the eye nothing to anchor
on, and left the second entry of a day against an empty cell that looked like a rendering bug
rather than a continuation. The saving was also imaginary: the page ends at 40% of the
viewport. Two ledgers in one product group time the same way. The argument was wrong; the
shelves are the expense tape's.

Deliberately **not** built:

- No per-source selection. The position card states; it does not filter.
- No opening/closing double band. One position card, one date stamp.
- No filters, search or sort. Month is the only scope.
- No month rail. Eight rows need no jump index; the expense tape's 200 do.

**Focal moment:** the kind subtotals. `Bank · 3 → Rp 13.080.000` is the figure no
spreadsheet was giving them.

## 4. The strip's four cells

| Cell                  | Value                                            | Note                            | Clock      |
| --------------------- | ------------------------------------------------ | ------------------------------- | ---------- |
| Opened `<month>` at   | sum of `opening_balance` over the positions rows | carried from `<prev month>`     | cumulative |
| Income in             | `meta.totals.sum` from the income list           | _N_ entries from outside        | month      |
| Moved between sources | derived, guarded (§6)                            | _N_ transfers · total unchanged | month      |
| vs `<prev month>`     | percentage, or `—`                               | `<prev month>`: `Rp …`          | month      |

Cell 1 is a **stock** and carries its date, so it cannot be read as a flow. Cells 2–4 are
month-scoped.

**The fresh-month rule.** A month-over-month delta on day one is arithmetically true and
practically a lie. When this month's inflow is zero, cell 4 shows `—` and its note states the
previous month's final figure (_"September closed at Rp 10.400.000"_) rather than `▼ 100%`.

**Never show net inflow and real income as two cells.** `totals.sum` is `sum(to) − sum(from)`,
so a transfer cancels and only external money survives. They are the same number.

## 4a. The day shelf carries two figures, never one

An expense day has one honest subtotal. An income day does not: a day holding a salary and a
cash withdrawal has no single true figure — adding them reports money the household never
gained, and dropping either loses half the day. So the shelf splits them, the same split the
strip makes at month scale:

| Day            | Shelf reads                                                                             |
| -------------- | --------------------------------------------------------------------------------------- |
| Arrival only   | `+IDR 8,600,000 · 1 entry` — the `+` says which it is, so the word would be noise       |
| Transfers only | `IDR 300,000 moved · 1 entry` — **named**, because a bare amount would read as earnings |
| Mixed          | `+IDR 8,600,000 in · IDR 1,200,000 moved · 2 entries`                                   |

Only the arrival is emphasised (`--rim-1`); a day's transfers are context, not a result.
`DayIncomeGroup` therefore carries `inflow` and `moved`, never a gross `total`.

## 5. The signing rule

| Entry           | `fromSourceId` | Amount                    | Tone      |
| --------------- | -------------- | ------------------------- | --------- |
| External inflow | `null`         | `+Rp 5.000.000`           | `--rim-1` |
| Transfer        | set            | `Rp 400.000`, **no sign** | `--muted` |

A transfer moved money; it did not make any, and there is no single source whose view would
give it a sign. Meaning lives in the route pill — solid `BNI → Cash` versus dashed
`External → BNI` — never in a bare amount. The row disclosure spells out both sides in words
and says _"Household total unchanged — a transfer, not income."_

## 6. Client-derived figures are guarded

`meta.totals` gives `sum`, `count`, `average` and nothing else. "Moved between sources",
"entries from outside" and the transfer count are summed from the rows the page is holding.
That is honest **only while it holds all of them**, so each is guarded against
`pagination.total` and renders `—` rather than a partial sum. Same constraint the expenses
page's top-slice already lives under.

## 7. Position is a backend dependency

Position is not computable in the browser: it needs every income and expense the household
ever recorded, across all months.

```
GET /api/v1/households/:id/positions?as_of=YYYY-MM-DD&from=YYYY-MM-DD

data: [{ source_id, opening_balance, balance }]
```

- `opening_balance` — what the source held at the close of `from − 1 day`, which is what
  makes "opened September at" and "closed August at" one number rather than two a day apart.
- `balance` — what it holds at `as_of`.
- Period movement is `balance − opening_balance`, derived client-side.
- Kind, name and `order` (the rim) come from `/payment-sources`, already cached. The response
  carries only figures, so the endpoint stays small.
- Archived sources still holding money **are** returned; they are history with a balance, and
  dropping them would make the household total disagree with its own parts.
- **A complete collection, not a page** — one row per source, shaped like `/payment-sources`.
  That is the one reason its totals and kind subtotals may be summed client-side: the client
  provably holds every row. §6's guard exists because no paginated aggregate has that
  property.
- Balances are **not** clamped at zero. A source can genuinely be short.

The full inventory of what the BE already serves and what it owes is in
`docs/API-CONTRACT-INCOME.md`, derived from the Postman collection and the live probes.

**Until it is live**, `PositionCard` renders a stated degraded band: no number, a plain
sentence, and the statement below still complete and correct. Never a guessed balance, never
a zero standing in for an unknown.

## 8. States

- **Volume:** 4–12 entries typical, 30 maximum. 6–10 sources across 3 kinds.
- **Empty month:** month-scoped copy — _"Nothing recorded in October yet"_, never _"no income
  recorded"_ — and it points backward (_← September had 8 entries_), because on 1 October
  that is the useful next click. The position card stays fully populated.
- **Zero balance:** muted, with the reason (_"emptied on 1 Sep"_).
- **Negative balance:** `--danger` **plus** the word _overspent_. Legal per the PRD, so it
  must not read as a bug — and colour never carries it alone.
- Loading, read error with retry, write error inline, admin-only actions hidden for members,
  optimistic row with no admin actions until the server acknowledges it.

## 9. Resolved PRD questions

| #                              | Decision                                                                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ledger layout (§14)            | Position card + day-to-day statement. Not a per-source register, not a two-band statement.                                                                                                                                                                                              |
| Income type presets (AC1.5)    | **No 5-minute timer.** Presets appear whenever the household has zero income types, and stop appearing once it has one. A client-side timer means `localStorage`, which is per-device: the second admin would see presets again and an interrupted first admin would lose them forever. |
| Blocked form (AC1.5 vs AC1.13) | **AC1.13's shape for both.** Missing income types and missing payment sources behave identically: the form renders, submit is disabled, and the fix is named with a link to Settings. Never a form that cannot be used and does not say why.                                            |
| `from == to`                   | Rejected client-side and by the mock — _"Cannot transfer to the same source."_ The PRD's own review flags this; no AC covered it.                                                                                                                                                       |
| Delete confirmation            | Names the entry — `Delete "Salary Sep"?` — matching the expense dialog.                                                                                                                                                                                                                 |
| Type display                   | Rendered exactly as the household typed it. No auto-capitalisation: it is their word, and Bahasa Indonesia does not capitalise the way the placeholder list implies.                                                                                                                    |
| Dashboard card                 | Still deferred.                                                                                                                                                                                                                                                                         |

## 10. Constraints

React 19 · TS strict · Tailwind v4 · react-hook-form · TanStack Query owns server data, the
URL owns the month, Context owns session, `useState` owns local UI · no global store · every
request carries `X-Household-ID` before any descendant effect fires · full EN/ID through
paraglide with no hardcoded strings · WCAG 2.1 AA, focus trap on the delete dialog and focus
restored to its trigger · Capacitor: native date input, finger-sized targets, safe areas ·
soft chrome, crisp data — the position card and strip are soft containers, the statement rows
are crisp data.

Inherited undecided (from `PRODUCT.md`): whether create is a modal or an inline panel. The
income page follows whatever expenses does; it currently ships the inline panel.

## 11. Reference comps

`.impeccable/mocks/income/` — mid-month and start-of-month, desktop and mobile, built on the
real token contract. They are the approved reference for spacing, metrics and copy tone.
