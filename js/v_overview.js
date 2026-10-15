/* Overview: where the return stands, what blocks filing, what changed since I last looked. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;

  /* "since I last looked": events by others after my last-seen marker + claims whose value moved */
  ui.sinceLast = () => {
    const S = WP.store.state, me = WP.store.userId, since = S.seen[me] || 0;
    const evs = WP.store.events.filter((e) => e.i > since && e.actor.id !== me && !["view.log", "seen.set"].includes(e.type));
    return { since, evs };
  };
  ui.describeEvent = (e) => {
    const p = e.payload || {};
    const t = {
      "adj.propose": () => `proposed ${p.mode === "set" ? "set" : "change"} on ${p.target} (${p.label || p.reason || ""})`.slice(0, 140),
      "adj.decide": () => `${p.decision}d adjustment ${p.id.slice(0, 8)}${p.note ? ": " + p.note : ""}`,
      "adj.revert": () => `reverted an adjustment: ${p.note || ""}`,
      "finding.set": () => `marked finding ${p.id} ${p.status}`,
      "verify.add": () => `verified ${p.target} (${(p.vtype || "").replace(/_/g, " ")})`,
      "thread.open": () => `opened ${String(p.kind).replace(/_/g, " ")}: ${p.title}`,
      "thread.reply": () => `replied on a thread`,
      "thread.status": () => `${p.status} a thread`,
      "note.add": () => `attached a ${p.kind} to ${p.target}`,
      "decision.add": () => `recorded a ${p.kind.replace(/_/g, " ")}: ${p.title}`,
      "signoff.add": () => `${p.level} sign-off on ${WP.areaLabel(p.area)}`,
      "signoff.revoke": () => `revoked a sign-off`,
      "filing.release": () => `released the return for client approval`,
      "filing.esign": () => `signed Form 8879`,
      "filing.submit": () => `e-file ${p.jurisdiction}: ${p.status}`,
      "filing.freeze": () => `froze the return at filing`,
      "undo": () => `undid ${p.count} change(s)`,
      "standards.set": () => `changed firm standards`,
      "time.add": () => `logged ${p.hours}h on ${WP.areaLabel(p.area)}`,
    }[e.type];
    return t ? t() : e.type;
  };

  ui.views.overview = () => {
    const M = WP.M, S = WP.store.state, me = WP.me(), live = WP.live(), T = live.totals;
    const client = me.role === "client";
    const base = M.curV().v.summary;
    const open = WP.findingsBlocking();
    const steps = WP.steps();
    const done = steps.filter((s) => s.done).length;
    const blockers = WP.blockers();
    const inbox = ui.inbox();
    const sl = ui.sinceLast();
    const dF = T.federal.total_tax - base.federal.total_tax, dC = T.california.total_tax - base.california.total_tax;
    const budget = M.P.firm.budget_hours;
    const spent = {};
    S.time.forEach((t) => (spent[t.area] = (spent[t.area] || 0) + t.hours));
    const bt = U.sum(Object.values(budget)), st = U.sum(Object.values(spent));
    const fedBal = T.federal.balance_due, caBal = T.california.balance_due;

    if (client)
      return `<div class="pagehead"><div><h1>Hello, ${esc(me.name.split(" ")[0])}</h1><div class="sub">Your 2025 return, in plain terms.</div></div></div>
      <div class="grid g3">
        <div class="card">${ui.kpi("Federal", fedBal >= 0 ? `${U.money(fedBal)} due` : `${U.money(-fedBal)} refund`, "after your extension payment of 36,000")}</div>
        <div class="card">${ui.kpi("California", caBal >= 0 ? `${U.money(caBal)} due` : `${U.money(-caBal)} refund`, "part-year resident")}</div>
        <div class="card">${ui.kpi("What we need from you", `${inbox.length}`, inbox.length ? "open question(s)" : "nothing right now")}</div></div>
      ${inbox.length ? `<div class="card mt16"><h3>Questions waiting for you</h3><div class="col mt8">${inbox.map((i) => `<div class="row"><a href="${i.link}">${esc(i.text)}</a>${i.due ? `<span class="muted small">due ${esc(i.due)}</span>` : ""}</div>`).join("")}</div></div>` : ""}
      <div class="card mt16"><h3>Filing status</h3><div class="small mt8">${esc(S.filing.status === "filed" ? "Filed" : S.filing.released ? "Ready for your approval" : "Your preparer is still working on it")}. <a href="#/filing">See filing</a>.</div></div>`;

    return `<div class="pagehead"><div><h1>${esc(M.P.household.people[0].name.split(" ")[1])}-${esc(M.P.household.people[1].name.split(" ")[1])} household · 2025</h1>
      <div class="sub">Married filing jointly · moved California → Texas on 2025-07-15 · prior preparer Delta River</div></div><div class="grow"></div>
      <button class="btn" data-act="seen-mark">Mark all seen</button></div>

      <div class="grid g4">
        <div class="card">${ui.kpi("Federal total tax", U.money(Math.round(T.federal.total_tax)), `engine ${U.money(base.federal.total_tax)} · workpaper ${U.signed(Math.round(dF))}`, dF > 0 ? "pos" : "neg")}</div>
        <div class="card">${ui.kpi("Federal balance", fedBal >= 0 ? U.money(Math.round(fedBal)) + " due" : U.money(Math.round(-fedBal)) + " refund", `engine ${U.money(base.federal.balance_due)} due`, "")}</div>
        <div class="card">${ui.kpi("California total tax", U.money(Math.round(T.california.total_tax)), `engine ${U.money(base.california.total_tax)} · workpaper ${U.signed(Math.round(dC))}`, dC > 0 ? "pos" : "neg")}</div>
        <div class="card">${ui.kpi("California balance", caBal >= 0 ? U.money(Math.round(caBal)) + " due" : U.money(Math.round(-caBal)) + " refund", `engine ${U.money(-base.california.balance_due)} refund`, "")}</div></div>
      <div class="callout mt8 small">Estimates apply the engine's own per-dollar rates to each adjustment (<code>tax_effect_rates</code>); the engine cannot be rerun here. Large changes can cross thresholds.</div>

      <div class="grid g2 mt16">
        <div class="card"><div class="row"><h3 class="grow">Ready to file?</h3>${ui.chip(`${done}/${steps.length} steps`, done === steps.length ? "ok" : "warn")}</div>
          <div class="bar mt8"><i style="width:${(done / steps.length) * 100}%"></i></div>
          <div class="mt8">${steps.map((s) => `<div class="step"><span class="dot ${s.done ? "on" : ""}">${s.done ? "✓" : ""}</span><div class="grow"><div>${esc(s.label)}</div><div class="tiny muted">${esc(s.detail)}</div></div>${s.manual || /Prior-year return reviewed/.test(s.label) ? `<button class="btn sm" data-act="step-set" data-step="${esc(s.label)}" data-done="${s.done ? 0 : 1}">${s.done ? "Undo" : "Mark done"}</button>` : ""}</div>`).join("")}</div></div>
        <div class="col">
          <div class="card"><h3>What blocks filing (${blockers.length})</h3><div class="col gap4 mt8 small">${blockers.slice(0, 7).map((b) => `<div>${b.kind === "note" ? ui.chip("review note", "err") : ui.chip("step", "warn")} ${esc(b.text.slice(0, 130))}</div>`).join("") || '<div class="callout ok">Nothing blocks filing.</div>'}${blockers.length > 7 ? `<div class="muted">+${blockers.length - 7} more</div>` : ""}</div></div>
          <div class="card"><h3>Top open findings</h3><div class="col gap4 mt8">${open.slice(0, 6).map((f) => `<div class="row">${ui.sev(f.sev)}<a href="#/findings/${f.id}" class="grow small">${esc(f.title)}</a><span class="mono small ${f.effect.fed > 0 ? "pos" : "neg"}">${U.signed(Math.round(f.effect.fed))}</span></div>`).join("") || ui.empty("No open findings.")}</div><div class="mt8"><a href="#/findings">All findings →</a></div></div>
        </div></div>

      <div class="grid g2 mt16">
        <div class="card"><div class="row"><h3 class="grow">Since I last looked</h3>${ui.chip(sl.evs.length + " changes by others")}</div>
          <div class="col gap4 mt8 small">${sl.evs.slice(-9).reverse().map((e) => `<div><span class="muted mono tiny">${U.dt(e.ts)}</span> <b>${esc(e.actor.name)}</b> ${esc(ui.describeEvent(e))}</div>`).join("") || '<div class="muted">Nothing new from other people. Open the app in a second tab as another role to see live changes appear here.</div>'}</div></div>
        <div class="card"><h3>For me (${inbox.length})</h3><div class="col gap4 mt8 small">${inbox.map((i) => `<div><a href="${i.link}">${esc(i.text)}</a>${i.due ? ` <span class="muted">· due ${esc(i.due)}</span>` : ""}</div>`).join("") || '<div class="muted">Nothing is waiting on you.</div>'}</div>
          <h4 class="mt16">Deadlines</h4><div class="col gap4 mt8 small">${M.P.firm.deadlines.map((d) => `<div class="row"><span class="mono">${d.date}</span><span>${esc(d.what)}</span></div>`).join("")}</div></div></div>

      <div class="card mt16"><div class="row"><h3 class="grow">Time against budget</h3><span class="mono small">${U.round(st, 1)} of ${bt} h</span><button class="btn sm" data-act="time-add">Log time</button></div>
        <div class="grid g3 mt8">${Object.entries(budget).map(([k, h]) => `<div><div class="row small"><span class="grow">${esc(WP.areaLabel(k))}</span><span class="mono">${U.round(spent[k] || 0, 1)}/${h}</span></div><div class="bar ${(spent[k] || 0) > h ? "errb" : ""}"><i style="width:${Math.min(100, ((spent[k] || 0) / h) * 100)}%"></i></div></div>`).join("")}</div></div>`;
  };
  ui.acts["seen-mark"] = () => { WP.store.append("seen.set", { until: WP.store.events.length - 1 }); ui.toast("Marked as seen."); };
})();
