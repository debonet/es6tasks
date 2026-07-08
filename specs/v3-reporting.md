# es6tasks v3 — Reporting Semantics (Observer Model)

## TL;DR

* `.progress( f )` registers an INDEPENDENT observer. Observers are called in attachment order, each with the SAME raw report value. Return values are IGNORED — observers cannot transform, filter, or starve one another.
* Delivery is queued on a microtask, same rule as promise reactions. There is NO replay buffer.
* Once the task settles, further reports are dropped by the library, centrally.
* Derived tasks forward their parent's report stream (a copy, not a transformation); attachment position in a chain selects the observation window.
* DELETED from v2: the transformer reduce chain, the replay buffer (`vxProgress` / `vfxProgress` / `aState`), the `aOpts` `started` / `done` / `error` auto-report markers, and the nonstandard third argument to `then` — `then` returns to the standard 2-arg signature.
* Breaking release: version `3.0.0` — version-family alignment across all three packages; semver permits skipping 2.x from 1.0.11. Implemented; see Implementation Requirements for two load-bearing choices that must not be "fixed" back.

## Purpose

Task delivers executor-issued progress reports to independent observers registered via `.progress`.

## Standards

* Code follows `~/.claude/coding_standards.md` and `~/.claude/SemanticHungarian.md`.
* Recurring names: `fReport` (the executor's third parameter), `#vfProgress` (observer list), `#fEmit( x )` (internal emission, private method), `#bSettled` (suppression flag).

## Observer Model

* `new Task( fxExecutor )` — single argument. The executor signature is `( fResolve, fReject, fReport )`. The v2 `aOpts` second constructor argument is removed.
* `task.progress( f )` appends `f` to `#vfProgress` and returns `this` (chainable, as in v2).
* On delivery, every observer receives the SAME raw value that was passed to `fReport`. Observer return values are ignored. An observer cannot affect what any other observer sees.
* This makes v2 defect 9 (a handler returning `undefined` starving later handlers and chained tasks) structurally impossible. A regression test MUST prove that a `console.log`-style observer (returns `undefined`) does not affect later observers.
* An observer that THROWS must not prevent later observers from running: each observer call is isolated, and the exception is rethrown asynchronously so the host surfaces it (event-listener style). The rethrow is a MACROTASK, not a microtask — see Implementation Requirements. Flagged design choice — the alternative (silent swallow) hides bugs.

## Delivery

* `fReport( x )` NEVER invokes observers synchronously. Each call queues one delivery on the microtask queue.
* The observer list is read at DELIVERY time, not snapshotted at call time. Consequence: a consumer attaching in the same tick as a synchronous executor report still receives it; a consumer attaching in a later tick misses earlier reports. There is no buffer and no replay.
* Ordering: reports from a single task are delivered in emission order; within one delivery, observers run in attachment order. Where streams merge (forwarding, below), per-source order is preserved; cross-source interleaving is unspecified.

## Post-Settle Suppression

* Once the task settles, further reports are dropped by the library. Enforcement is central (inside `#fEmit`), never left to executor discipline.
* `#bSettled` is set by an engine-level settlement observer registered before any user code. Note: the naive form `Promise.prototype.then.call( this, ... )` recurses infinitely on a Promise subclass; the required construction is in Implementation Requirements.
* Suppression is evaluated at DELIVERY time. Combined with FIFO microtask ordering this yields a deterministic boundary: reports issued before the settling capability call are delivered; reports issued after it are dropped.
* `fResolve( pxPending )` with a pending thenable does NOT settle the task; reports continue until actual settlement (consistent with the settlement-tracking rule in es6pledges `specs/v3-core.md`).

## Implementation Requirements

Two implementation realities discovered during the build. Both are REQUIREMENTS; reverting either reintroduces a verified failure.

### Symbol.species must be overridden to Promise

`static get [ Symbol.species ](){ return Promise; }` is mandatory. Without it, the settlement-observer technique recurses infinitely: with the default species (Task), every internal `then()` used to observe settlement constructs another Task, whose constructor registers another settlement observer, which calls `then()` again, forever. With species = Promise, internal `then()` calls produce plain promises and the recursion cannot start.

Consequences the implementation must uphold:

* `then()` constructs the derived Task EXPLICITLY, by adopting a plain intermediate promise — it cannot rely on species to produce a Task.
* Statics are unaffected: `Promise.all` and the other combinators construct via `this`, not species.
* Do not "fix" this back to default species or to bare `Promise.prototype.then.call( this, ... )` observation; the infinite recursion is immediate and total.

### The throwing-observer rethrow is a macrotask

The asynchronous rethrow of an observer's exception uses `setTimeout( ..., 0 )` (macrotask), NOT `queueMicrotask`. Verified empirically by the implementation: jest's vm context silently swallows microtask exceptions, so a microtask rethrow would be unobservable — exactly the silent-swallow outcome this spec rejects.

This does not weaken the delivery rules: microtask timing is mandated only for report DELIVERY. The rethrow requirement is only that it be asynchronous and isolated per observer; macrotask timing satisfies it and is observable in every host.

## Chains and Windowing

* Tasks derived via `then` / `catch` / `finally` forward their PARENT's report stream to their own observers — a copy of each raw value, not a transformation.
* When a then-handler returns a Task (or Pact), that task's reports forward to the derived task as well, from the moment the handler returns it.
* Net effect — attachment position selects the observation window:

```javascript
taskA
	.progress( fStageA )
	.then( ftaskB )
	.progress( fWhole );
```

`fStageA` is attached to `taskA` and sees only `taskA`'s reports. `fWhole` is attached to the derived task and sees `taskA`'s reports (forwarded) AND the reports of the task returned by `ftaskB` (forwarded when it starts). Attach before a `.then` to observe that stage only; attach at the end of the chain to observe the whole pipeline.

* Suppression applies per task: forwarded reports are dropped once the RECEIVING task has settled.
* Forwarding is subscription-based (the derived task registers an observer on its parent at derivation time, and on a handler-returned task at handler-return time). No transformer participates; deleting an emission is impossible from user code.

## Combinators

* `Task.all( vp )` / `any` / `race` / `allSettled` — the `aOpts` parameter is removed from all statics.
* Member reports are re-emitted on the combined task in the v2 wrapper format, kept verbatim: `{ task : n, report : x }` where `n` is the member's index in `vp`.
* Member reports flow while the combined task is unsettled and are suppressed after it settles. Central suppression replaces v2's `bContinue` gating, which is deleted along with the member re-wrapping of settlement paths it required.
* Non-Task members (plain promises, raw values) produce no reports.

## Task.async and taskify

Rebuilt per `specs/v3-bugfix-appendix.md` (no proto-swapping, no rejection swallowing), made consistent with this model — no `aState`, no replay buffer, no `aOpts`:

```javascript
static async( fp ){
	if ( typeof fp != "function" ){
		throw new Error( "Task.async requires a promise-returning function" );
	}
	return ( ...vx ) => new Task(
		( fResolve, fReject, fReport ) => {
			fp( fReport, ...vx ).then( fResolve, fReject );
		}
	);
}

static taskify( x ){
	if ( x instanceof Task ){
		return x;
	}
	if ( x instanceof Promise ){
		return new Task(( fResolve, fReject ) => {
			x.then( fResolve, fReject );
		});
	}
	return Task.resolve( x );
}
```

Flag: under the new model `Task.async` reduces to a one-line lift of a report-taking async function into a Task-returning function. It is near-trivial but still the only ergonomic way to express that lift, so this spec recommends KEEPING it; deletion is a defensible alternative if the API surface should shrink. `taskify` remains useful (foreign-promise adoption) and is kept.

## Deleted from v2 (complete list)

* The transformer reduce chain (`vfxProgress`, chained-return semantics, undefined-stops-propagation).
* The replay buffer (`vxProgress`, store-then-replay in `fReportOrStore`).
* `aState` and the `fReportProgress` own-property; emission is the private `#fEmit`.
* `aOpts` (`started` / `done` / `error`) everywhere: constructor, `then`, `catch`, `finally`, statics, `Task.async`.
* `then( fOk, fErr, aOpts )` third argument — `then` is standard 2-arg; `catch( fErr )`; `finally( f )`.
* `bContinue` combinator gating.
* Release-pipeline events (release requested / refused) are NOT reports; the `release()` promise carries that information (see es6pledges `specs/v3-core.md`).

## README Rewrite Requirements

Rewrite `README.md` for the v3 model:

* The PRIMARY example is the shared cross-library example below, exactly as specified.
* Observer semantics, microtask delivery, no-replay consequence, post-settle suppression, and the windowing example above.
* Delete the v2 "subtlety" section on transformer chaining and the undefined-stops-propagation technique (no longer exists).
* Delete all `aOpts` documentation and the third-argument `then` API.
* `Task.async`: document report-as-first-argument; remove the false `myFunc.report` named-function claim (it never matched the code).
* Migration section: 1.x → 3.0.0 breaking list (this Deleted list, condensed). Note there is no 2.x: the version jumps from 1.0.11 to 3.0.0 for version-family alignment with es6pledges and es6pacts.
* Style: `*` lists, BLUF, no hyperbole.

### Primary example (shared across the three libraries)

The three READMEs (es6pledges, es6tasks, es6pacts) share ONE running primary example — the interval delay function — so the composition is visible by inspection. The es6pacts form is the superset; each parent library's form differs from it by exactly the lines the OTHER library contributes. This repo's form is the delay WITH reporting and WITHOUT cleanup. Use this code verbatim (names and structure are pinned for line-compatibility with the sibling READMEs):

```javascript
function ftaskDelay( dtm, dtmTick = 100 ){
	return new Task(( fResolve, fReject, fReport ) => {
		let dtmElapsed = 0;
		const interval = setInterval(() => {
			dtmElapsed += dtmTick;
			fReport( dtmElapsed );
			if ( dtmElapsed >= dtm ){
				clearInterval( interval );
				fResolve( dtm );
			}
		}, dtmTick );
	});
}
```

Usage (a Task is not releasable, so this form runs to completion):

```javascript
ftaskDelay( 500 )
	.progress(( dtmElapsed ) => console.log( "progress:", dtmElapsed ))
	.then(( x ) => console.log( "result:", x ));
```

Shown output:

```
progress: 100
progress: 200
progress: 300
progress: 400
progress: 500
result: 500
```

(The `progress: 500` line prints: the report is issued BEFORE the settling `fResolve` call in the same tick, so it is delivered per the suppression boundary.)

Diff contract (state it in the README next to the example): adding the single body line `return () => clearInterval( interval );` — the executor-returned release policy from `@debonet/es6pledges` — yields `fpactDelay` (`@debonet/es6pacts`), which is releasable AND reporting. All other lines are identical across the three libraries.

This requirement governs only the PRIMARY example. The library-specific SECONDARY examples are kept: the windowing snippet (Chains and Windowing above) and the `Task.async` example.

## Versioning

* `package.json` version → `3.0.0` (breaking; version-family alignment — all three packages ship as 3.0.0, and semver permits skipping 2.x from 1.0.11).
* `devDependencies.jest` → `^29` (align with es6pledges).

## Build and Test

Interpreted-language project; no build step. Runner: jest via `npm test`.

* Tests: `/Users/jsd/@aios/tmp/es6tasks/test/reporting.test.js` (new) plus `test/regressions.test.js` (bugfix appendix). Required cases:
  * Defect 9 regression: an observer returning `undefined` does not affect later observers or forwarding.
  * Attachment order; same raw value to every observer; `.progress` returns `this`.
  * Same-tick attachment receives a synchronous executor report; later attachment misses earlier reports.
  * Reports issued before the settling call are delivered; reports issued after it are dropped.
  * `fResolve( pxPending )`: reports continue until actual settlement.
  * Windowing: the example above, asserting `fStageA` vs `fWhole` streams.
  * Handler-returned task forwarding.
  * Throwing observer does not starve later observers.
  * `then` ignores no third options argument (2-arg behavior); constructor takes one argument.
  * Combinators: `{ task : n, report : x }` format; member reports suppressed after the combined task settles.
  * `Task.async` and `taskify` per the contracts above.
* v2 continuity: `test/v2compat.test.js` per `specs/v3-v2compat.md` (additive; existing suites untouched).

## Dependencies

* es6pledges `specs/v3-core.md` — settlement-tracking rule, executor-parameter pass-through (how `fReport` reaches Pact executors).
* `specs/v3-bugfix-appendix.md` — Task.async / taskify defect history.

## Error Handling

* Observer exceptions: isolated per observer, rethrown asynchronously on a macrotask (see Implementation Requirements).
* `fReport` itself never throws and never returns a meaningful value.
