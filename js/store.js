/* Append-only, hash-chained event log + projection of current state + enforced roles.
   Everything the workpaper "knows" beyond the packet is an event here. State is a pure projection of the log. */
window.WP = window.WP || {};
(function () {
  const U = WP.U;
  const LOG_KEY = "wp.log.v1";
  const USER_KEY = "wp.user.v1";

  const store = (WP.store = { events: [], state: null, listeners: [], persistOk: true, packetHash: "" });

  /* ---------- users and roles ---------- */
  WP.initUsers = (P) => {
    WP.users = [
      ...P.firm.staff.map((s) => ({ id: s.id, name: s.name, role: s.role, credential: s.credential, clearance: !!s.sensitive_data_clearance, active_from: s.active_from, note: s.note, kind: "staff" })),
      ...P.firm.client_users.map((c) => ({ id: c.id, name: c.name, role: "client", clearance: true, kind: "client" })),
    ];
    WP.userById = Object.fromEntries(WP.users.map((u) => [u.id, u]));
  };
  const ROLE_LABEL = { preparer: "Preparer", reviewer: "Reviewer (CPA)", partner: "Partner (CPA)", firm_administrator: "Firm administrator", quality_reviewer: "Quality reviewer", client: "Client" };
  WP.roleLabel = (r) => ROLE_LABEL[r] || r;

  store.userId = (() => {
    try { return sessionStorage.getItem(USER_KEY) || "st-01"; } catch (e) { return "st-01"; }
  })();
  store.setUser = (id) => {
    store.userId = id;
    try { sessionStorage.setItem(USER_KEY, id); } catch (e) {}
    emit("user");
  };
  WP.me = () => WP.userById[store.userId];

  /* ---------- capabilities ---------- */
  const BASE = ["thread", "note", "decision", "time", "verify", "finding", "propose", "undo"];
  const CAPS = {
    preparer: BASE,
    reviewer: [...BASE, "approve_small", "signoff_reviewer", "block_note"],
    partner: [...BASE, "approve_small", "approve_any", "signoff_reviewer", "signoff_partner", "block_note", "release", "viewlog"],
    firm_administrator: ["thread", "note", "time", "standards", "viewlog", "assign"],
    quality_reviewer: ["thread", "note", "block_note", "viewlog"],
    client: ["answer", "client_approve", "esign", "client_note"],
  };
  /* returns {ok, why} */
  WP.can = (cap, ctx = {}) => {
    const u = WP.me();
    const st = store.state;
    const caps = CAPS[u.role] || [];
    const no = (why) => ({ ok: false, why });
    if (u.role === "quality_reviewer" && !(st && st.filing.frozen)) return no(`${u.name} joins the engagement on ${u.active_from} for post-filing quality review only.`);
    if (cap === "approve") {
      const a = ctx.adj;
      if (a.author === u.id) return no("A person may not review or approve work they prepared.");
      const big = Math.max(Math.abs(a.effect.taxFed), Math.abs(a.effect.taxCA)) > st.standards.partner_threshold;
      if (big) return caps.includes("approve_any") ? { ok: true } : no(`Tax effect over ${U.money(st.standards.partner_threshold)} requires partner sign-off.`);
      return caps.includes("approve_small") ? { ok: true } : no("Only a reviewer or partner can approve adjustments.");
    }
    if (cap === "signoff") {
      const need = ctx.level === "partner" ? "signoff_partner" : "signoff_reviewer";
      if (!caps.includes(need)) return no(`Only a ${ctx.level === "partner" ? "partner" : "reviewer or partner"} can give ${ctx.level} sign-off.`);
      if (ctx.area && st.workedBy[ctx.area] && st.workedBy[ctx.area].has(u.id)) return no("A person may not sign off on work they prepared.");
      if (ctx.level === "partner" && ctx.area && !(st.signoffsFor(ctx.area, "reviewer"))) return no("Partner sign-off needs a current reviewer sign-off first.");
      return { ok: true };
    }
    if (!caps.includes(cap)) return no(`${WP.roleLabel(u.role)} cannot do this (${cap}).`);
    return { ok: true };
  };

  /* ---------- log ---------- */
  function emit(kind) {
    store.listeners.forEach((f) => f(kind));
  }
  store.onChange = (f) => store.listeners.push(f);

  const evHash = (e) => U.sha256((e.prev || "") + U.stable({ i: e.i, ts: e.ts, actor: e.actor, type: e.type, payload: e.payload, batch: e.batch || null }));

  store.verifyChain = () => {
    let prev = "";
    for (const e of store.events) {
      if (e.prev !== prev || evHash(e) !== e.hash) return { ok: false, at: e.i };
      prev = e.hash;
    }
    return { ok: true, n: store.events.length };
  };

  store.load = () => {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      store.events = raw ? JSON.parse(raw) : [];
    } catch (e) {
      store.events = [];
      store.persistOk = false;
    }
  };
  function persist() {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(store.events));
    } catch (e) {
      store.persistOk = false;
    }
  }
  store.reproject = () => {
    store.state = project(store.events);
  };
  store.append = (type, payload = {}, opt = {}) => {
    const u = WP.me();
    const last = store.events[store.events.length - 1];
    const e = {
      i: store.events.length,
      ts: new Date().toISOString(),
      actor: { id: u.id, role: u.role, name: u.name },
      type,
      payload,
      batch: opt.batch || null,
      prev: last ? last.hash : "",
    };
    e.hash = evHash(e);
    store.events.push(e);
    persist();
    store.reproject();
    emit("append");
    try { WP.bc && WP.bc.postMessage({ k: "log", n: store.events.length }); } catch (x) {}
    return e;
  };
  store.reset = () => {
    store.events = [];
    persist();
    store.append("packet.loaded", { name: WP.M.P.packet.name, version: WP.M.P.packet.version, sha256: store.packetHash, documents: WP.M.docs.length, values: WP.M.P.extracted_values.length });
  };
  store.ensureGenesis = () => {
    if (!store.events.length) store.append("packet.loaded", { name: WP.M.P.packet.name, version: WP.M.P.packet.version, sha256: store.packetHash, documents: WP.M.docs.length, values: WP.M.P.extracted_values.length });
    else store.reproject();
  };
  store.syncFromStorage = () => {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      const ev = raw ? JSON.parse(raw) : [];
      if (ev.length !== store.events.length || (ev.length && ev[ev.length - 1].hash !== store.events[store.events.length - 1].hash)) {
        store.events = ev;
        store.reproject();
        emit("sync");
      }
    } catch (e) {}
  };
  window.addEventListener("storage", (e) => { if (e.key === LOG_KEY) store.syncFromStorage(); });
  try {
    WP.bc = new BroadcastChannel("wp-presence");
    WP.presence = {};
    WP.bc.onmessage = (m) => {
      const d = m.data;
      if (d.k === "hello") { WP.presence[d.tab] = { user: d.user, seen: Date.now(), at: d.at }; emit("presence"); }
      if (d.k === "log") store.syncFromStorage();
    };
    WP.tabId = U.uid("tab");
    const hb = () => WP.bc.postMessage({ k: "hello", tab: WP.tabId, user: store.userId, at: location.hash });
    setInterval(() => {
      hb();
      const now = Date.now();
      let ch = false;
      for (const t in WP.presence) if (now - WP.presence[t].seen > 7000) { delete WP.presence[t]; ch = true; }
      if (ch) emit("presence");
    }, 3000);
    setTimeout(hb, 300);
  } catch (e) {}

  /* ---------- projection ---------- */
  const DEFAULT_STANDARDS = (P) => ({
    variance_percent: P.firm.starter_standards.variance_review.flag_if_change_over_percent,
    variance_amount: P.firm.starter_standards.variance_review.and_over_amount,
    partner_threshold: 1000,
    required_steps: P.firm.starter_standards.required_steps.slice(),
    rules: P.firm.starter_standards.rules.slice(),
    verification_types: P.firm.starter_standards.verification_types.slice(),
    retention_years: 7,
  });

  function project(events) {
    const P = WP.M.P;
    const undone = new Set();
    events.forEach((e) => {
      if (e.type === "undo") undone.add(e.payload.batch);
      if (e.type === "redo") undone.delete(e.payload.batch);
    });
    const S = {
      adj: {}, adjOrder: [], findings: {}, verifs: {}, threads: {}, threadOrder: [], notes: {}, decisions: {}, decisionOrder: [],
      signoffs: {}, signoffOrder: [], views: [], seen: {}, time: [], standards: DEFAULT_STANDARDS(P), undone, workedBy: {},
      filing: { released: null, approvals: {}, esign: null, frozen: null, submissions: [], payments: [], status: "preparation", amendments: [] },
      stepsDone: {}, extension: null, noticeResponses: {}, activity: events,
    };
    const area = (target) => WP.areaOfKey ? WP.areaOfKey(target) : null;
    const worked = (a, uid) => { if (a) (S.workedBy[a] ||= new Set()).add(uid); };
    events.forEach((e) => {
      if (e.batch && undone.has(e.batch)) return;
      const p = e.payload, a = e.actor;
      switch (e.type) {
        case "adj.propose": {
          const frozen = !!S.filing.frozen;
          S.adj[p.id] = { ...p, author: a.id, authorRole: a.role, authorName: a.name, ts: e.ts, status: "proposed", at: e.i, amendment: frozen, decisions: [] };
          S.adjOrder.push(p.id);
          worked(area(p.target) || p.area, a.id);
          break;
        }
        case "adj.decide": {
          const x = S.adj[p.id];
          if (x) { x.status = p.decision === "approve" ? "approved" : "rejected"; x.decisions.push({ by: a.id, name: a.name, role: a.role, decision: p.decision, note: p.note, ts: e.ts }); }
          break;
        }
        case "adj.revert": { const x = S.adj[p.id]; if (x) { x.status = "reverted"; x.decisions.push({ by: a.id, name: a.name, decision: "revert", note: p.note, ts: e.ts }); } break; }
        case "adj.whatif": { const x = S.adj[p.id]; if (x) x.whatif = !!p.on; break; }
        case "finding.set": S.findings[p.id] = { status: p.status, note: p.note, by: a.id, name: a.name, ts: e.ts, assignee: (S.findings[p.id] || {}).assignee }; break;
        case "finding.assign": S.findings[p.id] = { ...(S.findings[p.id] || { status: "open" }), assignee: p.assignee }; break;
        case "verify.add": (S.verifs[p.target] ||= []).push({ ...p, by: a.id, name: a.name, role: a.role, ts: e.ts }); worked(area(p.target), a.id); break;
        case "thread.open":
          S.threads[p.id] = { ...p, status: "open", opener: a.id, openerName: a.name, openerRole: a.role, ts: e.ts, messages: [{ by: a.id, name: a.name, role: a.role, text: p.text, ts: e.ts, attachments: p.attachments || [] }], at: e.i };
          S.threadOrder.push(p.id);
          break;
        case "thread.reply": { const t = S.threads[p.id]; if (t) { t.messages.push({ by: a.id, name: a.name, role: a.role, text: p.text, ts: e.ts, attachments: p.attachments || [] }); if (p.answers) t.status = "answered"; } break; }
        case "thread.status": { const t = S.threads[p.id]; if (t) { t.status = p.status; t.closedBy = a.id; t.closedName = a.name; t.closedTs = e.ts; } break; }
        case "thread.assign": { const t = S.threads[p.id]; if (t) { t.assignee = p.assignee; t.due = p.due; } break; }
        case "note.add": (S.notes[p.target] ||= []).push({ ...p, by: a.id, name: a.name, role: a.role, ts: e.ts }); break;
        case "decision.add": S.decisions[p.id] = { ...p, by: a.id, name: a.name, role: a.role, ts: e.ts, approvals: [] }; S.decisionOrder.push(p.id); break;
        case "decision.approve": { const d = S.decisions[p.id]; if (d) d.approvals.push({ by: a.id, name: a.name, role: a.role, ts: e.ts, note: p.note }); break; }
        case "signoff.add": S.signoffs[p.id] = { ...p, by: a.id, name: a.name, role: a.role, ts: e.ts, revoked: false }; S.signoffOrder.push(p.id); break;
        case "signoff.revoke": { const s = S.signoffs[p.id]; if (s) { s.revoked = true; s.revokedBy = a.name; } break; }
        case "view.log": S.views.push({ ...p, by: a.id, name: a.name, role: a.role, ts: e.ts }); break;
        case "seen.set": S.seen[a.id] = p.until; break;
        case "time.add": S.time.push({ ...p, by: a.id, name: a.name, ts: e.ts }); break;
        case "standards.set": Object.assign(S.standards, p.patch); break;
        case "step.set": S.stepsDone[p.step] = { done: p.done, by: a.name, ts: e.ts, note: p.note }; break;
        case "filing.release": S.filing.released = { by: a.id, name: a.name, ts: e.ts, digest: p.digest }; break;
        case "filing.approve": S.filing.approvals[a.id] = { name: a.name, ts: e.ts, digest: p.digest }; break;
        case "filing.esign": S.filing.esign = { by: a.id, name: a.name, ts: e.ts, ...p }; break;
        case "filing.extension": S.extension = { ...p, by: a.name, ts: e.ts }; break;
        case "filing.submit": S.filing.submissions.push({ ...p, ts: e.ts, by: a.name }); break;
        case "filing.freeze": S.filing.frozen = { ...p, ts: e.ts, by: a.name }; S.filing.status = "filed"; break;
        case "filing.payment": S.filing.payments.push({ ...p, ts: e.ts, by: a.name }); break;
        case "filing.status": S.filing.status = p.status; break;
        case "notice.response": S.noticeResponses[p.noticeId] = { ...p, by: a.name, ts: e.ts }; break;
      }
    });
    S.signoffsFor = (areaKey, level) => S.signoffOrder.map((id) => S.signoffs[id]).filter((s) => s.area === areaKey && s.level === level && !s.revoked).slice(-1)[0] || null;
    return S;
  }
  WP.project = project;
})();
