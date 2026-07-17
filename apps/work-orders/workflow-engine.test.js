/*
 * Tests for the workflow engine. No dependencies — run with:
 *   node apps/work-orders/workflow-engine.test.js
 */
const WF = require("./workflow-engine.js");

let passed = 0;
function ok(c, m) { if (!c) { console.error("FAIL: " + m); process.exit(1); } passed++; }
function eq(a, b, m) { ok(JSON.stringify(a) === JSON.stringify(b), m + " (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")"); }
function throws(fn, m) { try { fn(); } catch (e) { passed++; return; } console.error("FAIL (expected throw): " + m); process.exit(1); }

/* ---------- 1. expression language ---------- */
const E = (s, sc) => WF.evalExpr(s, sc || {});
eq(E("1 + 2 * 3"), 7, "precedence");
eq(E("(1 + 2) * 3"), 9, "parens");
eq(E("5 >= 5 && 4 < 3"), false, "and/compare");
eq(E("5 > 5 || 2 == 2"), true, "or");
eq(E("!false"), true, "not");
eq(E("'a' == 'a'"), true, "string eq");
eq(E("-3 + 4"), 1, "unary minus");
eq(E("daysInState('completed') >= 5", { daysInState: () => 6 }), true, "fn call arg");
eq(E("role('approver') && cost <= limit", { role: () => true, cost: 90, limit: 100 }), true, "vars + fn");
eq(E("allTasksComplete()", { allTasksComplete: () => true }), true, "zero-arg fn");
throws(() => E("nope()"), "unknown function throws");
throws(() => E("missing"), "unknown name throws");

/* ---------- test profile ---------- */
function profile() {
  return {
    id: "wfp_test", type: "workflowProfile", key: "test", name: "Test",
    entryStates: ["requested"],
    states: [
      { id: "requested", label: "Requested" },
      { id: "in_progress", label: "In progress" },
      { id: "completed", label: "Completed" },
      { id: "closed", label: "Closed" },
      { id: "cancelled", label: "Cancelled" }
    ],
    transitions: [
      { from: "requested", to: "in_progress", label: "Start", trigger: { type: "manual" } },
      { from: "requested", to: "cancelled", label: "Cancel", trigger: { type: "manual" } },
      { from: "in_progress", to: "completed", label: "Complete", trigger: { type: "manual" }, guards: ["allTasksComplete()"] },
      { from: "in_progress", to: "cancelled", label: "Cancel", trigger: { type: "manual" } },
      { from: "completed", to: "closed", label: "Close", trigger: { type: "timer", afterDays: 5 } },
      { from: "cancelled", to: "closed", trigger: { type: "onEntry" }, actions: [{ type: "finalise_costs" }] }
    ]
  };
}
function rec(status, at) {
  return { id: "wo1", status: status, createdAt: "2026-01-01T00:00:00Z", statusHistory: [{ from: null, to: status, at: at || "2026-01-01T00:00:00Z" }] };
}

/* ---------- 2. graph-derived terminality / entry ---------- */
const P = profile();
eq(WF.terminalStates(P), ["closed"], "terminal = no outgoing (closed only)");
ok(!WF.isTerminal(P, "cancelled"), "cancelled is NOT terminal (has onEntry → closed)");
ok(WF.isTerminal(P, "closed"), "closed is terminal");
eq(WF.entryStates(P), ["requested"], "entry states");

/* ---------- 3. available manual transitions + guards ---------- */
const avA = WF.available(P, rec("requested"), { now: "2026-01-02T00:00:00Z" });
eq(avA.map(a => a.transition.to), ["in_progress", "cancelled"], "manual transitions from requested");
ok(avA.every(a => a.enabled), "no-guard transitions enabled");

const avB = WF.available(P, rec("in_progress"), { now: "2026-01-02T00:00:00Z", scope: { allTasksComplete: () => false } });
const complete = avB.find(a => a.transition.to === "completed");
ok(!complete.enabled, "Complete disabled when tasks incomplete");
eq(complete.guards[0].ok, false, "guard reports unmet");
ok(avB.find(a => a.transition.to === "cancelled").enabled, "Cancel still enabled");

/* ---------- 4. apply cascades onEntry (cancel → closed) ---------- */
let fired = [];
const r1 = rec("requested");
const res1 = WF.apply(P, r1, P.transitions[1] /* requested→cancelled */, {
  now: "2026-02-01T00:00:00Z", actor: "kim", runActions: (acts) => acts.forEach(a => fired.push(a.type))
});
eq(r1.status, "closed", "cancel cascades onEntry to closed");
eq(res1.applied.length, 2, "two transitions applied (cancel + auto-close)");
eq(r1.statusHistory.map(h => h.to), ["requested", "cancelled", "closed"], "history records both");
eq(r1.statusHistory[2].by, "system", "auto transition actor = system");
ok(/on entry/i.test(r1.statusHistory[2].reason), "auto reason recorded");
eq(fired, ["finalise_costs"], "onEntry transition actions ran");

/* ---------- 5. timer fires lazily, only once due ---------- */
const early = rec("completed", "2026-03-01T00:00:00Z");
WF.advance(P, early, { now: "2026-03-03T00:00:00Z" }); // 2 days < 5
eq(early.status, "completed", "timer not due at 2 days");
const late = rec("completed", "2026-03-01T00:00:00Z");
const resLate = WF.advance(P, late, { now: "2026-03-07T00:00:00Z" }); // 6 days ≥ 5
eq(late.status, "closed", "timer fires at 6 days");
eq(resLate.applied.length, 1, "one auto transition applied");
ok(/after 5d/i.test(late.statusHistory[late.statusHistory.length - 1].reason), "timer reason recorded");

/* ---------- 6. condition trigger ---------- */
const condP = profile();
condP.transitions.push({ from: "in_progress", to: "completed", trigger: { type: "condition", when: "allTasksComplete()" } });
const cr = rec("in_progress");
WF.advance(condP, cr, { now: "2026-01-02T00:00:00Z", scope: { allTasksComplete: () => true } });
eq(cr.status, "completed", "condition transition fires when predicate true");
const cr2 = rec("in_progress");
WF.advance(condP, cr2, { now: "2026-01-02T00:00:00Z", scope: { allTasksComplete: () => false } });
eq(cr2.status, "in_progress", "condition transition holds when predicate false");

/* ---------- 7. loop protection ---------- */
const loopP = { id: "l", type: "workflowProfile", key: "l", name: "L", states: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
  transitions: [{ from: "a", to: "b", trigger: { type: "onEntry" } }, { from: "b", to: "a", trigger: { type: "onEntry" } }] };
throws(() => WF.advance(loopP, rec("a"), { now: "2026-01-02T00:00:00Z" }), "onEntry cycle is caught");

console.log("ok — " + passed + " assertions passed");
