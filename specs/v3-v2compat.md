# es6tasks — v2 Test-Suite Continuity (v3-v2compat)

## TL;DR

* The 14 v2 tests from `/Users/jsd/@aios/tmp/v2ref/es6tasks/test/es6tasks.test.js` port into `test/v2compat.test.js` with minimum modification: 7 PORT, 7 ADAPT, 0 DROP.
* ADAPTs fall in three families: add an `await` where v2 relied on synchronous replay delivery; collapse transformer chains into single-observer computation; replace `aOpts` marker expectations with the observer-model forwarding streams (windowing).
* Deleted sub-behaviors folded into ADAPTs (transformer chaining, undefined-starvation, `aOpts` markers) have their replacement rules covered by the green v3 reporting suite; citations below.
* The existing v3 suites (`test/reporting.test.js`, `test/regressions.test.js`) are untouched; this file is ADDITIVE.

## Purpose

Prove v2 behavioral continuity by making the v2 unit tests pass against v3 (observer model) with the minimum modification the API changes force.

## Ground Rules

* Ported tests live in `/Users/jsd/@aios/tmp/es6tasks/test/v2compat.test.js`, with a header comment citing the v2 source file for provenance.
* Preference order: PORT over ADAPT over DROP. PORT edits must not change what a test asserts; ADAPTs state what the test now asserts.
* The `delay` helper ports verbatim; the unused `fpDelay` helper is omitted (dead code, never referenced by any test).
* Constructors in this file are already 1-arg; the only API deletions that bite are `aOpts` (constructor/then/catch third args) and delivery timing (no synchronous replay).

## Disposition Table

| # | v2 test | Disposition | Modification |
|---|---------|-------------|--------------|
| 1 | simple syncronous task progress reports | ADAPT | add `await task;` before the expect. v2 delivered synchronously via replay-at-attach; v3 delivers on a microtask (same-tick attach still receives the report). Assertion `"here"` preserved |
| 2 | multple syncronous task reports all get captured | ADAPT | add `await task;`. Assertion `"here1here2"` preserved (emission order) |
| 3 | simple asyncronous task reports | PORT | verbatim; report precedes the settling call, so `"here:done"` holds under the suppression boundary |
| 4 | simple multiple asyncronous task reports | PORT | verbatim; `"here0:here1:here2:done"` |
| 5 | tasks report 0 | PORT | verbatim; exercises derived-task forwarding of a same-tick synchronous report (`fReport( 0 )` fires during construction; the `.then`-derived task subscribes and the observer attaches in the same tick; delivery-time list read covers both hops). `"0:0:done"`. If the forwarding hop proves timing-fragile, fall back to ADAPT by awaiting a microtask flush after construction — flag it if so |
| 6 | promise chains | ADAPT | transformer chain (`x*1000` → `"--"+x+"--"` → append) collapses into ONE observer computing `s += "--" + ( x * 1000 ) + "--:"`. Expected string `"--1000--:--2000--:done"` preserved. Now asserts raw-value delivery in emission order with observer-local computation; chain TRANSFORMATION itself is deleted (citation below) |
| 7 | rejections | PORT | verbatim; `"1:2:rejected:done"` |
| 8 | finally | PORT | verbatim; `"1:2:rejected:done:finally"` |
| 9 | then chaining to new Task | ADAPT | delete the `aOpts` third argument (`{ started, done }`); the `undefined`-returning observer stays (harmless under independence). New expected string below |
| 10 | then chaining to non-task | ADAPT | delete the `aOpts` second argument; new expected string below |
| 11 | catch chaining to new Task | ADAPT | delete the `aOpts` second argument to `catch`; new expected string below |
| 12 | catch chaining to non-task | ADAPT | delete the `aOpts` second argument; new expected string below |
| 13 | Task.allSettled | PORT | verbatim; the `undefined`-returning observer is now harmless; `{ task : n, report : x }` format kept; members' synchronous first reports reach the combined task via same-tick subscription. Assertion string unchanged |
| 14 | Task.all | PORT | verbatim; `'H1=1:p2 REJECT:reject'` — the combined task settles before p1's late report, and the expect runs before it would fire anyway |

## ADAPT Register — expected strings for 9–12

v2's grouped `H1=..., H1=..., H2=...` shape came from two deleted mechanisms: the `undefined`-observer starved forwarding (defect 9), and `aOpts` injected `Started` / `Done` markers. Under v3 the derived task forwards the parent's stream live, so H1 (on the source) and H2 (on the derived task) INTERLEAVE per report — H2's copy arrives one forwarding hop after H1's. The subtask's reports then flow to H2 only. New expected strings:

* **9** (then → new Task): `"H1=progA, H2=progA, H1=progB, H2=progB, H2=progC, H2=progD, finally"`
* **10** (then → non-task): `"H1=progA, H2=progA, H1=progB, H2=progB, finally"`
* **11** (catch → new Task): `"H1=progA, H2=progA, H1=progB, H2=progB, H2=progC, H2=progD, H2=progE, finally"` (progC is emitted synchronously at subtask construction; the handler-return subscription is same-tick, so it is received)
* **12** (catch → non-task): `"H1=progA, H2=progA, H1=progB, H2=progB, finally"`

These now assert the windowing rule (`specs/v3-reporting.md`, Chains and Windowing): stage observer sees its stage; end-of-chain observer sees the forwarded parent stream plus the handler-returned task's stream.

## Deleted sub-behaviors folded into ADAPTs — replacement coverage

No test is dropped outright, but three v2 mechanisms these tests leaned on are deleted (`specs/v3-reporting.md`, Deleted from v2). Replacement-rule coverage, already green in `test/reporting.test.js`:

* Transformer reduce chain (tests 6, 9–12) → "attachment order; same raw value to every observer".
* Undefined-return starvation (tests 9–13) → the defect 9 regression case.
* `aOpts` markers and third-arg `then` (tests 9–12) → "`then` ignores no third options argument; constructor takes one argument".
* Synchronous replay-at-attach (tests 1–2) → "same-tick attachment receives a synchronous executor report; later attachment misses earlier reports".

## Build and Test

* File: `/Users/jsd/@aios/tmp/es6tasks/test/v2compat.test.js` (new; 14 tests). Runner: jest, `npm test` (script `jest test/*test*` — the filename matches).
* Existing v3 suites are untouched and must stay green alongside this file.
