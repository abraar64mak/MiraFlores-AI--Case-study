/* Changes: adjustment ledger (original always kept), version comparison, what-ifs, and "since I last looked". */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;

  ui.views.changes = (r) => {
    const tab = r.args[0] || "ledger";
    const tabs = ui.tabs("changes", [["ledger", "Adjustment ledger"], ["compare", "Compare versions"], ["whatif", "What-ifs"], ["since", "Since I last looked"]], tab);
    const body = { ledger, compare, whatif, since }[tab] || ledger;
    return `<div class="pagehead"><div><h1>Changes</h1><div class="sub">Nothing is overwritten. Each adjustment is an entry with who, why and tax effect; the engine's original value stays visible.</div></div></div>${tabs}${body(r)}`;
  };

  function ledger() {
    const S = WP.store.state, live = WP.live(), T = live.totals;
    const adjs = WP.adjList();
    const me = WP.me();
    const live2 = WP.live({ approvedOnly: true });
    const eff = (a) => `<span class="mono small ${a.effect.taxFed + a.effect.taxCA > 0 ? "pos" : "neg"}">fed ${U.signed(Math.round(a.effect.taxFed))}<br>CA ${U.signed(Math.round(a.effect.taxCA))}</span>`;
    return `<div class="grid g3 mb8">
        <div class="card">${ui.kpi("In the return now (proposed + approved)", String(adjs.filter((a) => WP.isLive(a)).length), `federal ${U.signed(Math.round(T.e.taxFed))} · California ${U.signed(Math.round(T.e.taxCA))}`)}</div>
        <div class="card">${ui.kpi("Approved only", String(adjs.filter((a) => a.status === "approved").length), `federal ${U.signed(Math.round(live2.totals.e.taxFed))} · California ${U.signed(Math.round(live2.totals.e.taxCA))}`)}</div>
        <div class="card">${ui.kpi("Awaiting approval", String(adjs.filter((a) => a.status === "proposed").length), `rule: over ${U.money(S.standards.partner_threshold)} effect needs a partner`)}</div></div>
      <div class="row wrap mb8"><button class="btn primary" data-act="adj-new">+ New adjustment</button><button class="btn" data-act="adj-bulk" data-dec="approve">Approve selected</button><button class="btn" data-act="adj-bulk" data-dec="reject">Reject selected</button><button class="btn" data-act="adj-bulk" data-dec="revert">Revert selected</button><span class="grow"></span><button class="btn" data-act="undo">↶ Undo my last</button><button class="btn" data-act="redo">↷ Redo</button></div>
      <div class="tablewrap"><table><thead><tr><th></th><th>Status</th><th>Line</th><th>Change</th><th>Why (author)</th><th class="n">Tax effect</th><th></th></tr></thead><tbody>
      ${adjs.slice().reverse().map((a) => {
        const l = WP.M.line(a.target);
        const canAp = a.status === "proposed" && WP.can("approve", { adj: a }).ok;
        return `<tr class="${a.status === "reverted" || a.status === "rejected" ? "sub" : ""}"><td><input type="checkbox" class="adjchk" value="${a.id}"></td><td>${ui.adjStatus(a)}</td>
          <td>${l ? `<a class="num" data-act="trace" data-key="${esc(a.target)}">${esc(a.target)}</a><div class="tiny muted">${esc(l.label.slice(0, 44))}</div>` : esc(a.target)}</td>
          <td class="mono small">${a.mode === "set" ? "set to " : ""}${esc(typeof a.amount === "number" ? ui.fmtVal(a.amount) : a.amount)}${l && a.mode === "set" ? `<div class="tiny muted">was ${esc(ui.fmtVal(l.value))}</div>` : ""}</td>
          <td class="small">${esc((a.reason || "").slice(0, 160))}<div class="tiny muted">${esc(a.authorName)} (${esc(WP.roleLabel(a.authorRole))}) · ${U.dt(a.ts)}${a.findingId ? ` · from <a href="#/findings/${esc(a.findingId)}">${esc(a.findingId)}</a>` : ""}</div>${a.decisions.map((d) => `<div class="tiny"><b>${esc(d.name)}</b> ${esc(d.decision)}${d.note ? ": " + esc(d.note) : ""}</div>`).join("")}</td>
          <td class="n">${eff(a)}</td>
          <td class="nowrap">${a.status === "proposed" ? `<button class="btn sm ${canAp ? "" : "off"}" data-act="adj-decide" data-id="${a.id}" data-dec="approve" title="${canAp ? "" : esc(WP.can("approve", { adj: a }).why)}">Approve</button> <button class="btn sm ${canAp ? "" : "off"}" data-act="adj-decide" data-id="${a.id}" data-dec="reject">Reject</button> ` : ""}${a.status === "proposed" || a.status === "approved" ? `<button class="btn sm" data-act="adj-whatif" data-id="${a.id}">${a.whatif ? "Include" : "What-if"}</button> <button class="btn sm" data-act="adj-revert" data-id="${a.id}">Revert</button>` : ""}</td></tr>`;
      }).join("") || `<tr><td colspan="7" class="muted">No adjustments yet. Start from <a href="#/findings">Findings</a>.</td></tr>`}</tbody></table></div>`;
  }

  /* version comparison: v1 → v2 → v3 → live workpaper */
  function compare(r) {
    const M = WP.M, ids = [...M.versionIds, "live"];
    const a = r.q.a || "v2", b = r.q.b || "v3";
    const sel = (name, v) => `<select data-change="cmp" data-name="${name}">${ids.map((i) => `<option ${i === v ? "selected" : ""}>${i}</option>`).join("")}</select>`;
    const vals = (id) => {
      if (id === "live") { const ev = WP.live().ev; return Object.fromEntries(M.curV().lines.map((l) => [l.key, ev.get(l.key)])); }
      return Object.fromEntries(M.ver(id).lines.map((l) => [l.key, l.value]));
    };
    const A = vals(a), B = vals(b), lbl = {};
    M.versionIds.forEach((v) => M.ver(v).lines.forEach((l) => (lbl[l.key] = lbl[l.key] || l)));
    const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k]));
    const meta = (id) => (id === "live" ? "v3 plus every proposed and approved adjustment" : M.ver(id).v.trigger + " (" + U.date(M.ver(id).v.computed_at) + ")");
    const byArea = {};
    keys.forEach((k) => { const ar = WP.areaOfLine(lbl[k]); (byArea[ar] ||= []).push(k); });
    const dsum = (id) => (id === "live" ? M.curV().v.summary : M.ver(id).v.summary);
    const s = (id) => {
      const x = id === "live" ? WP.live().totals : { federal: dsum(id).federal, california: dsum(id).california };
      return `fed tax ${U.money(Math.round(x.federal.total_tax))} · bal ${U.money(Math.round(x.federal.balance_due))} | CA tax ${U.money(Math.round(x.california.total_tax))}`;
    };
    const used = (id) => (id === "live" ? M.ver("v3").v.documents_used : M.ver(id).v.documents_used);
    const dAdd = used(b).filter((d) => !used(a).includes(d)), dRem = used(a).filter((d) => !used(b).includes(d));
    return `<div class="row wrap mb8">Compare ${sel("a", a)} with ${sel("b", b)}<span class="muted small">${keys.length} lines differ</span></div>
      <div class="grid g2 mb8"><div class="card small"><b>${a}</b><div class="muted">${esc(meta(a))}</div><div class="mono mt8">${esc(s(a))}</div></div><div class="card small"><b>${b}</b><div class="muted">${esc(meta(b))}</div><div class="mono mt8">${esc(s(b))}</div></div></div>
      ${dAdd.length || dRem.length ? `<div class="callout small mb8"><b>Documents:</b> ${dAdd.length ? "added " + dAdd.map((d) => `<a href="#/doc/${d}">${d}</a>`).join(", ") : ""} ${dRem.length ? "· superseded/removed " + dRem.map((d) => `<a href="#/doc/${d}">${d}</a>`).join(", ") : ""}</div>` : ""}
      <div class="tablewrap"><table><thead><tr><th>Area</th><th>Line</th><th>Description</th><th class="n">${a}</th><th class="n">${b}</th><th class="n">Δ</th></tr></thead><tbody>
      ${Object.entries(byArea).map(([ar, ks]) => ks.map((k, i) => { const x = A[k], y = B[k], d = typeof x === "number" && typeof y === "number" ? y - x : null;
        return `<tr class="click" data-act="trace" data-key="${esc(k)}"><td class="small muted">${i === 0 ? esc(WP.areaLabel(ar)) : ""}</td><td class="mono small">${esc(k)}</td><td class="small">${esc(lbl[k].label.slice(0, 60))}</td><td class="n">${x === undefined ? '<span class="muted">—</span>' : esc(ui.fmtVal(x))}</td><td class="n">${y === undefined ? '<span class="muted">—</span>' : esc(ui.fmtVal(y))}</td><td class="n ${d > 0 ? "pos" : d < 0 ? "neg" : ""}">${d === null ? "" : U.signed(Math.round(d * 100) / 100)}</td></tr>`; }).join("")).join("") || `<tr><td colspan="6" class="muted">No differences.</td></tr>`}</tbody></table></div>`;
  }
  ui.acts.cmp = (el) => {
    const q = { ...ui.route.q };
    q[el.dataset.name] = el.value;
    ui.go(`#/changes/compare?a=${q.a || "v2"}&b=${q.b || "v3"}`);
  };

  function whatif() {
    const M = WP.M, P = M.P, adjs = WP.adjList().filter((a) => a.whatif && (a.status === "proposed" || a.status === "approved"));
    const withW = WP.live({ whatif: true }).totals, without = WP.live().totals;
    const ex = P.what_if.extension;
    return `<div class="grid g2">
      <div class="card"><h3>Your what-ifs</h3><div class="small muted mt8">Adjustments marked what-if stay out of the return. Create one with the “What-if only” box, or flip one in the ledger.</div>
        <div class="mt8"><button class="btn" data-act="adj-new" data-whatif="1">+ New what-if</button></div>
        <table class="mt8"><tbody>${adjs.map((a) => `<tr><td class="mono small">${esc(a.target)}</td><td class="small">${esc(a.label || a.reason)}</td><td class="n mono small">fed ${U.signed(Math.round(a.effect.taxFed))}</td></tr>`).join("") || `<tr><td class="muted">None.</td></tr>`}</tbody></table>
        <div class="callout mt8 small">With what-ifs: federal tax ${U.money(Math.round(withW.federal.total_tax))}, balance ${U.money(Math.round(withW.federal.balance_due))}. Without: ${U.money(Math.round(without.federal.total_tax))}, ${U.money(Math.round(without.federal.balance_due))}.</div></div>
      <div class="card"><h3>The April extension estimate</h3><div class="small mt8">From ${esc(ex.based_on_version)} (${U.date(ex.computed_at)}): federal balance ${U.money(ex.federal.estimated_balance)} → paid ${U.money(ex.federal.paid_with_form_4868)} with Form 4868 (${esc(ex.federal.rule)}). California ${U.money(-ex.california.estimated_balance)} refund, ${U.money(ex.california.paid_with_ftb_3519)} paid with FTB 3519.</div></div></div>
      <h3 class="mt16 mb8">Engine alternatives (engine results, not our estimate)</h3>
      <div class="grid g2">${P.what_if.alternatives.map((alt) => `<div class="card"><b>${esc(alt.description)}</b><div class="small muted mt8">choices: ${esc(JSON.stringify(alt.choices))} · base ${esc(alt.base_version)}</div>
        <div class="row mt8"><div class="kpi"><div class="l">Federal tax change</div><div class="v ${alt.federal.total_tax_change > 0 ? "pos" : "neg"}">${U.signed(alt.federal.total_tax_change)}</div></div><div class="kpi"><div class="l">California tax change</div><div class="v ${alt.california.total_tax_change > 0 ? "pos" : "neg"}">${U.signed(alt.california.total_tax_change)}</div></div><div class="kpi"><div class="l">Lines changed</div><div class="v">${alt.changed_lines.length}</div></div></div>
        <details class="mt8"><summary class="small">Show changed lines</summary><table class="small"><tbody>${alt.changed_lines.slice(0, 14).map((c) => `<tr><td class="mono">${esc(c.key)}</td><td class="n">${esc(ui.fmtVal(c.old))}</td><td class="n">→ ${esc(ui.fmtVal(c.new))}</td></tr>`).join("")}</tbody></table></details></div>`).join("")}</div>`;
  }

  function since() {
    const S = WP.store.state, me = WP.store.userId;
    const sl = ui.sinceLast(), seen = S.seen[me] || 0;
    const old = WP.live({ upTo: seen }).ev, now = WP.live().ev, M = WP.M;
    const moved = M.curV().lines.filter((l) => old.get(l.key) !== now.get(l.key));
    return `<div class="row mb8"><span class="small muted">Last marked seen at event #${seen}. ${sl.evs.length} change(s) by other people since then.</span><span class="grow"></span><button class="btn" data-act="seen-mark">Mark all seen</button></div>
      <div class="grid g2"><div class="card"><h3>Events</h3><div class="col gap4 mt8 small">${sl.evs.slice().reverse().map((e) => `<div><span class="mono tiny muted">${U.dt(e.ts)}</span> <b>${esc(e.actor.name)}</b> ${esc(ui.describeEvent(e))}</div>`).join("") || '<span class="muted">Nothing new.</span>'}</div></div>
      <div class="card"><h3>Numbers that moved (${moved.length})</h3><div class="tablewrap mt8" style="max-height:50vh"><table class="small"><tbody>${moved.slice(0, 60).map((l) => `<tr class="click" data-act="trace" data-key="${esc(l.key)}"><td class="mono">${esc(l.key)}</td><td>${esc(l.label.slice(0, 40))}</td><td class="n">${esc(ui.fmtVal(old.get(l.key)))} → ${esc(ui.fmtVal(now.get(l.key)))}</td></tr>`).join("") || `<tr><td class="muted">No value has changed since you last looked.</td></tr>`}</tbody></table></div></div></div>`;
  }
})();
