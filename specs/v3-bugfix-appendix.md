# es6tasks — Bug-Fix Appendix (v3 workstream)

## TL;DR

* Documents the two crash defects in the published 1.x: `Task.async` (unusable) and `Task.taskify` (ReferenceError), with their required v3 contracts.
* The reporting redesign is DECIDED and specced in `specs/v3-reporting.md`; these fixes ship WITH it as part of the single breaking `3.0.0` release (version-family alignment; 2.x is skipped), not as a separate patch.
* Defect 9 (undefined-return progress starvation) is MOOT under the observer model — structurally impossible; covered by a regression test in the reporting spec.
* The v3 release semantics that es6pacts composes onto Task live in the es6pledges specs (`../es6pledges/specs/v3-core.md` in this workspace); nothing in this repo implements release.

## Purpose

Record the defects in `src/es6tasks.js` that make documented entry points throw, and the contracts their v3 rebuilds must satisfy.

## Standards

* Code follows `~/.claude/coding_standards.md` and `~/.claude/SemanticHungarian.md`.
* Authoritative signatures for the rebuilds (including the removal of `aOpts`) are in `specs/v3-reporting.md`; this appendix defines the defect history and the behavioral contracts.

## Defect 7 — Task.async is unusable

Behavior in 1.x (verified): the wrapper does `p.__proto__ = Task.prototype` on a plain Promise, which fails the private-method brand check, so the first `then` / `await` throws `TypeError: Receiver must be an instance of class Task`. Its `.catch( x => ... x )` also swallows rejections by converting them to fulfillments.

Required v3 contract (implementation in `specs/v3-reporting.md`):

* `Task.async( fp )` returns `( ...vx ) =>` a REAL `Task` instance — constructed, never proto-swapped; brand checks pass.
* The report function is passed to `fp` as its FIRST argument, matching the 1.x code's intent. (The README's claim that a named function reports via `myFunc.report` never matched the code in any version; the README rewrite removes it.)
* Rejections from `fp` propagate as Task rejections — no `.catch` swallowing.
* The v2 `aOpts` parameter is removed (the reporting spec deletes the `started` / `done` / `error` markers globally).

## Defect 8 — Task.taskify ReferenceError

Behavior in 1.x (verified): the plain-Promise branch references `aState`, which is not defined in that scope → `ReferenceError: aState is not defined`. It also proto-swaps, which would hit the same brand-check failure as defect 7.

Required v3 contract (implementation in `specs/v3-reporting.md`):

* `taskify( task )` where the argument is already a `Task` → return it unchanged.
* `taskify( p )` where `p` is a Promise → a fresh `Task` adopting `p`'s settlement. A plain promise has no reports to forward; the new task simply emits none.
* `taskify( x )` otherwise → `Task.resolve( x )`.
* No proto-swapping anywhere.

## Defect 9 — MOOT

In 1.x, a progress handler returning `undefined` silently stopped propagation to later handlers and chained tasks (the transformer reduce chain bailed on `undefined`). Under the v3 observer model (`specs/v3-reporting.md`) observers are independent and return values are ignored, so this defect cannot be expressed. Retained here as history; the reporting test plan carries the regression case.

## Build and Test

Interpreted-language project; no build step. Runner: jest (`^29` per the reporting spec) via `npm test`.

* Tests: `/Users/jsd/@aios/tmp/es6tasks/test/regressions.test.js` (new file), covering:
  * `Task.async`-wrapped async function: resolves; `then` / `await` do not throw; a rejection from `fp` rejects the task; reports issued via the first-arg report function reach `.progress` observers.
  * `Task.taskify( plainPromise )`: returns a working Task that adopts the promise's settlement (both directions); `taskify( task )` returns the same instance; `taskify( value )` resolves.
* Versioning: subsumed into the `3.0.0` breaking release defined in `specs/v3-reporting.md` (the earlier standalone `1.0.12` patch plan is superseded; there is no 2.x).

## Dependencies

* `specs/v3-reporting.md` — authoritative v3 reporting model and rebuild signatures.
* `../es6pledges/specs/v3-core.md` and `../es6pledges/specs/v3-chains-combinators.md` — release semantics referenced by es6pacts.

## Error Handling

* Both fixes convert crashes (TypeError / ReferenceError) into normal Promise semantics; no new error surfaces are introduced.
