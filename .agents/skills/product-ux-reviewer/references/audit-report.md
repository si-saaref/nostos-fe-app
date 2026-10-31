# UX audit report contract

Write `docs/ux-audit.md` as a decision-ready audit, not a generic checklist. Use the sections below, adapting labels without dropping required evidence.

## 1. Audit metadata and scope

- Date, commit, base URL, start command/build mode
- Browser/version, exact desktop viewport, exact mobile device/viewport, locale
- Roles, authentication, test data, backend/mock mode
- Tools available: Playwright MCP, Impeccable context/rubrics, and Impeccable detector
- Safety limits, exclusions, and blocked access

## 2. Executive summary

- Overall task-success assessment
- Finding counts by P0/P1/P2/P3 and evidence status
- Top three risks and top strengths
- Recommended order of work

Do not include a numeric UX score unless the user asks for one. If requested, disclose the Impeccable rubric, denominator, unavailable dimensions, and test conditions; never present a score as user-research evidence.

## 3. Product intent

For each persona, cite the supporting product document and list its jobs-to-be-done and success signals. Put unsupported inferences in a visibly separate **Assumptions** list.

## 4. Route and screen inventory

Use a table with:

`Route | Screen/purpose | Roles | Entry points | Key states | Source evidence | Browser status`

Browser status must distinguish visited, interacted, blocked, and not tested.

## 5. Journey maps

Include one Mermaid `flowchart` per important workflow. Each diagram must show the entry condition, meaningful user actions/decisions, system feedback, recovery or dead end, and completion signal. Follow each diagram with:

- Persona and job-to-be-done
- Preconditions and data/role required
- Browser coverage: complete, partial, blocked, or not tested
- Friction and effective design decisions observed

Never draw an idealized path as though it were the tested path. Mark inferred or untested branches in the diagram text.

## 6. Coverage matrix

Use a table with:

`Workflow | Role | State/data | Desktop | Mobile | Evidence/limitation`

Cover loading, empty, error, success, disabled, confirmation, and permission states where relevant. Use **Not tested** explicitly; never leave blank cells that could imply coverage.

## 7. Findings

Group by severity, then order by task impact. Every finding contains:

- Stable ID, concise title, severity, and evidence status
- Affected personas/roles and job-to-be-done
- Route, state, viewport/device, browser, and frequency when known
- Reproduction steps for browser-verified defects; otherwise source trail or heuristic/hypothesis basis
- Expected versus observed behavior
- User impact and why the severity is justified
- Evidence: screenshot path, console/network detail, and/or `file:line` or symbol
- Recommendation that preserves working design decisions
- Concrete retest/acceptance criteria

Do not use browser-defect language such as “users encounter” for heuristic or untested items.

## 8. Cross-cutting review

Summarize systemic patterns across information architecture, navigation, hierarchy, terminology, visual consistency, affordances, feedback/recovery, accessibility basics, responsive behavior, and state completeness. Separate strengths from risks.

## 9. Untested and blocked areas

List every important flow or state not verified and the exact blocker: missing authentication, role, safe data, backend behavior, Playwright MCP, Impeccable, or environment access. State what is needed to test it.

## 10. Prioritized action plan

Use a table:

`Order | Finding(s) | Outcome | Recommended change | Owner/dependency | Effort | Retest`

Place task blockers and systemic fixes before cosmetic work. Keep P3 polish separate so it cannot crowd out task success.

## Screenshots

Store only useful, redacted images under `docs/ux-audit-assets/`. Name them with the finding ID and a short slug, for example `P1-03-mobile-submit-feedback.png`. Add a caption explaining what the image proves; a screenshot is evidence only for visible state, not for an interaction that was not exercised.
