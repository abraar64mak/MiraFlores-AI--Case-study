/* Findings: errors found by independent checks, with evidence, estimated tax effect and one-click proposals. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;
  const sevCls = { error: "err", warning: "warn", info: "info", ok: "ok" };
  const stChip = (s) => ui.chip(s, { open: "warn", accepted: "adj", resolved: "ok", dismissed: "" }[s] || "");
  const eff = (f) => {
    const fed = Math.round(f.effect.fed), ca = Math.round(f.effect.ca);
    return fed || ca ? `<span class="mono small ${fed + ca > 0 ? "pos" : "neg"}" title="Estimated change in tax if the suggested adjustments are made (change × rate)">fed ${U.signed(fed)} · CA ${U.signed(ca)}</span>` : "";
  };

  ui.findingCard = (f, open) => {
    const st = WP.findingState(f.id);
    const hasSug = f.suggest && f.suggest.length;
    const linked = WP.adjList().filter((a) => a.findingId === f.id);
    return `<details class="card finding ${sevCls[f.sev]}" id="f-${f.id}" ${open ? "open" : ""}><summary>
      <input type="checkbox" class="fchk" value="${f.id}" ${hasSug ? "" : "disabled"} onclick="event.stopPropagation()" aria-label="Select">
      ${ui.sev(f.sev)} <b class="grow">${esc(f.title)}</b>${f.needs ? ui.chip("needs " + f.needs, "info") : ""} ${eff(f)} ${stChip(st.status)}</summary>
      <div class="body">
        <div>${esc(f.summary)}</div>
        ${f.why ? `<div class="small muted"><b>How it was caught:</b> ${esc(f.why)}${f.source === "engine" ? " (engine diagnostic)" : " (independent check; the engine did not flag it)"}</div>` : ""}
        ${f.refs.length ? `<div><div class="tiny muted mb8">EVIDENCE</div>${ui.refs(f.refs)}</div>` : ""}
        ${f.keys.length ? `<div><div class="tiny muted mb8">LINES AFFECTED</div><div class="refs">${f.keys.map((k) => `<a class="ref" data-act="trace" data-key="${esc(k)}">${esc(k)} = ${esc(ui.fmtVal(WP.live().ev.get(k)))}</a>`).join("")}</div></div>` : ""}
        ${hasSug ? `<div class="col gap4">${f.suggest.map((s) => `<div class="suggest"><div class="grow"><b>${esc(s.label)}</b><div class="tiny muted">${esc(s.target)} · ${esc(s.note)}</div></div>
          <span class="mono small ${s.effect.taxFed + s.effect.taxCA > 0 ? "pos" : "neg"}">fed ${U.signed(Math.round(s.effect.taxFed))} · CA ${U.signed(Math.round(s.effect.taxCA))}</span>
          <button class="btn sm" data-act="adj-propose" data-fid="${f.id}" data-sid="${s.sid}">Propose</button></div>`).join("")}
          ${f.suggest.length > 1 ? `<div><button class="btn sm primary" data-act="adj-propose" data-fid="${f.id}" data-sid="all">Propose all ${f.suggest.length} (one undo)</button></div>` : ""}</div>` : ""}
        ${linked.length ? `<div class="small"><b>Proposed from this finding:</b> ${linked.map((a) => `${esc(a.target)} ${ui.adjStatus(a)}`).join(" · ")}</div>` : ""}
        ${st.note ? `<div class="small"><b>${esc(st.name || "")}:</b> ${esc(st.note)}</div>` : ""}
        <div class="row wrap">
          ${f.needs === "client" || f.needs === "evidence" ? `<button class="btn sm" data-act="thread-new" data-kind="client_question" data-title="${esc(f.title.slice(0, 90))}" data-text="${esc("Hello, we have a question about your return: " + f.summary.slice(0, 260))}" data-target="${f.id}">Ask the client</button>` : ""}
          <button class="btn sm" data-act="thread-new" data-kind="colleague_question" data-title="${esc(f.title.slice(0, 90))}" data-target="${f.id}">Ask a colleague</button>
          ${ui.aiDraftBtn ? ui.aiDraftBtn(f) : ""}
          ${f.needs === "decision" || f.kind === "judgment" || f.kind === "outside_filing" ? `<button class="btn sm" data-act="decision-add" data-fid="${f.id}" data-title="${esc(f.title.slice(0, 100))}" data-target="${f.id}" data-kind="${f.kind === "outside_filing" ? "judgment" : "judgment"}">Record decision</button>` : ""}
          <span class="grow"></span>
          ${st.status !== "resolved" ? `<button class="btn sm" data-act="finding-set" data-fid="${f.id}" data-st="resolved">Resolve</button>` : ""}
          ${st.status === "open" ? `<button class="btn sm" data-act="finding-set" data-fid="${f.id}" data-st="dismissed">Dismiss</button>` : `<button class="btn sm" data-act="finding-set" data-fid="${f.id}" data-st="open">Reopen</button>`}
        </div>
      </div></details>`;
  };

  ui.views.findings = (r) => {
    const all = WP.findings, f = r.q.f || "open";
    const filt = {
      open: (x) => (x.sev === "error" || x.sev === "warning") && WP.findingState(x.id).status === "open",
      all: () => true,
      error: (x) => x.sev === "error",
      done: (x) => WP.findingState(x.id).status !== "open" || x.sev === "ok" || x.sev === "info",
    }[f] || (() => true);
    const list = all.filter(filt);
    const open = all.filter((x) => (x.sev === "error" || x.sev === "warning") && WP.findingState(x.id).status === "open");
    const potential = list.reduce((s, x) => s + (x.effect.fed || 0), 0), potCA = list.reduce((s, x) => s + (x.effect.ca || 0), 0);
    const vars = WP.variances();
    const focus = r.args[0];
    return `<div class="pagehead"><div><h1>Findings</h1><div class="sub">Checks that do not trust the engine or the extraction confidence. ${all.filter((x) => x.sev === "error").length} error-level findings; none of them is in the engine's own diagnostics.</div></div><div class="grow"></div>
      <button class="btn primary" data-act="fnd-bulk">Propose selected (one batch)</button></div>
      <div class="grid g4 mb8">
        <div class="card">${ui.kpi("Open errors and warnings", `<span class="${open.length ? "pos" : "neg"}">${open.length}</span>`, `${all.filter((x) => x.sev === "error").length} errors in total`)}</div>
        <div class="card">${ui.kpi("Federal tax effect if all proposed", `${U.signed(Math.round(potential))}`, "estimate: change × rate", potential > 0 ? "pos" : "neg")}</div>
        <div class="card">${ui.kpi("California tax effect", `${U.signed(Math.round(potCA))}`, "estimate", potCA > 0 ? "pos" : "neg")}</div>
        <div class="card">${ui.kpi("Prior-year variances to explain", `${vars.filter((v) => !v.explained).length}`, `${vars.length} flagged (over ${WP.store.state.standards.variance_percent}% and ${U.money(WP.store.state.standards.variance_amount)})`)}</div></div>
      <div class="tabs">${[["open", "Open"], ["error", "Errors"], ["done", "Resolved / informational"], ["all", "All"]].map(([k, l]) => `<a href="#/findings?f=${k}" class="${f === k ? "on" : ""}">${l}</a>`).join("")}<a href="#/findings/variances" class="${focus === "variances" ? "on" : ""}">Prior-year variances (${vars.length})</a></div>
      ${focus === "variances" ? variancesHtml(vars) : `<div class="col">${list.map((x) => ui.findingCard(x, x.id === focus)).join("") || ui.empty("Nothing here.")}</div>`}`;
  };
  ui.post0 = null;

  function variancesHtml(vars) {
    return `<div class="row mb8"><div class="small muted grow">Flag if the change is over ${WP.store.state.standards.variance_percent}% <b>and</b> over ${U.money(WP.store.state.standards.variance_amount)} (firm standard; editable in Firm). Select rows to record one explanation for several lines.</div><button class="btn primary sm" data-act="var-explain">Explain selected</button></div>
      <div class="tablewrap"><table><thead><tr><th></th><th>Line</th><th>Description</th><th class="n">2024 filed</th><th class="n">2025</th><th class="n">Change</th><th class="n">%</th><th>Explanation</th></tr></thead><tbody>
      ${vars.map((v) => `<tr><td><input type="checkbox" class="vchk" value="${esc(v.key)}"></td><td class="mono small">${esc(v.key)}</td><td>${esc(v.label.slice(0, 60))}</td><td class="n">${U.money(v.py)}</td><td class="n">${ui.num(v.key)}</td><td class="n ${v.diff > 0 ? "pos" : "neg"}">${U.signed(Math.round(v.diff))}</td><td class="n">${isFinite(v.pct) ? Math.round(v.pct * 100) + "%" : "new"}</td>
      <td class="small">${v.explained ? `${ui.chip("explained", "ok")} ${esc(v.notes.slice(-1)[0].text.slice(0, 90))}` : ui.chip("needs explanation", "warn")}</td></tr>`).join("")}</tbody></table></div>`;
  }
  ui.acts["var-explain"] = async () => {
    if (!ui.guard("note")) return;
    const keys = Array.from(document.querySelectorAll("input.vchk:checked")).map((c) => c.value);
    if (!keys.length) return ui.toast("Select lines first.");
    const r = await ui.form({ title: `Explain ${keys.length} variance(s)`, intro: "One explanation can cover several lines (for example: moved states, sold the rental, started the ISO exercise).", fields: [{ name: "text", label: "Explanation", type: "textarea", required: true }], submit: "Record" });
    if (!r) return;
    const batch = ui.batch();
    keys.forEach((k) => WP.store.append("note.add", { target: k, kind: "variance", text: r.text }, { batch }));
    ui.toast(`${keys.length} variance explanation(s) recorded.`);
  };
  ui.acts["fnd-bulk"] = () => {
    const ids = Array.from(document.querySelectorAll("input.fchk:checked")).map((c) => c.value);
    if (!ids.length) return ui.toast("Tick findings to propose their suggested adjustments together.");
    if (!ui.guard("propose")) return;
    const batch = ui.batch();
    let n = 0;
    ids.forEach((id) => {
      const f = WP.findingById[id];
      (f.suggest || []).forEach((s) => {
        WP.store.append("adj.propose", { id: U.uid("adj"), target: s.target, mode: s.mode, amount: s.amount, category: s.category, sign: s.sign, reason: `${f.title}. ${s.note}`, note: s.note, label: s.label, findingId: f.id, evidence: f.refs, area: WP.areaOfKey(s.target) }, { batch });
        n++;
      });
      WP.store.append("finding.set", { id: f.id, status: "accepted", note: "Proposed in bulk" }, { batch });
    });
    ui.toast(`${n} adjustment(s) from ${ids.length} findings proposed as one batch. Undo (↶) reverses all of them.`);
  };
})();
