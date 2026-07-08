# es6tasks

Promises with progress reporting. A `Task` is a `Promise` whose executor receives a third parameter, `fReport`. Values passed to `fReport` are delivered to independent observers registered with `.progress()`.

# Usage

```javascript
const Task = require( "@debonet/es6tasks" );

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

A Task is not releasable, so this form runs to completion:

```javascript
ftaskDelay( 500 )
	.progress(( dtmElapsed ) => console.log( "progress:", dtmElapsed ))
	.then(( x ) => console.log( "result:", x ));
```

output

```
progress: 100
progress: 200
progress: 300
progress: 400
progress: 500
result: 500
```

The `progress: 500` line prints: the report is issued before the settling `fResolve` call in the same tick, so it is delivered per the suppression boundary below.

This example is shared with the sibling libraries. Adding the single body line `return () => clearInterval( interval );` — the executor-returned release policy from `@debonet/es6pledges` — yields `fpactDelay` from `@debonet/es6pacts`, which is releasable and reporting. All other lines are identical across the three libraries.

# Observer model

* `.progress( f )` appends `f` to the task's observer list and returns the task, so `.progress` calls chain.
* Observers are independent. On each delivery, every observer receives the same raw value that was passed to `fReport`, in attachment order.
* Observer return values are ignored. An observer cannot transform, filter, or block what any other observer sees. A `console.log`-style observer that returns `undefined` has no effect on later observers or on forwarding to derived tasks.
* An observer that throws does not prevent later observers from running. The exception is rethrown asynchronously so the host environment surfaces it, as with DOM event listeners.

# Delivery

* `fReport( x )` never invokes observers synchronously. Each call queues one delivery on the microtask queue, the same scheduling rule as promise reactions.
* The observer list is read at delivery time, not snapshotted when `fReport` is called. A consumer that attaches in the same tick as a synchronous executor report still receives it.
* There is no buffer and no replay. A consumer that attaches in a later tick misses earlier reports. Attach observers before the reports you care about are issued.
* Reports from a single task are delivered in emission order, and within one delivery observers run in attachment order. Where streams merge (chain forwarding, combinators), per-source order is preserved; cross-source interleaving is unspecified.
* `fReport` never throws and never returns a meaningful value.

# Post-settle suppression

* Once a task settles, further reports are dropped by the library. Reports issued before the settling `fResolve` / `fReject` call are delivered; reports issued after it are dropped.
* `fResolve( pxPending )` with a pending thenable does not settle the task. Reports continue until actual settlement.

# Chains and windowing

Tasks derived via `then` / `catch` / `finally` forward their parent's report stream to their own observers. Each forwarded report is a copy of the raw value, not a transformation. When a `then` handler returns a Task, that task's reports also forward to the derived task, from the moment the handler returns it.

Attachment position therefore selects the observation window:

```javascript
taskA
	.progress( fStageA )
	.then( ftaskB )
	.progress( fWhole );
```

* `fStageA` is attached to `taskA` and sees only `taskA`'s reports.
* `fWhole` is attached to the derived task and sees `taskA`'s reports (forwarded) and the reports of the task returned by `ftaskB` (forwarded once the handler returns it).
* Attach before a `.then` to observe that stage only. Attach at the end of the chain to observe the whole pipeline.

Suppression applies per task: forwarded reports are dropped once the receiving task has settled.

# API

## new Task( fxExecutor )
* `new Task( fxExecutor )`

Creates a new Task.

_**fxExecutor**_
> a function of the form `fxExecutor( fResolve, fReject, fReport )`. `fResolve` and `fReject` behave as they do for Promises. `fReport( x )` emits `x` to the task's observers as described above.

## progress
* `Task.prototype.progress( f )`

Appends an observer.

_**f**_
> a function receiving each raw reported value. Its return value is ignored.

_**returns**_
> the task

## then
* `Task.prototype.then( fOk, fErr )`

Standard 2-argument Promise signature.

_**returns**_
> a new Task that settles from the handler outcome and forwards the parent's report stream, plus the report stream of any Task returned by a handler

## catch
* `Task.prototype.catch( fErr )`

Shorthand for `Task.prototype.then( undefined, fErr )`.

## finally
* `Task.prototype.finally( f )`

Standard `Promise.prototype.finally` behavior; the result forwards the parent's report stream like any derived Task.

# Static methods

## all, allSettled, race, any
* `Task.all( vp )`
* `Task.allSettled( vp )`
* `Task.race( vp )`
* `Task.any( vp )`

_**vp**_
> an array of Tasks, Promises, or non-promise values

Standard `Promise.*` settlement behavior. In addition, each member Task's reports are re-emitted on the combined task in the form:

`{ task : n, report : x }`

where `n` is the member's index in `vp` and `x` is the raw reported value.

* Member reports flow while the combined task is unsettled and are suppressed after it settles.
* Non-Task members (plain promises, raw values) produce no reports.

## Task.async
* `Task.async( fp )`

Lifts a report-taking async function into a Task-returning function. The wrapped function receives `fReport` as its first argument, followed by the call arguments.

```javascript
const ftaskWork = Task.async( async ( fReport, c ) => {
	fReport( 0 );
	fReport( c );
	return "done";
});

ftaskWork( 10 )
	.progress(( x ) => console.log( `progress: ${ x }` ))
	.then(( s ) => console.log( `done: ${ s }` ));
```

Throws if `fp` is not a function.

## Task.taskify
* `Task.taskify( x )`

Returns `x` unchanged if it is already a Task; wraps a Promise in a Task; otherwise returns `Task.resolve( x )`.

## Task.resolve, Task.reject
* `Task.resolve( x )`
* `Task.reject( xReason )`

Identical to the equivalent `Promise.*` behavior.

# Migration: 1.x to 3.0.0

3.0.0 is a breaking release. There is no 2.x: the version jumps from 1.0.11 to 3.0.0 for version-family alignment with es6pledges and es6pacts. Deleted from 1.x:

* The progress transformer chain. Handlers no longer feed one another; each observer receives the raw reported value, return values are ignored, and returning `undefined` no longer stops propagation.
* The replay buffer. Reports are not stored; an observer attached after a report was delivered does not receive it.
* The `options` argument (`started` / `done` / `error`) everywhere: constructor, `then`, `catch`, `finally`, the static combinators, and `Task.async`. The constructor takes a single executor argument.
* The third `options` argument to `then`. `then` is standard 2-arg; `catch( fErr )`; `finally( f )`.
* The `myFunc.report` named-function form of `Task.async`. It never matched the implementation. The wrapped function now receives `fReport` as its first argument.

Unchanged: the `{ task : n, report : x }` combinator report format; `.progress()` chaining; the executor's `( fResolve, fReject, fReport )` signature.

# Installation

```
npm install @debonet/es6tasks
```
