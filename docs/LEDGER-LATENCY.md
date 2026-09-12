# Ledger latency — what a slow API does to the two ledger pages

Raised 2026-09-11. A survey and a ranked plan, parked for a decision later.
**Item 5 is built** (asked for directly, out of order); everything else is still a
proposal.

Scope: `/expenses` and `/income` against a slow or unresponsive API.
`PRODUCT.md` owns product truth; `docs/FRONTEND.md` owns what the repo does today. Where
this disagrees with shipped code, the code is right and this is stale.

The question that started it: _we ask for 400 rows a month and 500 for baselines — what
happens when the server is slow?_

---

## 1. The limits are not the problem

`limit=400` on both ledgers is a **ceiling, not a payload**. It says "do not paginate this
month". A household of 2–6 people records roughly 30–150 expenses a month, so the response
is that many rows. Lowering the limit would not make a slow server faster — it would mean
more round trips for the same month, which is worse, and it would break the continuous
tape the surface is built on.

The one genuinely fat request is **`useItemBaselines`**: `limit=500` over a trailing 120
days (`src/modules/financial/hooks/useItemBaselines.ts`). Four months of rows, the largest
payload on the page, and it exists to power decoration — the `2.3× higher` marker on a row
and the sparkline inside an opened one. It blocks nothing and competes with the request
that does.

That call disappears entirely when BE ships `summary.baselines`
(`notes/FE-App/API-CHANGES-REFACTOR-EXPENSE-INCOME-2026-09-10.md` §2a). Any work here
should assume it is temporary.

**Already right, and not to be undone:** `staleTime` 5 min and `gcTime` 10 min
(`src/api/queryClient.ts`), so revisiting a month is instant; retry capped at 2 and only
on 5xx or no-response; every query on the page fires in parallel; and the round trips per
visit are already down from five to three (expenses 2, income 1).

## 2. What actually hurts

### 2.1 Every month step blanks the screen

There is no `placeholderData` anywhere in `src/`. Stepping September → August discards the
rendered tape and replaces it with the loader (`ExpensesPage.tsx`, `IncomePage.tsx`). On a
slow server that is a spinner for the whole wait, with a month stepper that appears to
have eaten the ledger.

Nothing shipped so far shortens that wait, and the loader cannot: an indicator still says
"gone, something is coming", where `keepPreviousData` says "here is August until September
arrives". For a month step — where the reader already had real rows on screen — the second
is the honest one, and it is still the biggest win available here.

This is the thing a user would describe as "it takes so long". It is a rendering decision,
not a bandwidth one, and it would still read as slow on a fast server with a bad
connection.

### 2.2 No request timeout

`apiClient` is created with `baseURL` and `withCredentials` and nothing else
(`src/api/client.ts`). A hung request hangs forever: no timeout, no abort, and no point at
which the page admits it is not coming. The retry policy never engages, because a request
that never settles never fails.

### 2.3 A partial month is silent — and this one is a correctness bug

If a month ever exceeds 400 rows the tape renders 400 of them and says nothing. The count
strip reads `summary.current`, which is filter-scoped and therefore correct at 520 — so
the header states one total and the rows beneath it add to a different one.

Rare at household scale. Silent when it happens. Worse than a slow page, and unrelated to
latency except that a big month is also a slow one. **Fix this regardless of what is
decided about the rest.**

### 2.4 One deliberate waterfall

`CountStrip` and `InflowStrip` take a `listLoaded` prop and only fire their
previous-period fallback once the list has answered. That is serial by design: "no
summary" and "the response has not arrived" are indistinguishable on first render, so
without it the request being retired went out on every page load anyway.

On the current backend `summary.previous` is always present, so the fallback never fires
and the waterfall never happens. It costs one extra round trip only against a deployment
that sends no summary at all.

## 3. Plan, ranked

| #   | Change                                                                                             | Cost     | Notes                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `placeholderData: keepPreviousData` on both ledger queries                                         | ~5 lines | Old month stays on screen, dimmed, while the new one loads. Largest perceived win.                                                                                                                                                                                                                                                                                                |
| 2   | `timeout` on the axios client, plus a "still loading" line after ~8s                               | small    | Turns a hang into a failure the retry policy and the error state can act on.                                                                                                                                                                                                                                                                                                      |
| 3   | Long `staleTime` on the baselines query; let it settle after the tape paints rather than racing it | small    | Temporary — removed by `summary.baselines`.                                                                                                                                                                                                                                                                                                                                       |
| 4   | State it when `pagination.total > items.length` instead of showing a partial month                 | small    | §2.3. Do this whatever else is decided.                                                                                                                                                                                                                                                                                                                                           |
| 5   | ~~Skeleton rows instead of a text line on first load~~                                             | —        | **Built then reverted 2026-09-11** — skeletons were not wanted. `src/components/Loading.tsx` is now the app's only loading surface: one accent arc plus a label, on every lazy route, the session probe, both ledgers, the position card and every settings section. The one keeper from that pass is the strip no longer printing `IDR 0` while waiting — it shows a quiet dash. |
| 6   | Real pagination or infinite scroll on the tape                                                     | large    | Only with evidence a household reaches it.                                                                                                                                                                                                                                                                                                                                        |

**Recommended first step: 1, 2 and 4.** (5 is done, ahead of this order — it
was asked for directly.) Together they cover the reported case — the page
stays useful while a slow server thinks, a dead request eventually admits it, and a
truncated month stops lying. 3 is worth doing only if `summary.baselines` is far off.

## 4. What not to do

- **Do not lower the page size.** More round trips for the same month is slower, not
  faster, and it breaks the continuous tape.
- **Do not add a spinner per section.** Four independent spinners on one screen read as
  four things going wrong.
- **Do not show a loader for a figure that may never arrive.** `PositionCard` already
  holds this line: no figure, nothing pretending one is coming, and no zero. A degraded
  band says what is known.
- **Do not reintroduce skeletons.** Tried 2026-09-11 and rejected — they have to be drawn
  per surface to be worth anything, which is four of them for this product.
- **Do not retry a 4xx.** Already the policy; noted so it is not "improved" later.

## 5. Open question

**There are no latency numbers.** Everything above is reasoned from the code, not
measured. A p95 from the deployed API decides whether items 5 and 6 are real work or
paranoia, and whether item 2's timeout should be 10s or 30s.

Until that exists, items 1, 2 and 4 are safe on their own terms: each is correct on a fast
server too.
