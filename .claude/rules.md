# Rules

## Writing

- Be brief. Lead with the answer. No preamble, no recap of what you just did.
- Comment only what the code cannot say: a constraint, a gotcha, why not the
  obvious thing. One or two lines. Never restate the line below it.
- No essays in comments, no history of what the code used to be. If it needs a
  paragraph, it belongs in `docs/` or `notes/`.
- Commit messages: subject, then a few lines of what and why. Not a report.
- Prefer deleting a comment to padding it.

## Code

- Match the surrounding style.
- TDD: failing test first.
- `npm run test`, `npm run lint`, `npm run type-check` before claiming done.
