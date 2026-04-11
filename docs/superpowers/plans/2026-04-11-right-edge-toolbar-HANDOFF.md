# Handoff: Execute Right-Edge Toolbar Plan (Subagent-Driven)

You are picking up a fully-scoped implementation plan. A prior session did the research, resolved ambiguities with the user, and wrote the plan. Your job is to execute it task-by-task using the subagent-driven-development workflow.

## What to read first (in this order)

1. **Invoke the skill:** `superpowers:subagent-driven-development` via the Skill tool. Follow it exactly. This is the workflow.
2. **Read the plan:** `docs/superpowers/plans/2026-04-11-right-edge-toolbar.md`. Read it top-to-bottom once before dispatching any subagent, so you understand cross-task dependencies (especially name consistency: `#toolbar`, `#toolbar-plane-slot`, `.plane-btn`, `.swatch-btn`, `data-theme-id`, `window.setTheme`, `window.Toolbar.syncActive`).
3. **Project conventions:** `CLAUDE.md` at repo root. Two rules matter most for this work:
   - Never hardcode colour values in element CSS — use `var(--...)`. The plan already handles this via `--theme-*-accent` constants (Task 2).
   - Be surgical with file reads — always use `offset`+`limit`, never read whole files. Pass this instruction to every subagent you dispatch.

## Ground truth

- All six ambiguities flagged in the original plan draft have been **resolved** by the user. The plan's "Resolved Decisions" section (top of the file) is authoritative — do not re-ask the user about them. In particular:
  - Swatch dots use `--theme-*-accent` constants in `:root` (not hex in element styles).
  - Plane icon is paper-plane SVG only. No stop-square swap. Active state is pure CSS recolour via `.plane-btn.active { color: var(--accent); ... }` + SVG `currentColor`.
  - Retro `var(--pop)` override applies to the live toolbar chrome only; the hover preview panel still shows each target theme's identity colours via the PREVIEW object in toolbar.js.
  - Mobile: shrink only at ≤768px. No hide-on-drag.
  - Delete `toolbar-variation-d.html` in the final task.
  - `lost-satellite copy for games.html` is in a backup folder, out of scope.

## Execution rules

- **One subagent per task.** 12 tasks in the plan. Dispatch each as a fresh subagent via the Agent tool with the `general-purpose` subagent type (or whichever subagent-driven-development recommends). The subagent should implement that one task's steps and commit.
- **Two-stage review between tasks.** After each subagent finishes:
  1. Read the diff yourself (`git diff HEAD~1`) and verify it matches the plan's intent.
  2. Dispatch a fresh `superpowers:code-reviewer` subagent to audit the task against the plan section. Only proceed to the next task if both pass.
- **Line numbers drift.** `css/shared.css` is ~2576 lines and will shrink significantly during Task 9. Any task after Task 3 must re-grep for line numbers before editing. Tell each subagent: "Line numbers in the plan are snapshots from when it was written — re-grep before deleting or inserting."
- **Do NOT batch tasks.** The plan is designed for isolated, sequential, reviewable commits. Resist the urge to combine Tasks 3+4, or 9+10, etc.
- **Verification task (Task 11) is manual + Playwright.** You can dispatch a subagent to run the Playwright commands, but you personally need to look at screenshots and confirm visual correctness across all five themes. Do not claim success without seeing the images.
- **Don't touch out-of-scope systems:** card-hand attractor (separate from the retired plane attractor), the plane overlay's Three.js rendering, destruction.js internals, text-rearrange. The plan only touches specific lines — respect the scope.

## Subagent prompt template

When dispatching each task, use a briefing like:

> You are implementing Task N of the right-edge toolbar plan at `docs/superpowers/plans/2026-04-11-right-edge-toolbar.md`. Read only that task's section (use offset+limit — do not read the whole file). Also read `CLAUDE.md` for the "no hardcoded colours" and "surgical file reads" rules.
>
> Implementation requirements:
> - Follow every step in the task in order. Do not skip steps or batch them.
> - Line numbers in the plan may have drifted — re-grep before deleting/inserting into `css/shared.css`.
> - Use Read with offset+limit for every file access. Never read a full file.
> - Commit when the task says to commit. Use the exact commit message from the plan.
> - If a step's expected result doesn't match (e.g. grep returns zero matches when the plan expected some), STOP and report back instead of improvising.
>
> When done, report: (1) what you changed, (2) what you committed, (3) any deviations from the plan and why. Under 200 words.

## Order of operations

1. Task 1 — pre-flight grep sweep (no commits, produces an audit note)
2. Task 2 — `--theme-*-accent` constants → commit
3. Task 3 — `.toolbar` base CSS → commit
4. Task 4 — per-theme overrides → commit
5. Task 5 — `js/toolbar.js` (new file) → commit
6. Task 6 — `js/shared.js` refactor → commit
7. Task 7 — `js/plane.js` rework (drop attractor, new icon, adopt into slot) → commit
8. Task 8 — analytics/destruction/page-transition selector updates → commit
9. Task 9 — delete obsolete CSS (reverse line order, re-grep between deletions) → commit
10. Task 10 — HTML changes across 4 live pages + script tag → commit
11. Task 11 — Playwright verification across all 5 themes + mobile + a11y + cross-page → fix-up commit if needed
12. Task 12 — delete prototype + update CLAUDE.md docs → commit

**Reviewable checkpoint moments:** After Tasks 5 (new JS), 7 (plane rework), 9 (big CSS deletion), and 11 (verification) — pause and let the user eyeball things before continuing. Everything else can flow through subagent+reviewer without interruption.

## If something goes wrong

- **Grep mismatch:** A task expects to find `.theme-switcher` at a line that no longer contains it. STOP. Re-grep with fresh line numbers and update the plan's line references, then resume.
- **Subagent exceeds scope:** Reject its work, reset to `HEAD~1`, and dispatch again with a stricter prompt.
- **A visual in Task 11 looks wrong in one theme:** Do not patch blindly. Identify which per-theme override (Task 4) is wrong and fix it there, so the fix lives in the right section.
- **The user's earlier instructions conflict with the plan:** The user's explicit instructions always win. Pause and ask.

## Known risks

- Task 9 (CSS deletion) is the highest-risk task because line numbers shift after every deletion. The plan tells you to delete in reverse line order and re-grep between each — follow that discipline.
- `js/plane.js` has attractor state scattered across several functions (constructor vars, `createToggleButton`, `toggle()`, possibly `pointerenter` handlers). Task 7 lists them, but grep for `attractor` and `plane-attractor-seen` one more time at the end of the task to make sure nothing lingers.
- `page-transition.js` has both a `removeSelectors` list AND an `infraIds` list AND a button-skip check — all three must be updated (Task 8). Missing one will break the SPA navigation when leaving a project page.

## Success criteria

- All five themes show a visually distinct, pinned right-edge toolbar with five swatches + plane button
- Clicking a swatch switches themes directly (not cycled)
- Hover preview appears on desktop, not on mobile/touch
- Plane button still toggles the plane overlay; active state is theme-coloured
- Mobile ≤768px: toolbar shrinks, does not visibly collide with card hand
- `role="toolbar"`, `aria-label`s on each swatch and the plane button, `aria-pressed` on plane button
- Zero console errors on all four live pages
- Cross-page SPA navigation still works (card drag from index → project page, theme still switchable there)
- Zero remaining references to `.theme-switcher` / `.plane-toggle` / `themeSwitcher` / `plane-attractor-seen` in `css/`, `js/`, and live HTML (tests and `backup/` are out of scope)

Good luck. Read the plan first, then invoke `superpowers:subagent-driven-development`, then dispatch Task 1.
