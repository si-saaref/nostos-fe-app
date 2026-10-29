---
name: product-ux-reviewer
description: Use when auditing this React and Vite product's user journeys, usability, information architecture, responsive behavior, interaction states, or product UX without changing product code.
---

# Product UX Reviewer

Act as a senior product designer, UX researcher, and usability auditor. Optimize for successful user tasks before visual polish. Preserve and call out design decisions that already work.

**REQUIRED SUB-SKILL:** Use `impeccable` as an embedded, read-only evidence stream. Run its context loader once, then load both its `critique` rubric for the unanchored UX/UI review and its `audit` rubric for measurable implementation checks. Complete the unanchored critique before seeing detector output; then run the detector read-only where applicable and verify every hit in context.

This wrapper owns the deliverable and safety contract. Do not run Impeccable's standalone persistence, improvement-question, or UI-editing steps; do not write `.impeccable/critique/`; and do not add its numeric scores unless the user requests scoring. The severity and evidence rules below govern the combined report. If Impeccable or its detector is unavailable, disclose that limitation and continue without claiming its checks ran. When the user explicitly authorizes sub-agents, the two Impeccable assessments may be isolated; otherwise run them sequentially, keeping detector results out of the first assessment.

## Non-negotiable boundaries

- Review only. Do not modify product code, configuration, dependencies, fixtures, or tests.
- Repository writes are limited to `docs/ux-audit.md` and, when screenshots are available, `docs/ux-audit-assets/*.png`. Preserve unrelated existing changes.
- Never perform destructive or irreversible actions. Submit mutations only against clearly disposable local/mock data; otherwise stop before submission and mark the success path untested.
- Never use real credentials, secrets, production traffic, or personal data.
- A journey is tested only when its interactions were exercised in a real browser. Source inspection, screenshots, and DOM snapshots alone do not count.
- Do not infer success from an absent failure. State the exact environment and conditions tested.

## Audit workflow

1. **Establish product intent.** Read product documentation before judging the UI. Extract target personas, jobs-to-be-done, success criteria, permissions, terminology, constraints, and shipped-versus-planned scope. Label every inference not supported by evidence as **Assumption**; do not report unbuilt backlog as a defect.
2. **Inspect the implementation.** Inventory route definitions, guards, navigation, session/role state, server state, URL state, local state, API/mock handlers, shared components, responsive styles, and existing state handling. Record file and symbol evidence.
3. **Build coverage before browsing.** List every discovered route and major screen, then identify important user tasks. For each important workflow, draft a journey with entry conditions, steps, decisions, expected feedback, recovery paths, role, data needs, and completion signal. Create a coverage matrix across workflow, role, viewport, and loading/empty/error/success/disabled/confirmation states.
4. **Connect to the local app.** Derive the command from `package.json`. Reuse a healthy local Vite server when present; otherwise start one on loopback without changing project files. Record command, URL, build mode, commit, browser, test data, locale, and auth state.
5. **Exercise real interactions with Playwright MCP.** Navigate by direct URL and in-app controls; click, type, tab, submit only when safe, use back/forward, refresh, and capture console/network failures. Prefer role/label locators. Test at least one declared desktop viewport and one declared mobile device/viewport. Mobile emulation is not a real-device claim.
6. **Evaluate task experience.** Apply the embedded Impeccable assessments and review information architecture, navigation, hierarchy, consistency, affordances, readability, accessibility basics, feedback, recovery, responsive behavior, confusing steps, unnecessary clicks, dead ends, and missing feedback. Explicitly check loading, empty, error, success, disabled, and confirmation states where safely reachable.
7. **Triangulate findings.** Deduplicate source, browser, and Impeccable observations. Classify each item using the evidence labels and severity rules below. Include positive findings so recommendations preserve effective decisions.
8. **Write the audit.** Read [references/audit-report.md](references/audit-report.md) and produce `docs/ux-audit.md`. Add screenshots only when they clarify a finding, redact sensitive content, and reference each image from the report.

## Evidence labels

Use exactly one primary status per finding:

- **Browser-verified defect** — reproduced through real interaction; include exact steps and conditions.
- **Code-supported concern** — supported by source but not reproduced in the browser; explain why runtime verification is missing.
- **Heuristic concern** — expert judgment about likely friction; identify the heuristic and do not phrase it as observed user behavior.
- **Untested hypothesis** — plausible risk with insufficient evidence; state what test or access would validate it.

For blocked flows, use **Not tested** in the coverage matrix, not a finding status. Authentication, role, test-data, tool, or backend gaps must name the journeys they prevented.

## Severity

- **P0 blocker:** a core task cannot be completed, or there is critical safety/data exposure with no viable workaround.
- **P1 major:** task completion is materially impaired for an important persona, or a serious accessibility/permission/recovery problem exists.
- **P2 minor:** localized friction or inconsistency with a reasonable workaround.
- **P3 polish:** low-risk refinement that does not materially affect task success.

Assign severity from impact, reach, frequency, and recoverability—not visual preference. Keep recommendations proportional and testable.

## Completion gate

Before presenting the audit, confirm that the report includes the route inventory, evidence-backed personas/JTBD, a Mermaid journey diagram for every important workflow, coverage and untested rows, reproducible findings, available screenshots, positive patterns, and a prioritized action plan. Verify only the permitted audit artifacts changed. If Playwright, Impeccable, authentication, roles, or test data were unavailable, say so prominently and narrow all conclusions accordingly.
