/* Role homes: each role opens on a desk built for its job, with the same underlying evidence.
   Also: shared widgets (tax bridge, readiness ring, findings heat), the role guide, and the notifications menu. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc, M0 = () => WP.M;

  /* ---------- widgets ---------- */
  const ring = (done, total, label = "ready") => {
    const C = 2 * Math.PI * 44, d = total ? (done / total) * C : 0;
    return `<div class="ring" role="img" aria-label="${done} of ${total} ${label}"><svg viewBox="0 0 100 100"><circle class="t" cx="50" cy="50" r="44"/><circle class="p" cx="50" cy="50" r="44" stroke-dasharray="${d.toFixed(1)} ${C.toFixed(1)}"/></svg><div class="c"><div>${done}<span style="opacity:.6;font-size:15px">/${total}</span><small>${esc(label)}</small></div></div></div>`;
  };
  const hero = ({ eyebrow, title, sub, actions = "", stats = [], right = "" }) =>
    `<div class="hero"><div class="grow" style="min-width:260px"><div class="eyebrow">${esc(eyebrow)}</div><h1>${title}</h1><div class="sub">${sub}</div><div class="row wrap mt16">${actions}</div></div>
      <div class="stats">${stats.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${esc(l)}</span></div>`).join("")}</div>${right}</div>`;

  /* Where tax moves between the engine's number and the workpaper's, one finding at a time. */
  const bridge = (which = "fed") => {
    const base = WP.M.curV().v.summary[which === "fed" ? "federal" : "california"].total_tax;
    const rows = WP.findings.filter((f) => f.suggest && f.suggest.length && Math.abs(f.effect[which]) >= 1).sort((a, b) => Math.abs(b.effect[which]) - Math.abs(a.effect[which]));
    const top = rows.slice(0, 7), rest = rows.slice(7);
    let cum = base;
    const steps = top.map((f) => { const from = cum; cum += f.effect[which]; return { label: f.title.replace(/\s*\(.*?\)/g, "").slice(0, 46), id: f.id, from, to: cum, d: f.effect[which] }; });
    if (rest.length) { const d = U.sum(rest.map((f) => f.effect[which])); const from = cum; cum += d; steps.push({ label: `${rest.length} smaller findings`, from, to: cum, d }); }
    const all = [base, ...steps.flatMap((s) => [s.from, s.to])];
    const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1, pad = span * 0.08;
    const pos = (x) => ((x - (lo - pad)) / (span + pad * 2)) * 100;
    const row = (label, a, b, cls, val, id) => `<div class="br"><div>${id ? `<a href="#/findings/${id}" style="color:inherit;text-decoration:none">${esc(label)}</a>` : `<b>${esc(label)}</b>`}</div><div class="lane"><div class="seg ${cls}" style="left:${Math.min(pos(a), pos(b)).toFixed(1)}%;width:${Math.max(Math.abs(pos(b) - pos(a)), 0.8).toFixed(1)}%"></div></div><div class="v ${cls === "neg" ? "neg" : cls === "tot" ? "" : "pos"}">${val}</div></div>`;
    return `<div class="bridge">${row("Engine total tax", lo - pad, base, "tot", U.money(Math.round(base)))}${steps.map((s) => row(s.label, s.from, s.to, s.d < 0 ? "neg" : "", U.signed(Math.round(s.d)), s.id)).join("")}${row("If every finding is accepted", lo - pad, cum, "tot", U.money(Math.round(cum)))}</div>`;
  };
  const heat = () => {
    const areas = WP.AREAS.filter((a) => a.key !== "intake_and_engagement");
    return `<div class="heat">${areas.map((a) => {
      const fs = WP.findings.filter((f) => f.area === a.key);
      const e = fs.filter((f) => f.sev === "error" && WP.findingState(f.id).status === "open").length, w = fs.filter((f) => f.sev === "warning" && WP.findingState(f.id).status === "open").length, k = fs.length - e - w;
      const t = Math.max(1, fs.length);
      return `<div class="hr"><a href="#/return" style="color:inherit;text-decoration:none">${esc(a.label)}</a><div class="hb" title="${e} open errors, ${w} open warnings, ${k} resolved or informational"><i class="e" style="width:${(e / t) * 100}%"></i><i class="w" style="width:${(w / t) * 100}%"></i><i class="k" style="width:${(k / t) * 100}%"></i></div><span class="mono small right">${e || w ? `${e}·${w}` : "✓"}</span></div>`;
    }).join("")}</div><div class="legend mt8"><span><span class="chip err">open errors</span></span><span><span class="chip warn">open warnings</span></span><span><span class="chip ok">resolved / info</span></span></div>`;
  };
  const qi = (icon, title, sub, right = "") => `<div class="qi"><div class="ico">${icon}</div><div class="grow"><div style="font-weight:700">${title}</div>${sub ? `<div class="small muted">${sub}</div>` : ""}</div>${right}</div>`;
  const kpiCard = (l, v, d, cls) => `<div class="card">${ui.kpi(l, v, d, cls)}</div>`;
  const first = () => WP.me().name.split(" ")[0];
  const totals = () => WP.live().totals;
  const balText = (b) => (b >= 0 ? U.money(Math.round(b)) + " due" : U.money(Math.round(-b)) + " refund");

  /* ---------- guide (first-run card and drawer) ---------- */
  const GUIDE = {
    preparer: [["Start with Findings", "#/findings", "Red items are errors the engine and the extraction missed. Each shows the evidence."], ["Click any number", "#/return", "Every figure opens its derivation and the exact field on the source page."], ["Propose, don't overwrite", "#/changes/ledger", "An adjustment keeps the engine's original and shows its tax effect."], ["Ask the client in-app", "#/people/threads", "A question attached to a number becomes evidence when it is answered."], ["Turn the steps green", "#/overview", "Verify numbers and resolve findings until every step passes."]],
    reviewer: [["Work the approvals queue", "#/changes/ledger", "You can approve up to the partner threshold; bigger ones go to a partner."], ["Trace a sample", "#/return", "Open any number and check its source, rule and verification."], ["Check the reconciliations", "#/records/recon", "Figures that should agree, recomputed from the live return."], ["Sign off an area", "#/people/signoffs", "Your sign-off reopens if any line it covers changes."], ["Block filing with a note", "#/people/threads", "An open review note stops release until it is resolved."]],
    partner: [["Check readiness", "#/overview", "The ring counts the firm's required steps; blockers are listed."], ["Approve large adjustments", "#/changes/ledger", "Anything over the threshold needs you."], ["Give partner sign-offs", "#/people/signoffs", "Available after a current reviewer sign-off."], ["Release to the client", "#/filing", "Seals the numbers the client will approve."], ["Transmit and freeze", "#/filing", "Acceptance seals the return; later changes become amendments."]],
    firm_administrator: [["Review the standards", "#/firm/standards", "Thresholds, required steps and rules apply to every engagement."], ["Check who can see what", "#/people/team", "Clearance controls masking of SSNs, bank numbers and PINs."], ["Watch time against budget", "#/firm/time", "Hours by area against the engagement budget."], ["Verify the audit chain", "#/activity", "Every entry is hash-chained to the one before."], ["Read the view log", "#/firm/viewlog", "Every unmasked sensitive value is recorded."]],
    quality_reviewer: [["Open the frozen return", "#/filing", "What was filed, sealed with a hash."], ["Check sign-off coverage", "#/overview", "Every area should carry both sign-offs."], ["Read the reconciliations", "#/records/recon", "Do the figures still agree after filing?"], ["Look at the amendment layer", "#/filing", "Post-filing changes sit on top of the sealed return."], ["Prepare for a notice", "#/notice", "A self-contained response record, built from the file."]],
    client: [["Answer our questions", "#/people/threads", "Short questions about specific numbers."], ["Check your documents", "#/documents", "Everything you uploaded and where it was used."], ["Review your numbers", "#/clientcopy", "A plain copy of your return."], ["Approve and sign", "#/filing", "Both spouses sign with last year's AGI."], ["Know what happens next", "#/overview", "From approval to filing and refund."]],
  };
  const guideKey = () => "wp.guide." + WP.me().role;
  const guideSeen = () => { try { return localStorage.getItem(guideKey()) === "1"; } catch (e) { return false; } };
  const guideCard = () => guideSeen() ? "" : `<div class="guide mt16"><div class="row"><h3 class="grow">New here? Five things to do first</h3><button class="btn sm" data-act="guide-dismiss">Got it</button></div><ol>${GUIDE[WP.me().role].map(([t, h, d]) => `<li><a href="${h}"><b>${esc(t)}</b></a><div class="muted">${esc(d)}</div></li>`).join("")}</ol></div>`;
  ui.acts["guide-dismiss"] = () => { try { localStorage.setItem(guideKey(), "1"); } catch (e) {} ui.render(); };
  ui.acts.guide = () => ui.drawer("Guide", () => {
    const r = WP.me().role;
    return `<div class="col"><div><span class="rolebadge">${esc(WP.roleLabel(r))}</span><h2 class="mt8">Your first five moves</h2></div>
      <ol class="small" style="padding-left:18px;display:flex;flex-direction:column;gap:10px">${GUIDE[r].map(([t, h, d]) => `<li><a href="${h}" data-act="close-drawer-nav"><b>${esc(t)}</b></a><div class="muted">${esc(d)}</div></li>`).join("")}</ol>
      <div class="card flat"><h4>Shortcuts</h4><table class="small mt8"><tbody><tr><td><span class="kbd">Ctrl K</span> or <span class="kbd">/</span></td><td>Search every document, number, finding and action</td></tr><tr><td><span class="kbd">Esc</span></td><td>Close the inspector or palette</td></tr><tr><td><span class="kbd">↑</span> <span class="kbd">↓</span> <span class="kbd">Enter</span></td><td>Move and open in the palette</td></tr></tbody></table></div>
      <div class="card flat"><h4>Words used here</h4><dl class="small" style="margin:8px 0 0"><dt><b>Claim</b></dt><dd class="muted" style="margin:0 0 6px">A number in the return, with its source, rule and checks.</dd><dt><b>Finding</b></dt><dd class="muted" style="margin:0 0 6px">Something that does not add up, with evidence and a suggested fix.</dd><dt><b>Adjustment</b></dt><dd class="muted" style="margin:0 0 6px">A reviewable change. The original value is always kept.</dd><dt><b>Sign-off</b></dt><dd class="muted" style="margin:0 0 6px">An attestation that reopens when what it covers changes.</dd><dt><b>Freeze</b></dt><dd class="muted" style="margin:0">The seal put on the return when it is filed.</dd></dl></div></div>`;
  });

  /* ---------- notifications ---------- */
  ui.bellHtml = () => {
    const items = ui.inbox(), sl = ui.sinceLast();
    return `<div class="row" style="padding:6px 10px"><h3 class="grow">Notifications</h3><button class="btn sm" data-act="seen-mark">Mark all seen</button></div>
      ${items.map((i) => `<a class="bi" href="${i.link}" data-act="bell-close">${esc(i.text)}${i.due ? `<div class="tiny muted">due ${esc(i.due)}</div>` : ""}</a>`).join("") || '<div class="muted small" style="padding:8px 12px">Nothing is waiting on you.</div>'}
      <h4 style="padding:10px 12px 4px">Changes by others</h4>${sl.evs.slice(-6).reverse().map((e) => `<div class="bi small"><b>${esc(e.actor.name)}</b> ${esc(ui.describeEvent(e)).slice(0, 110)}<div class="tiny muted">${U.dt(e.ts)}</div></div>`).join("") || '<div class="muted small" style="padding:4px 12px 10px">Nothing new from other people. Open a second tab as another role to see live changes.</div>'}`;
  };
  ui.acts.bell = () => { const m = document.getElementById("bellmenu"); m.innerHTML = ui.bellHtml(); m.classList.toggle("on"); };
  ui.acts["bell-close"] = (el) => { document.getElementById("bellmenu").classList.remove("on"); ui.go(el.getAttribute("href")); };
  document.addEventListener("click", (e) => { const m = document.getElementById("bellmenu"); if (m && m.classList.contains("on") && !e.target.closest("#bellmenu") && !e.target.closest('[data-act="bell"]')) m.classList.remove("on"); });

  /* ---------- homes ---------- */
  const common = () => {
    const sl = ui.sinceLast();
    return `<div class="card"><div class="row"><h3 class="grow">Since I last looked</h3>${ui.chip(sl.evs.length + " by others")}<button class="btn sm" data-act="seen-mark">Mark seen</button></div><div class="col gap4 mt8 small">${sl.evs.slice(-6).reverse().map((e) => `<div><span class="muted mono tiny">${U.dt(e.ts)}</span> <b>${esc(e.actor.name)}</b> ${esc(ui.describeEvent(e))}</div>`).join("") || '<div class="muted">Nothing new from other people. Open the app in a second tab as another role to watch changes arrive.</div>'}</div></div>`;
  };
  const budgetCard = () => {
    const S = WP.store.state, budget = WP.M.P.firm.budget_hours, spent = {};
    S.time.forEach((t) => (spent[t.area] = (spent[t.area] || 0) + t.hours));
    const bt = U.sum(Object.values(budget)), st = U.sum(Object.values(spent));
    return `<div class="card"><div class="row"><h3 class="grow">Time against budget</h3><span class="mono small">${U.round(st, 1)} / ${bt} h</span><button class="btn sm" data-act="time-add">Log time</button></div><div class="col gap4 mt8">${Object.entries(budget).map(([k, h]) => `<div><div class="row small"><span class="grow">${esc(WP.areaLabel(k))}</span><span class="mono">${U.round(spent[k] || 0, 1)}/${h}</span></div><div class="bar ${(spent[k] || 0) > h ? "errb" : ""}"><i style="width:${Math.min(100, ((spent[k] || 0) / h) * 100)}%"></i></div></div>`).join("")}</div></div>`;
  };
  const stepsCard = () => {
    const steps = WP.steps();
    return `<div class="card"><div class="row"><h3 class="grow">Ready to file?</h3>${ui.chip(`${steps.filter((s) => s.done).length}/${steps.length}`, steps.every((s) => s.done) ? "ok" : "warn")}</div><div class="mt8">${steps.map((s) => `<div class="step"><span class="dot ${s.done ? "on" : ""}">${s.done ? "✓" : ""}</span><div class="grow"><div style="font-weight:600">${esc(s.label)}</div><div class="tiny muted">${esc(s.detail)}</div></div>${s.manual || /Prior-year return reviewed/.test(s.label) ? `<button class="btn sm" data-act="step-set" data-step="${esc(s.label)}" data-done="${s.done ? 0 : 1}">${s.done ? "Undo" : "Mark done"}</button>` : ""}</div>`).join("")}</div></div>`;
  };
  const topFindings = (n = 6) => `<div class="card"><div class="row"><h3 class="grow">Top open findings</h3><a href="#/findings" class="small">All findings</a></div><div class="queue mt8">${WP.findingsBlocking().slice(0, n).map((f) => qi(f.sev === "error" ? "!" : "?", `<a href="#/findings/${f.id}" style="color:inherit;text-decoration:none">${esc(f.title)}</a>`, esc(WP.areaLabel(f.area)), `<span class="mono small ${f.effect.fed > 0 ? "pos" : "neg"}">${U.signed(Math.round(f.effect.fed))}</span>`)).join("") || ui.empty("No open findings.")}</div></div>`;

  /* Demo: a realistic set of proposals, questions and notes so every desk has something to work on. */
  ui.acts["demo-seed"] = async () => {
    if (!(await ui.confirm("Load demo activity?", "Adds a realistic set of proposals, questions, review notes, approvals and verifications from Priya, Daniel and Helen so each desk has real work in it. Everything is recorded in the log, and Reset undoes it all.", "Load demo"))) return;
    const prev = WP.store.userId, as = (id) => { WP.store.userId = id; }, st = WP.store;
    try {
      as("st-01");
      ["DUP-INTEREST", "FX-YEAR", "BIZ-USE", "MORT-DOUBLE", "SEHI-ELIGIBLE", "HVAC-CAPITAL", "VEHICLE-FMV"].forEach((fid) => ui.acts["adj-propose"]({ dataset: { fid, sid: "all" } }));
      st.append("verify.add", { target: "F1040.1a", vtype: "agreed_to_source_document", evidence: "D08p1", note: "Corvane and Halvorsen W-2 box 1; D10 is a copy of D09" });
      st.append("verify.add", { target: "F1040.25a", vtype: "recalculated", evidence: "D09p1", note: "Box 2 of both W-2s" });
      st.append("thread.open", { id: U.uid("th"), kind: "client_question", title: "Bitcoin bought in March 2021: any other record?", text: "Erik, besides the bank line to CryptoNorth on 03/15/2021, do you have an email confirmation, a wallet export or a 2021 tax form showing the purchase and the 0.05 BTC? It decides whether the sale is long-term.", target: "F8949.H.C6", assignee: "cu-02", due: "2026-10-30", blocking: false, visibility: "client" });
      st.append("thread.open", { id: U.uid("th"), kind: "colleague_question", title: "HVAC: capitalize or safe-harbor?", text: "The invoice is a full system replacement (D47). I propose capitalizing over 27.5 years. Agree?", target: "SchE.14A", assignee: "st-02", due: "2026-10-22", blocking: false, visibility: "internal" });
      as("st-02");
      st.append("thread.open", { id: U.uid("th"), kind: "review_note", title: "Support the 2022 S-corp stock basis (21,300)", text: "The only support is a client worksheet. Get the 2022 K-1 or the corporation's basis schedule before we rely on it: it drives a 21,215 capital gain.", target: "F7203.1", assignee: "st-01", due: "2026-10-20", blocking: true, visibility: "internal" });
      WP.adjList().filter((a) => ["DUP-INTEREST", "FX-YEAR"].includes(a.findingId) && a.status === "proposed").forEach((a) => st.append("adj.decide", { id: a.id, decision: "approve", note: "Agreed to source" }));
      as("st-03");
      st.append("decision.add", { id: U.uid("dec"), kind: "judgment", topic: "", title: "Treat the Oregon composite tax (1,580) as a distribution", body: "Box 16D includes tax paid on Erik's behalf. Treated as a distribution reducing basis; the tax is not separately deducted.", authority: "IRC 1368; Rev. Rul. on composite returns", target: "F7203.6" });
    } finally { as(prev); }
    st.reproject(); st.listeners.forEach((f) => f("append"));
    ui.toast("Demo activity loaded. Switch roles to see each desk with real work in it.");
  };
  const demoBanner = () => (WP.store.events.length <= 2 ? `<div class="callout mt16 row wrap"><div class="grow"><b>Looking around?</b> Load demo activity so the reviewer and partner desks have approvals, a blocking note and a client question to work on.</div><button class="btn primary" data-act="demo-seed">Load demo activity</button></div>` : "");

  function preparer() {
    const T = totals(), base = WP.M.curV().v.summary, steps = WP.steps(), done = steps.filter((s) => s.done).length;
    const open = WP.findingsBlocking(), inbox = ui.inbox();
    const mine = WP.adjList().filter((a) => a.author === WP.store.userId && a.status === "proposed");
    return hero({ eyebrow: "Preparer desk", title: `${esc(first())}, ${open.length + inbox.length} things need you`, sub: `${open.length} open findings, ${inbox.length} items assigned to you, ${mine.length} adjustments waiting for approval.`,
      actions: `<a class="btn primary" href="#/findings">Work the findings</a><button class="btn" data-act="adj-new">New adjustment</button><a class="btn" href="#/records/recon">Reconciliations</a>`,
      stats: [[U.money(Math.round(T.federal.total_tax)), "federal tax"], [balText(T.federal.balance_due), "federal balance"], [balText(T.california.balance_due), "california"]], right: ring(done, steps.length, "steps") }) +
      `<div class="grid g2 mt16"><div class="card"><div class="row"><h3 class="grow">Where the tax moves</h3><span class="small muted">federal · engine → workpaper</span></div><div class="small muted mb8">Each bar is one finding's estimated effect (change × rate). Nothing is applied until you propose it.</div>${bridge("fed")}</div>
      <div class="card"><h3>Findings by area</h3><div class="small muted mb8">Open errors and warnings against what is resolved.</div>${heat()}</div></div>
      <div class="grid g2 mt16"><div class="card"><div class="row"><h3 class="grow">My queue</h3>${ui.chip(String(inbox.length + mine.length))}</div><div class="queue mt8">${inbox.map((i) => qi("→", `<a href="${i.link}" style="color:inherit;text-decoration:none">${esc(i.text)}</a>`, i.due ? "due " + esc(i.due) : "")).join("")}${mine.map((a) => qi("±", esc(`${a.target}: ${a.label || a.reason}`.slice(0, 80)), "waiting for a reviewer or partner", `<span class="mono small ${a.effect.taxFed > 0 ? "pos" : "neg"}">${U.signed(Math.round(a.effect.taxFed))}</span>`)).join("")}${!inbox.length && !mine.length ? ui.empty("Your queue is clear.") : ""}</div></div>${common()}</div>
      <div class="grid g2 mt16">${stepsCard()}<div class="col">${budgetCard()}</div></div>${demoBanner()}${guideCard()}`;
  }

  function reviewer() {
    const S = WP.store.state, T = totals();
    const pending = WP.adjList().filter((a) => a.status === "proposed");
    const mineToApprove = pending.filter((a) => WP.can("approve", { adj: a }).ok);
    const notes = WP.openBlockers();
    const due = WP.SIGN_AREAS.filter((a) => WP.signoffStatus(WP.currentSignoff(a.key, "reviewer")).state !== "valid");
    const adjRow = (a) => { const can = WP.can("approve", { adj: a }); return qi("±", `<a class="num" data-act="trace" data-key="${esc(a.target)}">${esc(a.target)}</a> ${esc((a.label || a.reason || "").slice(0, 70))}`, `${esc(a.authorName)} · fed ${U.signed(Math.round(a.effect.taxFed))} · CA ${U.signed(Math.round(a.effect.taxCA))}${can.ok ? "" : ` · <span class="pos">${esc(can.why)}</span>`}`, can.ok ? `<button class="btn sm" data-act="adj-decide" data-id="${a.id}" data-dec="approve">Approve</button><button class="btn sm" data-act="adj-decide" data-id="${a.id}" data-dec="reject">Reject</button>` : ui.chip("not yours to approve", "warn")); };
    return hero({ eyebrow: "Review desk", title: `${esc(first())}, ${mineToApprove.length} to approve, ${due.length} areas to sign`, sub: "Approve what your authority covers, sign the areas you did not prepare, and block filing with a note if something is not right.",
      actions: `<a class="btn primary" href="#/changes/ledger">Open approvals</a><a class="btn" href="#/people/signoffs">Sign-offs</a><button class="btn" data-act="thread-new" data-kind="review_note">Raise a review note</button>`,
      stats: [[String(pending.length), "awaiting approval"], [String(notes.length), "blocking notes"], [U.money(Math.round(T.federal.total_tax)), "federal tax"]] }) +
      `<div class="grid g2 mt16"><div class="card"><div class="row"><h3 class="grow">Awaiting approval</h3>${ui.chip(String(pending.length), pending.length ? "warn" : "ok")}</div><div class="small muted">Rule: you cannot approve work you prepared; above ${U.money(S.standards.partner_threshold)} of tax effect needs a partner.</div><div class="queue mt8">${pending.slice(0, 8).map(adjRow).join("") || ui.empty("Nothing waiting for approval.")}</div></div>
      <div class="card"><div class="row"><h3 class="grow">Areas for reviewer sign-off</h3></div><div class="queue mt8">${WP.SIGN_AREAS.map((a) => { const st = WP.signoffStatus(WP.currentSignoff(a.key, "reviewer")), can = WP.can("signoff", { area: a.key, level: "reviewer" }); const open = WP.findings.filter((f) => f.area === a.key && f.sev === "error" && WP.findingState(f.id).status === "open").length;
        return qi(st.state === "valid" ? "✓" : "·", esc(a.label), st.state === "valid" ? "signed" : st.state === "reopened" ? `<span class="pos">reopened: ${st.changed.length} lines changed</span>` : open ? `${open} open error(s) in this area` : "ready to sign", `<button class="btn sm ${can.ok ? "" : "off"}" ${can.ok ? "" : `title="${esc(can.why)}"`} data-act="signoff" data-area="${a.key}" data-level="reviewer">${st.state === "valid" ? "Re-sign" : "Sign"}</button>`); }).join("")}</div></div></div>
      <div class="grid g2 mt16"><div class="card"><h3>Open review notes</h3><div class="queue mt8">${notes.map((t) => qi("✉", `<a href="#/people/threads/${t.id}" style="color:inherit">${esc(t.title)}</a>`, esc(t.target || ""), ui.chip("blocks filing", "err"))).join("") || ui.empty("No blocking notes.")}</div></div>${topFindings(5)}</div>
      <div class="grid g2 mt16"><div class="card"><h3>Findings by area</h3>${heat()}</div>${common()}</div>${demoBanner()}${guideCard()}`;
  }

  function partner() {
    const S = WP.store.state, T = totals(), steps = WP.steps(), done = steps.filter((s) => s.done).length, F = S.filing;
    const big = WP.adjList().filter((a) => a.status === "proposed" && Math.max(Math.abs(a.effect.taxFed), Math.abs(a.effect.taxCA)) > S.standards.partner_threshold);
    const decs = S.decisionOrder.map((id) => S.decisions[id]).filter((d) => !d.approvals.length);
    const blockers = WP.blockers().filter((b) => !/Client approval/.test(b.text));
    const rl = F.released;
    return hero({ eyebrow: "Partner desk", title: F.frozen ? "Filed and frozen" : `${esc(first())}, ${blockers.length ? blockers.length + " blockers before release" : "ready to release"}`, sub: F.frozen ? "The return is sealed. Changes from here are amendments." : "You release the return, sign as partner, and transmit it. Everything below is what stands between the file and the client's signature.",
      actions: `<a class="btn primary" href="#/filing">Release &amp; filing</a><a class="btn" href="#/people/signoffs">Partner sign-offs</a><a class="btn" href="#/records/summary">Return summary</a>`,
      stats: [[U.money(Math.round(T.federal.total_tax)), "federal tax"], [balText(T.federal.balance_due), "federal balance"], [balText(T.california.balance_due), "california"]], right: ring(done, steps.length, "steps") }) +
      `<div class="grid g2 mt16"><div class="card"><div class="row"><h3 class="grow">Release readiness</h3>${rl ? ui.chip("released", "ok") : ui.chip("not released", "warn")}</div><div class="queue mt8">${blockers.slice(0, 7).map((b) => qi(b.kind === "note" ? "✉" : "!", esc(b.text.slice(0, 120)), "")).join("") || '<div class="callout ok">Nothing blocks release.</div>'}</div></div>
      <div class="card"><div class="row"><h3 class="grow">Needs a partner</h3>${ui.chip(String(big.length + decs.length), big.length + decs.length ? "warn" : "ok")}</div><div class="queue mt8">${big.map((a) => qi("±", `${esc(a.target)} ${esc((a.label || "").slice(0, 60))}`, `fed ${U.signed(Math.round(a.effect.taxFed))} · CA ${U.signed(Math.round(a.effect.taxCA))} · by ${esc(a.authorName)}`, `<button class="btn sm" data-act="adj-decide" data-id="${a.id}" data-dec="approve">Approve</button>`)).join("")}${decs.map((d) => qi("§", esc(d.title.slice(0, 70)), `${esc(d.kind.replace(/_/g, " "))} · authority: ${esc(d.authority.slice(0, 50))}`, `<button class="btn sm" data-act="decision-approve" data-id="${d.id}">Approve</button>`)).join("")}${!big.length && !decs.length ? ui.empty("Nothing needs partner approval.") : ""}</div></div></div>
      <div class="grid g2 mt16"><div class="card"><h3>Where the tax moves</h3><div class="small muted mb8">Federal, engine → workpaper.</div>${bridge("fed")}</div><div class="card"><h3>Risk and outside filings</h3><div class="queue mt8">${WP.outsideFilings().slice(0, 5).map((o) => qi("◇", esc(o.name), `${esc(o.who)} · due ${esc(o.due)}`, ui.chip(o.scope.startsWith("In scope") ? "in scope" : "outside", o.scope.startsWith("In scope") ? "ok" : "warn"))).join("")}</div></div></div>
      <div class="grid g2 mt16">${stepsCard()}${common()}</div>${demoBanner()}${guideCard()}`;
  }

  function admin() {
    const S = WP.store.state, st = S.standards, chain = WP.store.verifyChain();
    const open = S.threadOrder.map((id) => S.threads[id]).filter((t) => t.status !== "resolved");
    return hero({ eyebrow: "Firm desk", title: `${esc(first())}, the firm at a glance`, sub: "Standards, who can see what, time against budget, and proof that the record has not been altered.",
      actions: `<a class="btn primary" href="#/firm/standards">Edit standards</a><a class="btn" href="#/firm/viewlog">View log</a><a class="btn" href="#/activity">Audit log</a>`,
      stats: [[String(WP.M.staff.length), "staff"], [String(WP.store.events.length), "events"], [chain.ok ? "intact" : "BROKEN", "hash chain"]] }) +
      `<div class="grid g2 mt16"><div class="card"><h3>Team, roles and clearance</h3><table class="mt8 small"><tbody>${WP.M.staff.map((s) => `<tr><td><b>${esc(s.name)}</b><div class="tiny muted">${esc(WP.roleLabel(s.role))}${s.credential ? " · " + esc(s.credential) : ""}</div></td><td>${s.sensitive_data_clearance ? ui.chip("cleared", "ok") : ui.chip("masked", "warn")}</td><td class="n">${open.filter((t) => t.assignee === s.id).length} open</td><td>${Object.values(WP.presence || {}).some((p) => p.user === s.id) ? '<span class="pres"></span>' : ""}</td></tr>`).join("")}</tbody></table></div>
      ${budgetCard()}</div>
      <div class="grid g3 mt16"><div class="card"><h4>Review thresholds</h4><div class="mt8 small">Variance flag: <b>${st.variance_percent}%</b> and <b>${U.money(st.variance_amount)}</b><br>Partner approval above <b>${U.money(st.partner_threshold)}</b><br>Retention <b>${st.retention_years} years</b></div></div>
      <div class="card"><h4>Sensitive-data reveals</h4><div class="kpi mt8"><div class="v">${S.views.length}</div><div class="d">unmasked views logged</div></div></div>
      <div class="card"><h4>Record integrity</h4><div class="mt8 small">${chain.ok ? ui.chip("chain intact", "ok") : ui.chip("broken at " + chain.at, "err")} ${WP.store.events.length} entries.<div class="hash mt8">packet ${esc(WP.store.packetHash.slice(0, 16))}…</div></div></div></div>
      <div class="grid g2 mt16">${common()}<div class="card"><h3>Required steps</h3><ol class="small">${st.required_steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div></div>${guideCard()}`;
  }

  function qa() {
    const S = WP.store.state, fz = S.filing.frozen;
    const reg = WP.areaRegister(), rs = WP.recons();
    if (!fz) return hero({ eyebrow: "Quality desk", title: "Quality review starts after filing", sub: "Sam joins on 2027-01-04 (selected for quality review). Until the return is filed and frozen there is nothing sealed to review.", actions: `<a class="btn primary" href="#/replay">Replay the season</a><a class="btn" href="#/records/recon">Reconciliations</a>` }) + `<div class="grid g2 mt16"><div class="card"><h3>What you will check</h3><ol class="small"><li>Both sign-offs on every area, still valid</li><li>Reconciliations agree on the frozen numbers</li><li>Decisions carry their authority</li><li>A notice response can be built from the file alone</li></ol></div>${common()}</div>${guideCard()}`;
    const amend = WP.adjList().filter((a) => a.amendment && (a.status === "proposed" || a.status === "approved"));
    return hero({ eyebrow: "Quality desk", title: "Frozen return review", sub: `Sealed ${U.dt(fz.ts)}. Hash ${fz.hash.slice(0, 20)}…`, actions: `<a class="btn primary" href="#/filing">Frozen return</a><a class="btn" href="#/notice">Notice response</a><a class="btn" href="#/rollforward">Roll-forward</a>`, stats: [[String(Object.keys(fz.snapshot).length), "lines sealed"], [String(amend.length), "amendments"], [`${rs.filter((r) => r.ok).length}/${rs.length}`, "reconciled"]] }) +
      `<div class="grid g2 mt16"><div class="card"><h3>Sign-off coverage</h3><table class="small mt8"><tbody>${reg.map((r) => `<tr><td>${esc(r.area.label)}</td><td>${ui.chip(r.rv === "none" ? "not signed" : r.rv, r.rv === "valid" ? "ok" : "err")}</td><td>${ui.chip(r.pt === "none" ? "not signed" : r.pt, r.pt === "valid" ? "ok" : "err")}</td></tr>`).join("")}</tbody></table></div>${common()}</div>${guideCard()}`;
  }

  function client() {
    const S = WP.store.state, T = totals(), F = S.filing, me = WP.me(), inbox = ui.inbox();
    const rl = F.released && F.released.digest === WP.returnDigest(), mine = F.approvals[me.id] && F.approvals[me.id].digest === WP.returnDigest();
    const stage = F.frozen ? 3 : mine ? 2 : rl ? 1 : 0;
    const js = [["Documents received", "74 documents"], ["Prepared and reviewed", "your return"], ["Your approval", "sign Form 8879"], ["Filed", "IRS and California"]];
    const approved = WP.adjList().filter((a) => a.status === "approved" && a.label);
    return hero({ eyebrow: "Your return", title: `Hello, ${esc(first())}`, sub: stage === 0 ? "Your preparer is still working. Answer any open questions below to keep things moving." : stage === 1 ? "Your return is ready. Review the numbers and sign when you are happy." : stage === 2 ? "Thank you. Waiting for the other signature or for filing." : "Your return has been filed and accepted.",
      actions: `<a class="btn primary" href="#/filing">${stage === 1 ? "Review and sign" : "Filing status"}</a><a class="btn" href="#/clientcopy">See your copy</a>`, stats: [[balText(T.federal.balance_due), "federal"], [balText(T.california.balance_due), "california"]] }) +
      `<div class="card mt16"><div class="journey">${js.map(([t, s], i) => `<div class="js ${i <= stage ? "done" : i === stage + 1 ? "now" : ""}"><i>${i <= stage ? "✓" : ""}</i>${esc(t)}<div class="tiny muted" style="font-weight:500">${esc(s)}</div></div>`).join("")}</div></div>
      <div class="grid g2 mt16"><div class="card"><div class="row"><h3 class="grow">What we need from you</h3>${ui.chip(String(inbox.length), inbox.length ? "warn" : "ok")}</div><div class="queue mt8">${inbox.map((i) => qi("?", `<a href="${i.link}" style="color:inherit">${esc(i.text)}</a>`, i.due ? "due " + esc(i.due) : "")).join("") || ui.empty("Nothing right now. Thank you.")}</div></div>
      <div class="card"><h3>What we changed along the way</h3><div class="small muted">Plain-language notes on corrections made to your return.</div><div class="queue mt8">${approved.map((a) => qi("✓", esc(a.label), `${esc(a.note || "").slice(0, 100)}`)).join("") || ui.empty("No corrections have been approved yet.")}</div></div></div>${guideCard()}`;
  }

  ui.views.overview = () => {
    const r = WP.me().role;
    return { preparer, reviewer, partner, firm_administrator: admin, quality_reviewer: qa, client }[r]();
  };
})();
