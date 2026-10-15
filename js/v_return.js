/* Return explorer and the trace drawer: any number to its exact source, rule, inputs, checks and history. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;

  /* ---------- source panel (used standalone and inside the trace drawer) ---------- */
  ui.srcPanel = (ref) => {
    const M = WP.M;
    let m;
    if ((m = /^(D\d+)p(\d+)$/.exec(ref))) {
      const d = M.docById[m[1]];
      return docHead(d, +m[2]) + ui.paper(d.id, +m[2]);
    }
    const s = M.resolveSource(ref.replace(/^thread:/, ""));
    if (/^thread:/.test(ref)) {
      const t = WP.store.state.threads[ref.slice(7)];
      return t ? `<div class="thread"><b>${esc(t.title)}</b>${t.messages.map((x) => `<div class="msg"><b>${esc(x.name)}</b> <span class="muted small">${U.dt(x.ts)}</span><div>${esc(x.text)}</div></div>`).join("")}</div>` : ui.empty("Thread not found");
    }
    if (s.kind === "ev") {
      const e = s.ev, d = s.doc;
      const claims = M.reverse().evToClaims[e.id] || [];
      return `<div class="card flat"><table><tbody>
        <tr><td class="muted">Document</td><td><b>${esc(d.id)}</b> ${esc(d.title)}</td></tr>
        <tr><td class="muted">Location</td><td>page ${e.page}, field <span class="mono">${esc(e.field)}</span> (${esc(e.label)})</td></tr>
        <tr><td class="muted">Printed as</td><td class="mono">${esc(ui.maskText(e.text_as_read || "(nothing printed)", d.id))}</td></tr>
        <tr><td class="muted">Read as</td><td class="mono">${e.value_type === "ssn" || e.value_type === "account_number" ? ui.sens(e.value, e.value_type === "ssn" ? "ssn" : "acct") : esc(String(e.value))} <span class="muted">(${esc(e.value_type)})</span></td></tr>
        <tr><td class="muted">Pipeline confidence</td><td>${confBar(e.confidence)} <span class="mono">${e.confidence}</span>${e.confidence < 0.8 ? " " + ui.chip("low", "err") : ""}</td></tr>
        <tr><td class="muted">Landed in</td><td>${claims.length ? claims.map((k) => `<a class="num" data-act="trace" data-key="${esc(k)}">${esc(k)}</a>`).join(" ") : '<span class="muted">no line cites this value</span>'}</td></tr>
        </tbody></table></div>` + ui.paper(d.id, e.page, e.id) + `<div class="row"><a class="btn sm" href="#/doc/${d.id}?p=${e.page}&ev=${e.id}" data-act="close-drawer-nav">Open the whole document</a></div>`;
    }
    const card = (title, body) => `<div class="card flat"><h4>${esc(title)}</h4><div class="mt8">${body}</div></div>`;
    if (s.kind === "qa") return card("Client questionnaire " + s.ref, `<b>${esc(s.text)}</b><div class="mt8">“${esc(s.value)}”</div><div class="muted small mt8">answered by ${esc(s.q.answered_by)} on ${U.date(s.q.answered_at)}</div>`);
    if (s.kind === "msg") return card("Client message " + s.ref, `<div class="muted small">${esc(s.q.from)} → ${esc(s.q.to)} · ${U.date(s.q.sent_at)}</div><div class="mt8">${esc(s.q.text)}</div>`);
    if (s.kind === "call") return card("Call note " + s.ref, `<div class="muted small">${esc(s.q.participants.join(", "))} · ${U.date(s.q.date)}</div><ul>${s.q.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`);
    if (s.kind === "py" || s.kind === "agency") return card(s.title, `<pre class="mono small" style="white-space:pre-wrap;margin:0">${esc(typeof s.value === "object" ? JSON.stringify(s.value, null, 1).slice(0, 3000) : String(s.value))}</pre>`);
    if (s.kind === "asset" && s.asset) {
      const a = s.asset;
      return card("Asset " + a.asset_id, `<div><b>${esc(a.description)}</b></div><div class="small muted">${esc(a.activity)} · placed in service ${esc(a.placed_in_service)} · ${esc(a.method)} · ${esc(a.life_years)} yrs</div><pre class="mono small" style="white-space:pre-wrap">${esc(JSON.stringify({ cost: a.cost, federal: a.federal, california: a.california, amt: a.amt, disposed: a.disposed }, null, 1))}</pre>`);
    }
    if (s.kind === "ref") return card(s.title, `<span class="mono">${esc(s.text)}</span>`);
    if (s.kind === "timeline") return card(s.title, esc(s.text));
    if (s.kind === "household") return card(s.title, `<div>${esc(s.p.name)} · ${esc(s.p.role)} · born ${esc(s.p.dob)}</div><div>SSN ${ui.sens(s.p.ssn, "ssn")}</div>`);
    return card(ref, esc(JSON.stringify(s)));
  };
  const confBar = (c) => `<span class="conf ${ui.confCls(c)}"><i style="width:${Math.round(c * 100)}%"></i></span>`;
  const docHead = (d, p) => `<div class="row wrap"><b>${esc(d.id)}</b><span>${esc(d.title)}</span>${ui.chip(d.extraction.status, d.extraction.status === "extracted" ? "ok" : "warn")}${d.marked_corrected ? ui.chip("CORRECTED by issuer", "warn") : ""}<span class="muted small">received ${U.date(d.received_at)} · ${esc(d.uploaded_by)}</span></div>`;

  ui.acts.src = (el) => {
    const ref = el.dataset.ref;
    if (WP.M.line(ref)) return ui.openTrace(ref);
    if (ui.drawerFn && ui.drawerFn.kind === "trace") { ui.traceSrc = ref; ui.refreshDrawer(false); return; }
    ui.drawer(ui.short(ref), () => `<div class="col">${ui.srcPanel(ref)}</div>`, { scroll: true });
  };
  ui.acts["close-drawer-nav"] = (el, e) => { ui.closeDrawer(); location.hash = el.getAttribute("href"); };

  /* ---------- trace drawer ---------- */
  ui.openTrace = (key) => {
    ui.traceKey = key;
    ui.traceSrc = null;
    const l = WP.M.line(key);
    ui.drawer(() => `${l ? l.key : key}`, () => traceHtml(ui.traceKey));
    ui.drawerFn.kind = "trace";
  };
  ui.acts.trace = (el) => ui.openTrace(el.dataset.key);

  function treeNode(key, depth, seen) {
    const M = WP.M, l = M.line(key);
    if (!l) return `<li><span class="muted">${esc(key)} (not in this version)</span></li>`;
    const ins = l.inputs || [];
    const srcs = (l.sources || []).slice(0, 4).map(ui.refChip).join(" ") + ((l.sources || []).length > 4 ? ` <span class="muted tiny">+${l.sources.length - 4}</span>` : "");
    const kids = depth < 3 && ins.length && !seen.has(key) ? `<ul class="tree">${ins.map((i) => treeNode(i, depth + 1, new Set([...seen, key]))).join("")}</ul>` : ins.length ? `<span class="muted tiny"> … ${ins.length} inputs</span>` : "";
    return `<li>${ui.num(key)} <span class="small">${esc(l.label.slice(0, 70))}</span> <span class="muted tiny">${esc(l.rule)}</span> ${srcs}${kids}</li>`;
  }

  function traceHtml(key) {
    const M = WP.M, S = WP.store.state, l = M.line(key);
    if (!l) return ui.empty("Line not found: " + key);
    const live = WP.live().ev, v = live.get(key), area = WP.areaOfLine(l);
    const rule = M.rules[l.rule] || "";
    const adjs = WP.adjList().filter((a) => a.target === key);
    const verifs = S.verifs[key] || [];
    const finds = WP.findings.filter((f) => f.keys.includes(key));
    const threads = S.threadOrder.map((id) => S.threads[id]).filter((t) => t.target === key);
    const notes = S.notes[key] || [];
    const down = M.downstream(key).slice(0, 12);
    const so = ["reviewer", "partner"].map((lv) => [lv, WP.currentSignoff(area, lv)]);
    const srcRefs = l.sources || [];
    const sel = ui.traceSrc || srcRefs.find((s) => /^ev-/.test(s)) || srcRefs[0];
    const hist = WP.store.events.filter((e) => (e.payload && (e.payload.target === key)) || (e.type === "adj.propose" && e.payload.target === key)).slice(-8);

    return `
    <div class="col">
      <div><div class="row wrap"><span class="muted small">${esc(l.jurisdiction)} · ${esc(l.form)} line ${esc(l.line)} · ${esc(WP.areaLabel(area))}</span></div>
      <h2 class="mt8">${esc(l.label)}</h2>
      <div class="row wrap mt8"><span class="mono" style="font-size:26px;font-weight:700">${esc(ui.fmtVal(v))}</span>
        ${live.changed(key) ? `<span class="chip adj">adjusted from ${esc(ui.fmtVal(l.value))} (${esc(U.signed(live.delta(key)))})</span>` : ""}
        ${live.stale(key) ? `<span class="chip warn" title="An upstream input was adjusted; the engine would recompute this line (tax effect is estimated from rates)">stale: engine recompute needed</span>` : ""}
        <span class="grow"></span>
        <button class="btn sm" data-act="verify" data-key="${esc(key)}">Verify</button>
        <button class="btn sm" data-act="adj-new" data-key="${esc(key)}">Adjust</button>
        <button class="btn sm" data-act="thread-new" data-target="${esc(key)}" data-kind="review_note">Review note</button>
        <button class="btn sm" data-act="note-add" data-target="${esc(key)}">Attach</button></div>
      ${l.note ? `<div class="callout mt8 small">${esc(l.note)}</div>` : ""}</div>

      ${ui.aiExplain ? ui.aiExplain(key) : ""}
      <div><h4>How it was built</h4>
        <div class="small mt8"><b>${esc(l.rule)}</b> ${rule ? "— " + esc(rule) : ""}</div>
        ${(l.inputs || []).length ? `<ul class="tree mt8" style="border:0;padding-left:0">${(l.inputs || []).map((i) => treeNode(i, 1, new Set([key]))).join("")}</ul>` : `<div class="muted small mt8">A leaf: no other lines feed it. Its evidence is below.</div>`}
      </div>

      <div><h4>Where it came from</h4>
        ${srcRefs.length ? `<div class="refs mt8">${srcRefs.map((s) => ui.refChip(s)).join("")}</div>` : '<div class="muted small mt8">No direct source: computed from the lines above.</div>'}
        ${sel ? `<div class="col mt8">${ui.srcPanel(sel)}</div>` : ""}</div>

      <div><h4>How it was verified (${verifs.length})</h4>
        ${verifs.length ? `<table><tbody>${verifs.map((x) => `<tr><td><span class="chip ok">${esc(x.vtype.replace(/_/g, " "))}</span></td><td>${esc(x.note || "")} ${x.evidence ? ui.refChip(x.evidence.replace(/^thread:/, "thread:")) : ""}</td><td class="muted small">${esc(x.name)} · ${U.date(x.ts)}</td></tr>`).join("")}</tbody></table>` : `<div class="muted small mt8">Not yet verified. ${l.sources && l.sources.length ? "Agree it to source and record how." : ""}</div>`}
      </div>

      ${finds.length ? `<div><h4>Findings</h4><div class="col mt8">${finds.map((f) => `<div class="row">${ui.sev(f.sev)} <a href="#/findings/${f.id}" data-act="close-drawer-nav">${esc(f.title)}</a> ${ui.chip(WP.findingState(f.id).status)}</div>`).join("")}</div></div>` : ""}

      <div><h4>Adjustments (${adjs.length})</h4>
        ${adjs.length ? `<table><tbody>${adjs.map((a) => `<tr><td>${adjStatus(a)}</td><td class="mono">${a.mode === "set" ? "set " : ""}${esc(ui.fmtVal(a.amount))}</td><td class="small">${esc(a.reason || "")}</td><td class="n mono small">fed ${esc(U.signed(Math.round(a.effect.taxFed)))} · CA ${esc(U.signed(Math.round(a.effect.taxCA)))}</td></tr>`).join("")}</tbody></table>` : `<div class="muted small mt8">The original engine value stands.</div>`}</div>

      ${threads.length || notes.length ? `<div><h4>Conversation and evidence</h4><div class="col mt8">${threads.map((t) => `<div class="thread"><div class="row"><b>${esc(t.title)}</b>${ui.chip(t.kind.replace(/_/g, " "))}${t.blocking && t.status !== "resolved" ? ui.chip("blocks filing", "err") : ""}${ui.chip(t.status)}<a class="grow right small" href="#/people/threads/${t.id}" data-act="close-drawer-nav">open</a></div></div>`).join("")}${notes.map((n) => `<div class="thread small"><b>${esc(n.name)}</b> <span class="muted">${n.kind} · ${U.date(n.ts)}</span><div>${esc(n.text || "")}</div>${n.file ? `<div>📎 ${esc(n.file.name)}</div>` : ""}</div>`).join("")}</div></div>` : ""}

      <div><h4>Sign-off on ${esc(WP.areaLabel(area))}</h4><div class="row wrap mt8">${so.map(([lv, s]) => { const st = WP.signoffStatus(s); return `<span class="chip ${st.state === "valid" ? "ok" : st.state === "reopened" ? "err" : ""}">${lv}: ${st.state === "none" ? "not signed" : st.state === "valid" ? "signed by " + esc(s.name) : "REOPENED (" + st.changed.length + " lines changed)"}</span>`; }).join("")}</div></div>

      ${linkedHtml(key, l)}
      ${down.length ? `<div><h4>Changes here flow into</h4><div class="refs mt8">${down.map((k) => `<a class="ref" data-act="trace" data-key="${esc(k)}">${esc(k)}</a>`).join("")}</div></div>` : ""}

      ${hist.length ? `<div><h4>History</h4><table><tbody>${hist.map((e) => `<tr><td class="mono small">${U.dt(e.ts)}</td><td>${esc(e.actor.name)}</td><td>${esc(e.type)}</td><td class="hash">${U.short(e.hash)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    </div>`;
  }
  function linkedHtml(key, l) {
    const M = WP.M, P = M.P, py = P.prior_years.return_2024;
    const pv = py.lines[key];
    const rv = M.reverse();
    const sib = new Set();
    (l.sources || []).forEach((s) => { if (/^ev-/.test(s)) (rv.evToClaims[s] || []).forEach((k) => k !== key && sib.add(k)); });
    const rel = [];
    const docs = new Set((l.sources || []).map((s) => (M.evById[s] || {}).document_id).filter(Boolean));
    P.household.related_returns.forEach((r) => { if ([...docs].some((d) => (typeof r.in_this_packet === "string" && r.in_this_packet.includes(d)))) rel.push(r); });
    if (!pv && !sib.size && !rel.length) return "";
    return `<div><h4>Linked across years, returns and items</h4><div class="col gap4 mt8 small">
      ${pv !== undefined ? `<div>Last year (2024 return, ${esc(py.prepared_by)}): <b class="mono">${esc(ui.fmtVal(pv))}</b> ${py.line_labels && py.line_labels[key] ? "— " + esc(py.line_labels[key]) : ""} ${[].concat((py.line_sources && py.line_sources[key]) || []).slice(0, 2).map((x) => ui.refChip(x)).join("")}</div>` : ""}
      ${sib.size ? `<div>Same evidence also feeds: ${[...sib].slice(0, 10).map((k) => `<a class="ref" data-act="trace" data-key="${esc(k)}">${esc(k)}</a>`).join("")}</div>` : ""}
      ${rel.map((r) => `<div>Related return: <b>${esc(r.who)}</b>, ${esc(r.return)}; prepared by ${esc(r.prepared_by)}</div>`).join("")}</div></div>`;
  }
  const adjStatus = (a) => ({ proposed: ui.chip("proposed", "warn"), approved: ui.chip("approved", "ok"), rejected: ui.chip("rejected", "err"), reverted: ui.chip("reverted") }[a.status] || ui.chip(a.status)) + (a.whatif ? " " + ui.chip("what-if", "info") : "") + (a.amendment ? " " + ui.chip("amendment", "adj") : "");
  ui.adjStatus = adjStatus;

  /* ---------- return explorer ---------- */
  const FORM_NAMES = { F1040: "Form 1040", Sch1: "Schedule 1", Sch2: "Schedule 2", Sch3: "Schedule 3", SchA: "Schedule A", SchB: "Schedule B", SchC: "Schedule C", SchD: "Schedule D", SchE: "Schedule E", SchSE: "Schedule SE", F8949: "Form 8949 (lots)", F4797: "Form 4797", "F4562-C": "Form 4562 (Sch C)", "F4562-E": "Form 4562 (rental)", F8582: "Form 8582", F6251: "Form 6251 (AMT)", F8959: "Form 8959", F8960: "Form 8960", F8995: "Form 8995", F8812: "Form 8812", F8863: "Form 8863", F2441: "Form 2441", F8889: "Form 8889", F8606: "Form 8606", F8283: "Form 8283", F7203: "Form 7203", F8938: "Form 8938", F2210: "Form 2210", F8867: "Form 8867", SchCA540NR: "Sch CA (540NR)", F540NR: "Form 540NR", ScheduleS: "Schedule S", FTB3885A: "FTB 3885A", FTB5805: "FTB 5805" };
  ui.formName = (f) => FORM_NAMES[f] || f;

  ui.views["return"] = (r) => {
    const M = WP.M, V = M.curV(), S = WP.store.state;
    const form = r.args[0];
    const forms = [...new Set(V.lines.map((l) => l.form))];
    const live = WP.live();
    const nav = WP.AREAS.map((a) => {
      const fs = forms.filter((f) => V.lines.some((l) => l.form === f && WP.areaOfLine(l) === a.key));
      return fs.length ? `<div class="mt8"><div class="tiny muted" style="text-transform:uppercase;letter-spacing:.06em">${esc(a.label)}</div><div class="row wrap gap4 mt8">${fs.map((f) => `<a class="chip ${f === form ? "acc" : ""}" href="#/return/${f}" style="text-decoration:none">${esc(ui.formName(f))}</a>`).join("")}</div></div>` : "";
    }).join("");
    if (!form) {
      const cards = WP.AREAS.filter((a) => a.key !== "intake_and_engagement").map((a) => {
        const lines = V.lines.filter((l) => WP.areaOfLine(l) === a.key);
        const adj = lines.filter((l) => live.ev.changed(l.key)).length;
        const fnd = WP.findings.filter((f) => f.area === a.key && (f.sev === "error" || f.sev === "warning") && WP.findingState(f.id).status === "open").length;
        const rv = WP.signoffStatus(WP.currentSignoff(a.key, "reviewer")).state, pt = WP.signoffStatus(WP.currentSignoff(a.key, "partner")).state;
        const fs = [...new Set(lines.map((l) => l.form))];
        return `<div class="card"><h3>${esc(a.label)}</h3><div class="small muted mt8">${lines.length} lines · ${fs.map((f) => `<a href="#/return/${f}">${esc(f)}</a>`).join(", ")}</div>
          <div class="row wrap mt8">${fnd ? ui.chip(fnd + " open finding" + (fnd > 1 ? "s" : ""), "err") : ui.chip("no open findings", "ok")}${adj ? ui.chip(adj + " lines adjusted", "adj") : ""}${ui.chip("reviewer: " + (rv === "none" ? "not signed" : rv), rv === "valid" ? "ok" : rv === "reopened" ? "err" : "")}${ui.chip("partner: " + (pt === "none" ? "not signed" : pt), pt === "valid" ? "ok" : pt === "reopened" ? "err" : "")}</div></div>`;
      }).join("");
      return `<div class="pagehead"><div><h1>The return, by area</h1><div class="sub">${V.lines.length} lines in ${M.cur}. Every number below opens its trace.</div></div></div><div class="grid g3">${cards}</div><div class="card mt16"><h4>All forms</h4>${nav}</div>`;
    }
    const lines = V.lines.filter((l) => l.form === form);
    const q = (r.q.q || "").toLowerCase();
    const filtered = lines.filter((l) => !q || (l.label + l.key + l.rule).toLowerCase().includes(q));
    const limit = r.q.all ? Infinity : 160;
    const shown = filtered.slice(0, limit);
    const flags = (l) => {
      const f = [];
      const ad = WP.adjsFor(l.key).length, fi = WP.findings.filter((x) => x.keys.includes(l.key) && WP.findingState(x.id).status === "open" && (x.sev === "error" || x.sev === "warning")).length;
      const vf = (S.verifs[l.key] || []).length, th = S.threadOrder.filter((id) => S.threads[id].target === l.key && S.threads[id].status !== "resolved").length;
      if (fi) f.push(ui.chip("⚑ " + fi, "err"));
      if (ad) f.push(ui.chip("± " + ad, "adj"));
      if (vf) f.push(ui.chip("✓ " + vf, "ok"));
      if (th) f.push(ui.chip("✉ " + th, "info"));
      return f.join(" ");
    };
    return `<div class="pagehead"><div><h1>${esc(ui.formName(form))}</h1><div class="sub">${lines.length} lines · <a href="#/return">all areas</a></div></div><div class="grow"></div>
      <input type="search" id="rq" value="${esc(r.q.q || "")}" placeholder="Filter lines…" data-change="return-filter" style="width:220px"></div>
      <div class="card" style="padding:10px 14px">${nav}</div>
      <div class="tablewrap mt16"><table><thead><tr><th>Line</th><th>Description</th><th class="n">Value</th><th>Rule</th><th>Flags</th></tr></thead><tbody>
      ${shown.map((l) => `<tr class="click" data-act="trace" data-key="${esc(l.key)}"><td class="mono small">${esc(l.line)}</td><td>${esc(l.label)}${l.note ? `<div class="tiny muted">${esc(l.note.slice(0, 140))}</div>` : ""}</td><td class="n">${ui.num(l.key)}</td><td class="tiny muted">${esc(l.rule)}</td><td>${flags(l)}</td></tr>`).join("")}
      </tbody></table></div>${filtered.length > shown.length ? `<div class="mt8"><a class="btn" href="#/return/${form}?all=1${q ? "&q=" + encodeURIComponent(q) : ""}">Show all ${filtered.length} lines</a></div>` : ""}`;
  };
  ui.acts["return-filter"] = (el) => { const f = ui.route.args[0]; ui.go(`#/return/${f}${el.value ? "?q=" + encodeURIComponent(el.value) : ""}`); };
})();
