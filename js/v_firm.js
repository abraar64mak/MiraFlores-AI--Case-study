/* Firm: standards, time against budget, search, sensitive-data view log, activity, season replay. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;

  ui.views.firm = (r) => {
    const tab = r.args[0] || "standards";
    const tabs = [["standards", "Standards"], ["time", "Time and budget"], ["search", "Search"], ["viewlog", "Sensitive-data view log"], ["retention", "Retention"]];
    return `<div class="pagehead"><div><h1>Firm</h1><div class="sub">Firm-wide standards, time against budget, search, and who looked at sensitive data.</div></div></div>${ui.tabs("firm", tabs, tab)}${{ standards, time, search, viewlog, retention }[tab](r)}`;
  };

  function standards() {
    const st = WP.store.state.standards, can = WP.can("standards").ok;
    return `<div class="callout small mb8">These are the firm's standards. They apply to every engagement and are enforced by the app (the partner threshold gates approvals, required steps gate release, the variance rule builds the variance register). ${can ? "As firm administrator you can change them; each change is logged." : "Only the firm administrator can change them."}</div>
      <div class="grid g2"><div class="card"><h3>Review thresholds</h3><table class="mt8"><tbody>
        <tr><td>Flag prior-year variance when change exceeds</td><td class="n mono">${st.variance_percent}%</td></tr><tr><td>…and exceeds</td><td class="n mono">${U.money(st.variance_amount)}</td></tr>
        <tr><td>Adjustment needs partner sign-off above tax effect of</td><td class="n mono">${U.money(st.partner_threshold)}</td></tr><tr><td>Records retained after filing</td><td class="n mono">${st.retention_years} years</td></tr></tbody></table>
        <div class="mt8"><button class="btn ${can ? "" : "off"}" data-act="std-thresholds">Edit thresholds</button></div></div>
      <div class="card"><h3>Review levels and verification types</h3><div class="small mt8">Levels: ${WP.M.P.firm.starter_standards.review_levels.join(" → ")}</div><div class="refs mt8">${st.verification_types.map((t) => ui.chip(t.replace(/_/g, " "))).join("")}</div>
        <div class="mt8"><button class="btn ${can ? "" : "off"}" data-act="std-vtypes">Edit verification types</button></div></div>
      <div class="card"><h3>Rules enforced</h3><ol class="small">${st.rules.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><button class="btn ${can ? "" : "off"}" data-act="std-rules">Edit rules text</button></div>
      <div class="card"><h3>Required steps before filing</h3><ol class="small">${st.required_steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><div class="tiny muted">Steps with automatic tests: ${esc("engagement, identity, documents, variances, carryovers, payments, due diligence, diagnostics, sign-offs, client approval")}. Added steps are manual.</div><button class="btn ${can ? "" : "off"}" data-act="std-steps">Edit steps</button></div></div>
      <div class="card mt16"><h3>Staff, credentials and clearance</h3><table class="mt8 small"><tbody>${WP.M.staff.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(WP.roleLabel(s.role))}</td><td>${esc(s.credential || "—")}</td><td>${s.sensitive_data_clearance ? ui.chip("clearance", "ok") : ui.chip("no clearance", "warn")}</td><td class="muted">PTIN ${esc(WP.M.P.firm.firm_identity.ptins[s.id] || "—")}</td></tr>`).join("")}</tbody></table><div class="small muted mt8">Paid preparer signing returns: ${esc(ui.userName(WP.M.P.firm.firm_identity.paid_preparer_signing_returns))}. EFIN ${esc(WP.M.P.firm.firm_identity.efin)}.</div></div>`;
  }
  const patch = async (title, fields, fn) => {
    if (!ui.guard("standards")) return;
    const r = await ui.form({ title, fields, submit: "Save" });
    if (r) { WP.store.append("standards.set", { patch: fn(r) }); ui.toast("Standards updated and logged."); }
  };
  ui.acts["std-thresholds"] = () => { const s = WP.store.state.standards; patch("Edit thresholds", [{ name: "vp", label: "Variance percent", type: "number", value: s.variance_percent }, { name: "va", label: "Variance amount", type: "number", value: s.variance_amount }, { name: "pt", label: "Partner threshold (tax effect)", type: "number", value: s.partner_threshold }, { name: "ry", label: "Retention years", type: "number", value: s.retention_years }], (r) => ({ variance_percent: r.vp, variance_amount: r.va, partner_threshold: r.pt, retention_years: r.ry })); };
  ui.acts["std-vtypes"] = () => patch("Verification types (one per line)", [{ name: "t", label: "Types", type: "textarea", value: WP.store.state.standards.verification_types.join("\n") }], (r) => ({ verification_types: r.t.split("\n").map((x) => x.trim()).filter(Boolean) }));
  ui.acts["std-rules"] = () => patch("Rules (one per line)", [{ name: "t", label: "Rules", type: "textarea", value: WP.store.state.standards.rules.join("\n") }], (r) => ({ rules: r.t.split("\n").map((x) => x.trim()).filter(Boolean) }));
  ui.acts["std-steps"] = () => patch("Required steps (one per line)", [{ name: "t", label: "Steps", type: "textarea", value: WP.store.state.standards.required_steps.join("\n") }], (r) => ({ required_steps: r.t.split("\n").map((x) => x.trim()).filter(Boolean) }));

  function time() {
    const S = WP.store.state, budget = WP.M.P.firm.budget_hours;
    const by = {}, who = {};
    S.time.forEach((t) => { by[t.area] = (by[t.area] || 0) + t.hours; who[t.name] = (who[t.name] || 0) + t.hours; });
    return `<div class="row mb8"><span class="grow small muted">Budget from the engagement: ${U.sum(Object.values(budget))} hours.</span><button class="btn primary" data-act="time-add">Log time</button></div>
      <div class="tablewrap"><table><thead><tr><th>Area</th><th class="n">Budget</th><th class="n">Logged</th><th class="n">Left</th><th style="width:30%"></th></tr></thead><tbody>${Object.entries(budget).map(([k, h]) => { const x = by[k] || 0; return `<tr><td>${esc(WP.areaLabel(k))}</td><td class="n">${h}</td><td class="n">${U.round(x, 2)}</td><td class="n ${x > h ? "pos" : ""}">${U.round(h - x, 2)}</td><td><div class="bar ${x > h ? "errb" : x > h * 0.8 ? "warnb" : ""}"><i style="width:${Math.min(100, (x / h) * 100)}%"></i></div></td></tr>`; }).join("")}</tbody></table></div>
      <h3 class="mt16 mb8">Entries</h3><div class="tablewrap"><table><thead><tr><th>When</th><th>Who</th><th>Area</th><th class="n">Hours</th><th>Note</th></tr></thead><tbody>${S.time.slice().reverse().map((t) => `<tr><td class="mono small">${U.dt(t.ts)}</td><td>${esc(t.name)}</td><td>${esc(WP.areaLabel(t.area))}</td><td class="n">${t.hours}</td><td class="small">${esc(t.note || "")}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No time logged.</td></tr>`}</tbody></table></div>`;
  }

  /* search across documents, values, claims, findings, conversations, decisions, log */
  function search(r) {
    const q = (r.q.q || "").trim(), ql = q.toLowerCase();
    const box = `<form onsubmit="event.preventDefault();location.hash='#/firm/search?q='+encodeURIComponent(this.q.value)" class="row mb8"><input name="q" value="${esc(q)}" placeholder="Search documents, numbers, lines, findings, notes…" style="width:420px"><button class="btn primary">Search</button></form>`;
    if (!ql) return box + ui.empty("Search across all 74 documents (printed text), 3,000 extracted values, 600+ return lines, findings, conversations and decisions. Sensitive values are masked unless revealed.");
    const M = WP.M, S = WP.store.state, out = [];
    const snip = (t, i) => esc(t.slice(Math.max(0, i - 40), i + ql.length + 60).replace(/\s+/g, " "));
    const grp = (title, items) => items.length ? `<div class="card mt8"><h4>${title} (${items.length})</h4><div class="col gap4 mt8 small">${items.slice(0, 14).join("")}</div></div>` : "";
    const docs = [];
    M.docs.forEach((d) => { if (d.title.toLowerCase().includes(ql)) docs.push(`<div><a href="#/doc/${d.id}"><b>${d.id}</b> ${esc(d.title)}</a></div>`); d.pages.forEach((p) => { const t = ui.maskText(p.printed_content, d.id), i = t.toLowerCase().indexOf(ql); if (i >= 0) docs.push(`<div><a href="#/doc/${d.id}?p=${p.page}"><b>${d.id} p${p.page}</b></a> … ${snip(t, i)} …</div>`); }); });
    const vals = M.P.extracted_values.filter((e) => e.value_type !== "ssn" && e.value_type !== "account_number" && (String(e.text_as_read).toLowerCase().includes(ql) || String(e.value).toLowerCase().includes(ql) || e.label.toLowerCase().includes(ql))).map((e) => `<div><a href="#/doc/${e.document_id}?p=${e.page}&ev=${e.id}"><b>${e.document_id} p${e.page}</b></a> ${esc(e.label)}: <span class="mono">${esc(String(e.text_as_read || e.value))}</span> <span class="muted">${e.confidence}</span></div>`);
    const claims = M.curV().lines.filter((l) => l.key.toLowerCase().includes(ql) || l.label.toLowerCase().includes(ql) || String(l.value).toLowerCase().includes(ql)).map((l) => `<div><a class="num" data-act="trace" data-key="${esc(l.key)}">${esc(l.key)}</a> ${esc(l.label.slice(0, 70))} <span class="mono">${esc(ui.fmtVal(l.value))}</span></div>`);
    const fnd = WP.findings.filter((f) => (f.title + f.summary).toLowerCase().includes(ql)).map((f) => `<div>${ui.sev(f.sev)} <a href="#/findings/${f.id}">${esc(f.title)}</a></div>`);
    const th = S.threadOrder.map((id) => S.threads[id]).filter((t) => WP.me().role !== "client" || t.visibility === "client").filter((t) => (t.title + t.messages.map((m) => m.text).join(" ")).toLowerCase().includes(ql)).map((t) => `<div><a href="#/people/threads/${t.id}">${esc(t.title)}</a> ${ui.chip(t.status)}</div>`);
    const cl = [...M.P.client.questionnaire.filter((x) => (x.question + x.answer).toLowerCase().includes(ql)).map((x) => `<div>${ui.refChip(x.id)} ${esc(x.question)} → ${esc(String(x.answer).slice(0, 90))}</div>`), ...M.P.client.messages.filter((x) => x.text.toLowerCase().includes(ql)).map((x) => `<div>${ui.refChip(x.id)} ${esc(x.text.slice(0, 120))}</div>`)];
    const dec = S.decisionOrder.map((id) => S.decisions[id]).filter((d) => (d.title + d.body).toLowerCase().includes(ql)).map((d) => `<div><b>${esc(d.title)}</b> <span class="muted">${esc(d.kind)}</span></div>`);
    return box + grp("Documents", docs) + grp("Extracted values", vals) + grp("Return lines", claims) + grp("Findings", fnd) + grp("Client answers and messages", cl) + grp("Threads", th) + grp("Decisions", dec) || box + ui.empty("No results.");
  }

  function viewlog() {
    if (!WP.can("viewlog").ok) return `<div class="callout warn">Only a partner, the firm administrator, or the quality reviewer can read the sensitive-data view log.</div>`;
    const v = WP.store.state.views;
    return `<div class="callout small mb8">Staff with clearance see SSNs, bank and account numbers and IP PINs masked until they choose to reveal them; every reveal is logged here. Staff without clearance cannot reveal.</div>
      <div class="tablewrap"><table><thead><tr><th>When</th><th>Who</th><th>Role</th><th>What was unmasked</th></tr></thead><tbody>${v.slice().reverse().map((x) => `<tr><td class="mono small">${U.dt(x.ts)}</td><td>${esc(x.name)}</td><td>${esc(WP.roleLabel(x.role))}</td><td>${esc(x.what)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No sensitive value has been unmasked.</td></tr>`}</tbody></table></div>`;
  }

  function retention() {
    const fz = WP.store.state.filing.frozen, y = WP.store.state.standards.retention_years;
    const d = fz ? new Date(fz.ts) : null;
    if (d) d.setFullYear(d.getFullYear() + y);
    return `<div class="card"><h3>Retention</h3><div class="small mt8">Records are retained ${y} years after filing, then destroyed. ${d ? `This return was filed ${U.date(fz.ts)}; destroy on or after <b>${U.date(d.toISOString())}</b>.` : "The retention clock starts when the return is filed and frozen."}</div></div>`;
  }

  /* ---------- activity feed (the event log + the scripted season) ---------- */
  ui.views.activity = (r) => {
    const P = WP.M.P;
    const chain = WP.store.verifyChain();
    const scripted = P.timeline.map((t) => ({ ts: t.at, who: t.actor ? ui.userName(t.actor) : "client / system", type: t.event.replace(/_/g, " "), text: (t.detail || "") + (t.refs && t.refs.length ? " [" + t.refs.join(", ") + "]" : ""), src: "season" }));
    const mine = WP.store.events.map((e) => ({ ts: e.ts, who: e.actor.name, type: e.type, text: ui.describeEvent(e), src: "workpaper", hash: e.hash, prev: e.prev }));
    const all = [...scripted, ...mine].sort((a, b) => a.ts.localeCompare(b.ts));
    const f = r.q.f || "";
    const list = all.filter((x) => !f || x.src === f).slice().reverse().slice(0, 400);
    return `<div class="pagehead"><div><h1>Activity</h1><div class="sub">The season as it happened (from the packet) and every change made in this workpaper. Each workpaper entry is hash-chained to the one before it.</div></div><div class="grow"></div>
      <span class="chip ${chain.ok ? "ok" : "err"}">${chain.ok ? "chain intact · " + chain.n + " events" : "chain BROKEN at event " + chain.at}</span><button class="btn" data-act="log-export">Export log (JSON)</button>${WP.can("viewlog").ok ? `<button class="btn danger" data-act="reset">Reset workpaper</button>` : ""}</div>
      <div class="row wrap mb8">${[["", "All"], ["season", "Season (packet)"], ["workpaper", "Workpaper changes"]].map(([k, l]) => `<a class="chip ${f === k ? "acc" : ""}" style="text-decoration:none" href="#/activity?f=${k}">${l}</a>`).join("")}</div>
      <div class="tablewrap"><table><thead><tr><th>When</th><th>Source</th><th>Who</th><th>What</th><th>Hash</th></tr></thead><tbody>${list.map((x) => `<tr><td class="mono small nowrap">${U.dt(x.ts)}</td><td>${ui.chip(x.src, x.src === "season" ? "info" : "acc")}</td><td>${esc(x.who)}</td><td class="small"><b>${esc(x.type)}</b> ${esc(x.text).slice(0, 220)}</td><td class="hash">${x.hash ? U.short(x.hash) : ""}</td></tr>`).join("")}</tbody></table></div>`;
  };
  ui.acts["log-export"] = () => {
    const blob = new Blob([JSON.stringify({ packet: WP.M.P.packet, sha256: WP.store.packetHash, events: WP.store.events }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "workpaper-event-log.json"; a.click();
  };

  /* ---------- season replay: state of the file as of any moment in the scripted timeline ---------- */
  ui.replayIdx = null;
  ui.views.replay = () => {
    const P = WP.M.P, tl = P.timeline.slice().sort((a, b) => a.at.localeCompare(b.at));
    const i = ui.replayIdx === null ? tl.length - 1 : ui.replayIdx;
    const at = tl[i].at;
    const docsIn = WP.M.docs.filter((d) => d.received_at <= at);
    const vers = P.return_versions.filter((v) => v.computed_at <= at);
    const v = vers[vers.length - 1];
    const staff = P.firm.staff.filter((s) => s.active_from <= at.slice(0, 10));
    const msgs = P.client.messages.filter((m) => m.sent_at <= at);
    const efile = P.tax_agency_records.efile.filter((e) => e.date <= at);
    const noticeIn = P.tax_agency_records.notices.filter((n) => n.dated <= at.slice(0, 10) && n.tax_year === 2025);
    const filed = tl.slice(0, i + 1).some((t) => t.event === "efile_accepted_federal");
    return `<div class="pagehead"><div><h1>Season replay</h1><div class="sub">Scrub through the engagement. The file is rebuilt as of that moment from the packet's timeline: what had arrived, which engine version was current, who had joined.</div></div><div class="grow"></div><button class="btn" data-act="replay-play">▶ Play</button><a class="btn" href="#/overview">Back to the live file</a></div>
      <div class="card"><div class="row"><span class="mono">${U.dt(at)}</span><b class="grow">${esc(tl[i].event.replace(/_/g, " "))}</b>${tl[i].actor ? ui.userChip(tl[i].actor) : ""}</div><input type="range" min="0" max="${tl.length - 1}" value="${i}" data-change="replay-set" style="width:100%;margin-top:8px" aria-label="Season position">
        <div class="small muted mt8">${esc(tl[i].detail || "")} ${tl[i].refs && tl[i].refs.length ? "· " + tl[i].refs.map((x) => esc(x)).join(", ") : ""}</div></div>
      <div class="grid g3 mt16">
        <div class="card"><h4>In the file</h4><div class="kpi"><div class="v">${docsIn.length}</div><div class="l">of ${WP.M.docs.length} documents received</div></div><div class="tiny muted mt8">latest: ${docsIn.slice(-4).map((d) => d.id).join(", ")}</div></div>
        <div class="card"><h4>Engine output then</h4>${v ? `<div class="kpi"><div class="v">${v.version}</div><div class="l">${esc(v.trigger.slice(0, 90))}</div></div><div class="mono small mt8">fed tax ${U.money(v.summary.federal.total_tax)} · balance ${U.money(v.summary.federal.balance_due)}<br>CA tax ${U.money(v.summary.california.total_tax)} · balance ${U.money(v.summary.california.balance_due)}</div>` : '<div class="muted small">Not computed yet.</div>'}</div>
        <div class="card"><h4>Team</h4><div class="small">${staff.map((s) => esc(s.name) + " (" + esc(WP.roleLabel(s.role)) + ")").join("<br>")}</div></div></div>
      <div class="grid g2 mt16"><div class="card"><h4>Client messages so far (${msgs.length})</h4><div class="col gap4 mt8 small">${msgs.slice(-4).map((m) => `<div><b>${esc(m.from)}</b> ${U.date(m.sent_at)}: ${esc(m.text.slice(0, 140))}</div>`).join("") || "—"}</div></div>
      <div class="card"><h4>Filing</h4><div class="col gap4 mt8 small">${filed ? ui.chip("filed and accepted", "ok") : ui.chip("not filed")}${efile.map((e) => `<div>${U.date(e.date)} ${esc(e.jurisdiction)}: ${ui.chip(e.status, e.status === "accepted" ? "ok" : e.status === "rejected" ? "err" : "warn")} ${(e.errors || []).map((x) => esc(x.message)).join("")}</div>`).join("")}${noticeIn.map((n) => `<div>${ui.chip("notice", "err")} ${esc(n.type)}: ${esc(n.items_under_examination ? n.items_under_examination.join(" | ") : n.summary)}</div>`).join("")}</div></div></div>`;
  };
  ui.acts["replay-set"] = (el) => { ui.replayIdx = +el.value; ui.render(); };
  let timer = null;
  ui.acts["replay-play"] = () => {
    if (timer) { clearInterval(timer); timer = null; return; }
    const n = WP.M.P.timeline.length;
    ui.replayIdx = 0; ui.render();
    timer = setInterval(() => { ui.replayIdx = (ui.replayIdx || 0) + 1; if (ui.replayIdx >= n - 1) { clearInterval(timer); timer = null; } if (ui.route.name === "replay") ui.render(); else { clearInterval(timer); timer = null; } }, 900);
  };
})();
