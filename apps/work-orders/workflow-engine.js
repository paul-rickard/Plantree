/*
 * Plantree — configurable workflow engine
 * ------------------------------------------------------------------
 * Drives a work item through a WorkflowProfile (schemas/workflow-profile).
 * The lifecycle is DATA: an ordered list of {id,label} states and
 * first-class transitions, each with a trigger (manual / onEntry / timer /
 * condition), guards (boolean expressions), and actions (side effects the
 * caller runs). Terminality is derived from the graph — a state with no
 * outgoing transition is terminal — so state identity stays pure.
 *
 * Automatic transitions (onEntry / timer / condition) fire LAZILY: the
 * caller invokes advance() whenever a record is loaded or touched, which
 * matches the serverless/file-based deployment (no daemon). onEntry chains
 * run synchronously; timers are evaluated against the recorded transition
 * history (now − time the current state was entered).
 *
 * No dependencies, no build:
 *   - browser:  <script src="workflow-engine.js"></script>  -> window.Workflow
 *   - node:     const Workflow = require("./workflow-engine.js")
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Workflow = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ================= expression language ================= *
   * A tiny, safe evaluator — no eval(), no property access, no globals.
   * Grammar (low → high precedence):
   *   or   := and ('||' and)*
   *   and  := eq  ('&&' eq)*
   *   eq   := cmp (('=='|'!=') cmp)*
   *   cmp  := add (('<'|'<='|'>'|'>=') add)*
   *   add  := mul (('+'|'-') mul)*
   *   mul  := unary (('*'|'/') unary)*
   *   unary:= ('!'|'-') unary | primary
   *   prim := number | string | true | false | null
   *         | ident | ident '(' args? ')' | '(' or ')'
   * Names resolve from `scope`: a plain value is a variable; a function is
   * called when written with parentheses.
   */
  function tokenize(src) {
    var toks = [], i = 0, n = src.length;
    var two = { "&&": 1, "||": 1, "==": 1, "!=": 1, "<=": 1, ">=": 1 };
    while (i < n) {
      var c = src[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
      if (c >= "0" && c <= "9" || (c === "." && src[i + 1] >= "0" && src[i + 1] <= "9")) {
        var j = i; while (j < n && (src[j] >= "0" && src[j] <= "9" || src[j] === ".")) j++;
        toks.push({ t: "num", v: parseFloat(src.slice(i, j)) }); i = j; continue;
      }
      if (c === '"' || c === "'") {
        var k = i + 1, s = ""; while (k < n && src[k] !== c) { s += src[k]; k++; }
        if (k >= n) throw new Error("unterminated string");
        toks.push({ t: "str", v: s }); i = k + 1; continue;
      }
      if (/[a-zA-Z_]/.test(c)) {
        var m = i; while (m < n && /[a-zA-Z0-9_]/.test(src[m])) m++;
        toks.push({ t: "id", v: src.slice(i, m) }); i = m; continue;
      }
      var pair = src.slice(i, i + 2);
      if (two[pair]) { toks.push({ t: "op", v: pair }); i += 2; continue; }
      if ("!<>+-*/(),".indexOf(c) >= 0) { toks.push({ t: "op", v: c }); i++; continue; }
      throw new Error("unexpected char '" + c + "'");
    }
    toks.push({ t: "eof" });
    return toks;
  }

  function evalExpr(src, scope) {
    var toks = tokenize(src), pos = 0;
    function peek() { return toks[pos]; }
    function eat(v) { var tk = toks[pos]; if (v && !(tk.v === v)) throw new Error("expected '" + v + "'"); pos++; return tk; }
    function truthy(x) { return !!x; }

    function or() { var l = and(); while (peek().v === "||") { eat("||"); var r = and(); l = truthy(l) || truthy(r); } return l; }
    function and() { var l = eq(); while (peek().v === "&&") { eat("&&"); var r = eq(); l = truthy(l) && truthy(r); } return l; }
    function eq() { var l = cmp(); while (peek().v === "==" || peek().v === "!=") { var o = eat().v; var r = cmp(); l = o === "==" ? l === r : l !== r; } return l; }
    function cmp() {
      var l = add();
      while (["<", "<=", ">", ">="].indexOf(peek().v) >= 0) {
        var o = eat().v, r = add();
        l = o === "<" ? l < r : o === "<=" ? l <= r : o === ">" ? l > r : l >= r;
      }
      return l;
    }
    function add() { var l = mul(); while (peek().v === "+" || peek().v === "-") { var o = eat().v, r = mul(); l = o === "+" ? l + r : l - r; } return l; }
    function mul() { var l = unary(); while (peek().v === "*" || peek().v === "/") { var o = eat().v, r = unary(); l = o === "*" ? l * r : l / r; } return l; }
    function unary() { if (peek().v === "!") { eat("!"); return !truthy(unary()); } if (peek().v === "-") { eat("-"); return -unary(); } return primary(); }
    function primary() {
      var tk = peek();
      if (tk.t === "num" || tk.t === "str") { pos++; return tk.v; }
      if (tk.v === "(") { eat("("); var e = or(); eat(")"); return e; }
      if (tk.t === "id") {
        pos++;
        if (tk.v === "true") return true;
        if (tk.v === "false") return false;
        if (tk.v === "null") return null;
        if (peek().v === "(") { // function call
          eat("(");
          var args = [];
          if (peek().v !== ")") { args.push(or()); while (peek().v === ",") { eat(","); args.push(or()); } }
          eat(")");
          var fn = scope[tk.v];
          if (typeof fn !== "function") throw new Error("unknown function '" + tk.v + "'");
          return fn.apply(null, args);
        }
        if (!(tk.v in scope)) throw new Error("unknown name '" + tk.v + "'");
        var val = scope[tk.v];
        return typeof val === "function" ? val() : val; // bare name may be a 0-arg fn
      }
      throw new Error("unexpected token");
    }
    var result = or();
    if (peek().t !== "eof") throw new Error("trailing input");
    return result;
  }

  /* ================= graph helpers ================= */
  function outgoing(profile, stateId) { return (profile.transitions || []).filter(function (t) { return t.from === stateId; }); }
  function terminalStates(profile) {
    return (profile.states || []).filter(function (s) { return outgoing(profile, s.id).length === 0; }).map(function (s) { return s.id; });
  }
  function isTerminal(profile, stateId) { return outgoing(profile, stateId).length === 0; }
  function entryStates(profile) {
    if (profile.entryStates && profile.entryStates.length) return profile.entryStates.slice();
    return profile.states && profile.states.length ? [profile.states[0].id] : [];
  }
  function stateLabel(profile, id) { var s = (profile.states || []).filter(function (x) { return x.id === id; })[0]; return s ? s.label : id; }

  /* ================= time-in-state (from history) ================= */
  function toMs(t) { if (t == null) return null; var d = t instanceof Date ? t : new Date(t.length <= 10 ? t + "T00:00:00Z" : t); return isNaN(d.getTime()) ? null : d.getTime(); }
  function enteredAt(record, stateId) {
    var h = record.statusHistory || [];
    for (var i = h.length - 1; i >= 0; i--) if (h[i].to === stateId) return toMs(h[i].at);
    return toMs(record.createdAt);
  }
  function hoursInState(record, stateId, nowMs) {
    var e = enteredAt(record, stateId); if (e == null || nowMs == null) return 0;
    return (nowMs - e) / 3600000;
  }

  /* ================= scope construction ================= */
  // Base scope: history-derived time helpers + current state. `extra` (from
  // the caller) adds domain predicates (allTasksComplete, partsReserved, …)
  // and variables (priority, cost, …).
  function baseScope(record, nowMs, extra) {
    var cur = record.status;
    var s = {
      state: cur,
      hoursInState: function (id) { var t = id == null ? cur : id; return t === cur ? hoursInState(record, cur, nowMs) : 0; },
      daysInState: function (id) { return s.hoursInState(id) / 24; },
      inState: function (id) { return cur === id; }
    };
    if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    return s;
  }

  function guardResults(guards, scope) {
    return (guards || []).map(function (g) {
      try { return { expr: g, ok: !!evalExpr(g, scope) }; }
      catch (e) { return { expr: g, ok: false, error: e.message }; }
    });
  }
  function guardsPass(guards, scope) { return guardResults(guards, scope).every(function (r) { return r.ok; }); }

  /* ================= public: manual transitions ================= */
  // Returns the manual transitions leaving the current state, each with its
  // guard evaluation and an `enabled` flag.
  function available(profile, record, opts) {
    opts = opts || {};
    var nowMs = toMs(opts.now) || Date.now();
    var scope = baseScope(record, nowMs, opts.scope);
    return outgoing(profile, record.status)
      .filter(function (t) { return !t.trigger || t.trigger.type === "manual"; })
      .map(function (t) { var gr = guardResults(t.guards, scope); return { transition: t, guards: gr, enabled: gr.every(function (r) { return r.ok; }) }; });
  }

  /* ================= public: apply a transition ================= */
  // Performs `transition` on `record` (records history, runs its actions via
  // opts.runActions), then cascades any due automatic transitions.
  function apply(profile, record, transition, opts) {
    opts = opts || {};
    var nowMs = toMs(opts.now) || Date.now();
    var nowIso = new Date(nowMs).toISOString();
    perform(profile, record, transition, opts.actor || "you", nowIso, opts.reason || null, opts.runActions);
    var applied = [transition];
    advanceInto(profile, record, nowMs, opts, applied);
    return { record: record, applied: applied };
  }

  // Apply due automatic transitions until none remain (loop-protected).
  function advance(profile, record, opts) {
    opts = opts || {};
    var nowMs = toMs(opts.now) || Date.now();
    var applied = [];
    advanceInto(profile, record, nowMs, opts, applied);
    return { record: record, applied: applied };
  }

  function advanceInto(profile, record, nowMs, opts, applied) {
    for (var guard = 0; guard < 100; guard++) {
      var t = dueAuto(profile, record, nowMs, opts.scope);
      if (!t) return;
      var nowIso = new Date(nowMs).toISOString();
      perform(profile, record, t, "system", nowIso, autoReason(profile, t), opts.runActions);
      applied.push(t);
    }
    throw new Error("workflow advance did not converge — check for an onEntry cycle");
  }

  function dueAuto(profile, record, nowMs, extraScope) {
    var scope = baseScope(record, nowMs, extraScope);
    var outs = outgoing(profile, record.status);
    for (var i = 0; i < outs.length; i++) {
      var t = outs[i], tr = t.trigger || {};
      if (tr.type === "manual" || !tr.type) continue;
      if (!guardsPass(t.guards, scope)) continue;
      if (tr.type === "onEntry") return t;
      if (tr.type === "timer") {
        var hrs = (tr.afterHours != null) ? tr.afterHours : (tr.afterDays != null ? tr.afterDays * 24 : 0);
        if (scope.hoursInState() >= hrs) return t;
      }
      if (tr.type === "condition") {
        try { if (evalExpr(tr.when || "false", scope)) return t; } catch (e) { /* treat as not due */ }
      }
    }
    return null;
  }

  function autoReason(profile, t) {
    var tr = t.trigger || {};
    if (tr.type === "onEntry") return "Auto: " + stateLabel(profile, t.from) + " → " + stateLabel(profile, t.to) + " on entry.";
    if (tr.type === "timer") { var h = tr.afterHours != null ? tr.afterHours + "h" : (tr.afterDays || 0) + "d"; return "Auto: " + stateLabel(profile, t.to) + " after " + h + " in " + stateLabel(profile, t.from) + "."; }
    return "Auto: condition met (" + (tr.when || "") + ").";
  }

  function perform(profile, record, transition, actor, nowIso, reason, runActions) {
    record.statusHistory = record.statusHistory || [];
    record.statusHistory.push({ from: record.status, to: transition.to, at: nowIso, by: actor, reason: reason });
    record.status = transition.to;
    if (typeof runActions === "function" && (transition.actions || []).length) runActions(transition.actions, record, transition);
  }

  return {
    evalExpr: evalExpr,
    tokenize: tokenize,
    terminalStates: terminalStates,
    isTerminal: isTerminal,
    entryStates: entryStates,
    stateLabel: stateLabel,
    available: available,
    apply: apply,
    advance: advance,
    _scope: baseScope
  };
});
