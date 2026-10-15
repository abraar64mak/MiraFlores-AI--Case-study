/* Filing and after: release, client approval and e-signature, e-file, freeze at filing, amendments on top,
   the client's copy, an IRS notice answered from a self-contained record, and carry-forward to next year. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;

  /* A digest of everything the client is asked to approve. If it changes, release and signatures go stale. */
  let dcache = { n: -1, v: "" };
  WP.returnDigest = () => {
    const n = WP.store.events.length;
    if (dcache.n === n) return dcache.v;
    const ev = WP.live().ev, T = WP.live().totals;
    const vals = {};
    WP.M.curV().lines.forEach((l) => (vals[l.key] = ev.get(l.key)));
    const hh = {};
    WP.M.P.household.people.forEach((p) => (hh[p.id] = WP.householdValue(p.id, "ssn")));
    dcache = { n, v: U.sha256(U.stable({ vals, hh, fed: Math.round(T.federal.total_tax), ca: Math.round(T.california.total_tax), fb: Math.round(T.federal.balance_due), cb: Math.round(T.california.balance_due) })) };
    return dcache.v;
  };
  WP.householdValue = (pid, field) => {
    const p = WP.M.person(pid);
    let v = p ? p[field] : undefined;
    WP.adjList().filter((a) => a.target === `household:${pid}.${field}` && a.status === "approved").forEach((a) => (v = a.amount));
    return v;
  };
  WP.ssnReference = (p) => {
    const card = WP.M.P.extracted_values.find((e) => e.field === "ssn" && WP.M.docById[e.document_id].belongs_to === (p.role === "dependent" ? "dependent:" + p.id : p.role));
    if (card) return card.value;
    const dep = (WP.M.P.prior_years.return_2024.dependents || []).find((d) => d.name === p.name);
    return dep ? dep.ssn : p.ssn;
  };
  const rel = () => { const r = WP.store.state.filing.released; return r ? { ...r, valid: r.digest === WP.returnDigest() } : null; };
  const esignState = () => {
    const F = WP.store.state.filing, cur = WP.returnDigest();
    const ap = ["cu-01", "cu-02"].map((id) => F.approvals[id]);
    const all = ap.every((a) => a && a.digest === cur);
    const stale = ap.some((a) => a && a.digest !== cur);
    return { ap, all, stale, signed: ap.filter((a) => a && a.digest === cur).length };
  };
  const calcPost = (bal, from, to) => {
    const days = Math.max(0, Math.round((new Date(to) - new Date(from)) / 86400000));
    const months = Math.ceil(days / 30.4);
    const rates = WP.M.P.post_filing_rates;
    return { days, interest: bal * rates.irs_underpayment_interest_rate_annual * days / 365, penalty: Math.min(bal * 0.25, bal * rates.irs_failure_to_pay_penalty_per_month * months), months };
  };

  ui.views.filing = (r) => {
    const S = WP.store.state, F = S.filing, M = WP.M, me = WP.me();
    const T = WP.live().totals, steps = WP.steps(), pre = steps.filter((s) => !/Client approval/.test(s.label));
    const preOk = pre.every((s) => s.done), rl = rel(), es = esignState();
    const frozen = F.frozen;
    const stages = [
      ["Preparation", true, preOk || !!frozen],
      ["Released by partner", !!rl, (rl && rl.valid) || !!frozen],
      ["Client approved and signed", es.all || !!frozen, es.all || !!frozen],
      ["E-filed and accepted", !!frozen, !!frozen],
      ["Frozen at filing", !!frozen, !!frozen],
    ];
    const header = `<div class="pagehead"><div><h1>Filing and after</h1><div class="sub">From release to the client's copy, an amendment, a notice, and next year.</div></div></div>
      <div class="row wrap mb8">${stages.map(([l, a, ok], i) => `<div class="card" style="padding:8px 14px;${ok ? "border-color:var(--ok)" : a ? "border-color:var(--warn)" : ""}"><div class="tiny muted">STEP ${i + 1}</div><b>${ok ? "✓ " : ""}${esc(l)}</b></div>`).join("")}</div>`;
    if (me.role === "client") return header + clientPanel(T, rl, es);

    const blockers = WP.blockers().filter((b) => !/Client approval/.test(b.text));
    const sub = F.submissions;
    const tl = M.P.timeline.filter((t) => ["extension_filed_with_payment", "efile_rejected", "efile_accepted_federal", "efile_accepted_california", "federal_balance_paid", "california_refund_issued", "client_approved_and_signed_8879"].includes(t.event));
    const preCards = `
      <div class="grid g2">
        <div class="card"><h3>1 · Release for client approval</h3>
          ${rl ? `<div class="mt8">${rl.valid ? ui.chip("released by " + rl.name, "ok") : ui.chip("STALE: the return changed after release", "err")} <span class="hash">digest ${U.short(rl.digest)}</span></div>` : ""}
          ${preOk ? `<div class="small mt8">All preparation steps and sign-offs are complete.</div>` : `<div class="callout warn small mt8"><b>${blockers.length} thing(s) block release:</b><div class="mt8">${blockers.slice(0, 6).map((b) => "• " + esc(b.text.slice(0, 110))).join("<br>")}</div></div>`}
          <div class="mt8"><button class="btn primary ${preOk && (!rl || !rl.valid) ? "" : "off"}" data-act="release">Release to client (partner)</button></div></div>

        <div class="card"><h3>2 · Client approval and e-signature (Forms 8879)</h3>
          <div class="small mt8">Each spouse approves the exact numbers released, and signs with prior-year AGI and PIN. A change after signing makes the signature stale and requires them to sign again.</div>
          <div class="col gap4 mt8">${["cu-01", "cu-02"].map((id, i) => { const a = es.ap[i]; return `<div class="row">${ui.userChip(id)} ${a ? (a.digest === WP.returnDigest() ? ui.chip("signed " + U.date(a.ts), "ok") : ui.chip("signature stale: return changed", "err")) : ui.chip("not signed")}</div>`; }).join("")}</div>
          <div class="small muted mt8">Switch to a client in the role switcher to sign.</div></div>

        <div class="card"><h3>3 · E-file</h3>
          <div class="small mt8">Transmission checks: steps and sign-offs complete, release current, both signatures current, and every SSN agrees with its card. Only a partner (the paid preparer of record) transmits.</div>
          ${sub.length ? `<table class="mt8 small"><tbody>${sub.map((s) => `<tr><td class="mono">${esc(U.dt(s.ts))}</td><td>${esc(s.jurisdiction)}</td><td>${ui.chip(s.status, s.status === "accepted" ? "ok" : s.status === "rejected" ? "err" : "warn")}</td><td class="small">${(s.errors || []).map((e) => `<b>${esc(e.code)}</b> ${esc(e.message)}`).join("<br>")}</td></tr>`).join("")}</tbody></table>` : ""}
          <div class="mt8"><button class="btn primary ${frozen ? "off" : ""}" data-act="transmit">${sub.some((s) => s.status === "rejected") ? "Retransmit" : "Transmit federal and California"}</button></div></div>

        <div class="card"><h3>Extension (history)</h3><div class="small mt8">${tl.filter((t) => t.event === "extension_filed_with_payment").map((t) => `<b>${U.date(t.at)}</b> ${esc(t.detail)}`).join("")}</div>
          ${(() => { const paid = T.federal.payments, need = 0.9 * T.federal.total_tax; return `<div class="small mt8">90% test for failure-to-pay relief: paid by 2026-04-15 ${U.money(Math.round(paid))} vs 90% of tax ${U.money(Math.round(need))} → ${paid >= need ? ui.chip("met", "ok") : ui.chip("not met", "err")}</div>`; })()}
          <div class="small mt8 muted">The IRS transcript shows code 460 (extension) and 670 (36,000 paid 2026-04-14).</div></div>
      </div>

      `;
    if (frozen) return header + afterFiling(frozen, T) + `<details class="card mt16"><summary><b>Release, signatures and e-file history (sealed at filing)</b></summary>${preCards}</details>`;
    return header + preCards + `<div class="card mt16"><h3>After filing</h3><div class="small muted mt8">At acceptance the return freezes: its numbers, sign-offs and evidence are sealed with a hash. Later changes become amendments layered on top; the original is never edited.</div></div>`;
  };

  function clientPanel(T, rl, es) {
    const me = WP.me(), mine = WP.store.state.filing.approvals[me.id];
    const fb = T.federal.balance_due, cb = T.california.balance_due;
    return `<div class="card"><h3>Your return</h3><div class="grid g3 mt8">
      <div>${ui.kpi("Federal", fb >= 0 ? U.money(Math.round(fb)) + " owed" : U.money(Math.round(-fb)) + " refund", "total tax " + U.money(Math.round(T.federal.total_tax)))}</div>
      <div>${ui.kpi("California", cb >= 0 ? U.money(Math.round(cb)) + " owed" : U.money(Math.round(-cb)) + " refund", "total tax " + U.money(Math.round(T.california.total_tax)))}</div>
      <div>${ui.kpi("Income (AGI)", U.money(Math.round(T.federal.agi)), "adjusted gross income")}</div></div>
      <div class="mt16">${!rl ? `<div class="callout">Your preparer has not released the return for approval yet.</div>` : !rl.valid ? `<div class="callout warn">The return changed after it was released. Please wait for the firm to re-release it.</div>` : mine && mine.digest === WP.returnDigest() ? `<div class="callout ok">You signed on ${U.date(mine.ts)}. ${es.all ? "Both spouses have signed." : "Waiting for your spouse."}</div>` : `<button class="btn primary" data-act="client-sign">Approve and sign (Form 8879)</button>`}</div>
      <div class="row mt16"><a class="btn" href="#/clientcopy">View your copy</a></div></div>`;
  }

  function afterFiling(fz, T) {
    const S = WP.store.state, F = S.filing;
    const cur = WP.live().ev;
    const changed = Object.keys(fz.snapshot).filter((k) => cur.get(k) !== fz.snapshot[k]);
    const amend = WP.adjList().filter((a) => a.amendment && (a.status === "proposed" || a.status === "approved"));
    const fedBal = fz.totals.federal.balance_due, caBal = fz.totals.california.balance_due;
    const pay = F.payments;
    const fedPaid = pay.find((p) => p.kind === "federal_balance"), caRef = pay.find((p) => p.kind === "california_refund");
    const pc = fedBal > 0 ? calcPost(fedBal, "2026-04-15", "2026-07-20") : null;
    const amendEff = amend.reduce((s, a) => ({ f: s.f + a.effect.taxFed, c: s.c + a.effect.taxCA }), { f: 0, c: 0 });
    return `<div class="grid g2 mt16">
      <div class="card"><h3>Frozen at filing</h3><div class="small mt8">Sealed ${U.dt(fz.ts)} by ${esc(fz.by)} · ${Object.keys(fz.snapshot).length} lines · <span class="hash">${esc(fz.hash)}</span></div>
        <div class="mono small mt8">Federal: tax ${U.money(Math.round(fz.totals.federal.total_tax))}, balance ${U.money(Math.round(fedBal))} · California: tax ${U.money(Math.round(fz.totals.california.total_tax))}, balance ${U.money(Math.round(caBal))}</div>
        <div class="row wrap mt8"><a class="btn" href="#/clientcopy">Client's copy</a><a class="btn" href="#/notice">Answer the IRS notice</a><a class="btn" href="#/rollforward">Roll forward to 2026</a></div></div>
      <div class="card"><h3>Payments after filing</h3>
        <table class="small mt8"><tbody>
          <tr><td>Federal balance on the filed return</td><td class="n mono">${U.money(Math.round(fedBal))}</td><td>${fedPaid ? ui.chip("paid " + U.date(fedPaid.date) + " · " + U.money(Math.round(fedPaid.amount)), "ok") : fedBal > 0 ? `<button class="btn sm" data-act="post-pay" data-kind="federal_balance">Record payment</button>` : ""}</td></tr>
          ${pc ? `<tr class="sub"><td>Interest (7%, 04/15 → 07/20, ${pc.days} days) and failure-to-pay penalty (0.5%/month × ${pc.months})</td><td class="n mono">${U.money(Math.round(pc.interest + pc.penalty))}</td><td class="tiny">the engine does not compute these; the IRS assessed code 196/276 on 2026-08-03</td></tr>` : ""}
          <tr><td>California ${caBal < 0 ? "refund" : "balance"}</td><td class="n mono">${U.money(Math.round(Math.abs(caBal)))}</td><td>${caRef ? ui.chip("refunded " + U.date(caRef.date), "ok") : caBal < 0 ? `<button class="btn sm" data-act="post-pay" data-kind="california_refund">Record refund issued</button>` : ""}</td></tr></tbody></table></div>
      <div class="card" style="grid-column:1/3"><div class="row"><h3 class="grow">Amendment layer</h3>${changed.length ? ui.chip(changed.length + " lines differ from what was filed", "adj") : ui.chip("no change since filing", "ok")}</div>
        <div class="small muted mt8">Corrections after filing are ordinary adjustments flagged as amendments. The filed return above is never edited. Estimated effect on tax of the amendment: federal ${U.signed(Math.round(amendEff.f))}, California ${U.signed(Math.round(amendEff.c))}.</div>
        ${changed.length ? `<div class="tablewrap mt8" style="max-height:34vh"><table><thead><tr><th>Line</th><th>Description</th><th class="n">As filed</th><th class="n">Amended</th></tr></thead><tbody>${changed.slice(0, 40).map((k) => `<tr class="click" data-act="trace" data-key="${esc(k)}"><td class="mono small">${esc(k)}</td><td class="small">${esc(WP.M.line(k).label.slice(0, 60))}</td><td class="n">${esc(ui.fmtVal(fz.snapshot[k]))}</td><td class="n adjd">${esc(ui.fmtVal(cur.get(k)))}</td></tr>`).join("")}</tbody></table></div>` : ""}</div></div>`;
  }

  /* ---------- actions ---------- */
  ui.acts.release = async () => {
    if (!ui.guard("release")) return;
    const steps = WP.steps().filter((s) => !/Client approval/.test(s.label));
    if (!steps.every((s) => s.done)) return ui.toast("Not ready: " + steps.find((s) => !s.done).label, "err");
    if (!(await ui.confirm("Release for client approval?", `This seals digest ${U.short(WP.returnDigest())} of the numbers the client will approve. Any later change makes the release and signatures stale.`, "Release"))) return;
    WP.store.append("filing.release", { digest: WP.returnDigest() }, { batch: ui.batch() });
  };
  ui.acts["client-sign"] = async () => {
    if (!ui.guard("esign")) return;
    const me = WP.me(), P = WP.M.P.household;
    const person = me.id === "cu-01" ? P.people[0] : P.people[1];
    const r = await ui.form({
      title: "Sign Form 8879 / FTB 8879",
      intro: `I have reviewed the return summary and authorize e-filing. To confirm it is you, enter last year's AGI${person.ip_pin ? " and your IP PIN" : ""}.`,
      fields: [{ name: "agi", label: "2024 adjusted gross income", type: "number", required: true, hint: "From your 2024 return" }, ...(person.ip_pin ? [{ name: "ip", label: "IP PIN (from IRS notice CP01A)", required: true }] : []), { name: "pin", label: "Choose a 5-digit signing PIN", required: true }],
      submit: "Sign",
    });
    if (!r) return;
    if (Math.round(r.agi) !== Math.round(P.prior_year_agi_for_esignature)) return ui.toast("Prior-year AGI does not match the IRS record. Check your 2024 return.", "err");
    if (person.ip_pin && r.ip !== person.ip_pin) return ui.toast("IP PIN does not match.", "err");
    if (!/^\d{5}$/.test(r.pin)) return ui.toast("PIN must be 5 digits.", "err");
    const batch = ui.batch();
    WP.store.append("filing.approve", { digest: WP.returnDigest(), pin_set: true }, { batch });
    if (esignState().all) WP.store.append("filing.esign", { digest: WP.returnDigest(), both: true }, { batch });
    ui.toast("Signed.");
  };
  ui.acts.transmit = async () => {
    if (!ui.guard("release")) return;
    const S = WP.store.state, M = WP.M;
    const problems = [];
    const steps = WP.steps().filter((s) => !/Client approval/.test(s.label));
    steps.filter((s) => !s.done).forEach((s) => problems.push(s.label));
    const rl = rel();
    if (!rl || !rl.valid) problems.push("Release is missing or stale");
    if (!esignState().all) problems.push("Both client signatures must be current");
    if (problems.length) return ui.toast("Cannot transmit: " + problems.slice(0, 3).join("; "), "err");
    const bad = M.P.household.people.filter((p) => p.role === "dependent").find((p) => WP.householdValue(p.id, "ssn") !== WP.ssnReference(p));
    const batch = ui.batch();
    const rej = M.P.tax_agency_records.efile.find((x) => x.status === "rejected"), hold = M.P.tax_agency_records.efile.find((x) => x.status === "not_transmitted");
    if (bad) {
      WP.store.append("filing.submit", { jurisdiction: "federal", status: "rejected", submission_id: rej.submission_id, errors: rej.errors.map((e) => ({ code: e.code, message: e.message.replace("dependent 2: Theo Lindqvist-Okafor", "dependent: " + bad.name) })) }, { batch });
      WP.store.append("filing.submit", { jurisdiction: "california", status: "not_transmitted", submission_id: hold.submission_id, errors: hold.errors }, { batch });
      WP.store.append("thread.open", { id: U.uid("th"), kind: "review_note", title: `E-file rejected: ${bad.name}'s SSN`, text: "Federal e-file rejected (R0000-504-02). Correct the SSN from the Social Security card (D71), have it approved, then retransmit. Because the household data changed, the release and signatures will be stale: re-release and the client signs again.", target: `household:${bad.id}.ssn`, assignee: "st-01", blocking: true, visibility: "internal" }, { batch });
      return ui.toast("Federal e-file REJECTED: dependent SSN does not match. A blocking review note was opened.", "err");
    }
    const acc = M.P.tax_agency_records.efile.filter((x) => x.status === "accepted");
    WP.store.append("filing.submit", { jurisdiction: "federal", status: "accepted", submission_id: acc[0].submission_id }, { batch });
    WP.store.append("filing.submit", { jurisdiction: "california", status: "accepted", submission_id: acc[1].submission_id }, { batch });
    const ev = WP.live().ev, snap = {};
    M.curV().lines.forEach((l) => (snap[l.key] = ev.get(l.key)));
    const T = WP.live().totals;
    WP.store.append("filing.freeze", { snapshot: snap, totals: { federal: T.federal, california: T.california }, digest: WP.returnDigest(), hash: U.sha256(U.stable(snap)), signoffs: S.signoffOrder.filter((id) => !S.signoffs[id].revoked) }, { batch });
    ui.toast("Accepted by IRS and FTB. The return is frozen: later changes are amendments.");
  };
  ui.acts["post-pay"] = (el) => {
    const F = WP.store.state.filing.frozen, kind = el.dataset.kind;
    if (!F) return;
    const amt = kind === "federal_balance" ? F.totals.federal.balance_due : -F.totals.california.balance_due;
    WP.store.append("filing.payment", { kind, amount: amt, date: kind === "federal_balance" ? "2026-07-20" : "2026-08-21" });
    ui.toast("Recorded.");
  };

  /* ---------- the client's copy ---------- */
  ui.views.clientcopy = () => {
    const S = WP.store.state, M = WP.M, fz = S.filing.frozen;
    const get = (k) => (fz ? fz.snapshot[k] : WP.live().ev.get(k));
    const T = fz ? fz.totals : WP.live().totals;
    const L = (label, k) => `<tr><td>${label}</td><td class="n mono">${U.money(get(k))}</td></tr>`;
    return `<div class="pagehead"><div><h1>Your 2025 return: client copy</h1><div class="sub">${fz ? "As filed " + U.date(fz.ts) + " (frozen)" : "Draft, not yet filed"} · prepared by ${esc(M.P.firm.name)}</div></div><div class="grow"></div><button class="btn noprint" onclick="window.print()">Print / save as PDF</button></div>
      <div class="grid g2"><div class="card"><h3>Federal Form 1040</h3><table class="mt8"><tbody>${L("Wages", "F1040.1z")}${L("Taxable interest", "F1040.2b")}${L("Ordinary dividends", "F1040.3b")}${L("Capital gains", "F1040.7")}${L("Other income (Schedule 1)", "F1040.8")}${L("Total income", "F1040.9")}${L("Adjusted gross income", "F1040.11")}${L("Deductions (itemized)", "F1040.12")}${L("Taxable income", "F1040.15")}${L("Total tax", "F1040.24")}${L("Total payments", "F1040.33")}<tr class="total"><td>${T.federal.balance_due >= 0 ? "Amount you owe" : "Your refund"}</td><td class="n mono">${U.money(Math.round(Math.abs(T.federal.balance_due)))}</td></tr></tbody></table></div>
      <div class="card"><h3>California Form 540NR</h3><table class="mt8"><tbody>${L("California AGI", "F540NR.32")}${L("Total tax", "F540NR.64")}${L("Total payments", "F540NR.78")}<tr class="total"><td>${T.california.balance_due >= 0 ? "Amount you owe" : "Your refund"}</td><td class="n mono">${U.money(Math.round(Math.abs(T.california.balance_due)))}</td></tr></tbody></table>
      <div class="small muted mt8">Part-year resident: California 195 of 365 days (01/01–07/14), then Texas (no state income tax).</div></div></div>
      <div class="card mt16"><h3>Things to know</h3><ul class="small"><li>FinCEN Form 114 (FBAR) for your Swedish account is a separate filing due 2026-10-15 and is not part of this engagement.</li><li>Your AMT credit of ${U.money(3871)} carries to 2026 (Form 8801).</li><li>${esc(S.filing.esign ? "Signed electronically; PIN values are not stored in this copy." : "Not yet signed.")}</li><li>We keep records for ${S.standards.retention_years} years after filing.</li></ul></div>`;
  };

  /* ---------- answer an IRS notice from a self-contained record ---------- */
  ui.views.notice = () => {
    const M = WP.M, P = M.P, S = WP.store.state, n = P.tax_agency_records.notices.find((x) => x.id === "N-2025-L566");
    const fz = S.filing.frozen;
    const get = (k) => (fz ? fz.snapshot[k] : WP.live().ev.get(k));
    const docp = (id) => `<div class="mt8"><b>${esc(id)} · ${esc(M.docById[id].title)}</b>${M.docById[id].pages.map((p) => `<div class="small" style="white-space:pre-wrap;border-left:3px solid var(--line2);padding-left:8px;margin-top:4px">${esc(ui.maskText(p.printed_content, id))}</div>`).join("")}</div>`;
    const nec = M.docs.filter((d) => d.document_type === "1099-NEC").map((d) => ({ id: d.id, payer: (M.evsByDoc[d.id].find((e) => e.field === "payer") || {}).value, amt: (M.evsByDoc[d.id].find((e) => e.field === "box1") || {}).value }));
    const necSum = U.sum(nec.map((x) => x.amt)), k = M.evsByDoc.D21.find((e) => e.field === "box1a").value;
    const books = M.evsByDoc.D14.filter((e) => /^Sales/.test(e.field)).reduce((s, e) => s + e.value, 0);
    const filedGross = get("SchC.1");
    const verifs = (key) => (S.verifs[key] || []).map((v) => `${v.vtype.replace(/_/g, " ")} by ${v.name} (${U.date(v.ts)})`).join("; ") || "none recorded";
    return `<div class="pagehead"><div><h1>Response record: IRS Letter 566, tax year 2025</h1><div class="sub">Dated ${n.dated}, response due ${n.response_due}. Self-contained: it needs no access to the workpaper.</div></div><div class="grow"></div><button class="btn noprint" onclick="window.print()">Print / save as PDF</button></div>
      <div class="callout small">Return as filed: ${fz ? `frozen ${U.dt(fz.ts)}, content hash <span class="mono">${esc(fz.hash)}</span>` : "NOT FROZEN YET (this is the live draft)"}. Prepared from the workpaper by ${esc(WP.me().name)} on ${WP.today()}.</div>
      <div class="card mt16"><h2>Item 1: noncash charitable contributions (Schedule A line 12, Form 8283)</h2>
        <table class="mt8"><tbody><tr><td>Stock gift to donor-advised fund (F8283.A1.stock)</td><td class="n mono">${U.money(get("F8283.A1.stock"))}</td></tr><tr><td>Vehicle (F8283.A1.vehicle)</td><td class="n mono">${U.money(get("F8283.A1.vehicle"))}</td></tr><tr class="total"><td>Total claimed</td><td class="n mono">${U.money(get("SchA.12"))}</td></tr></tbody></table>
        <div class="small mt8"><b>Valuation.</b> Stock: 200 shares × 72.50 (average of high and low on the transfer date) = 14,500; acquired 04/2019, so long-term. Vehicle: the charity sold the car for 2,900 (Form 1098-C box 4c) and provided no goods or services; the deduction is limited to that amount.${get("F8283.A1.vehicle") > 2900 ? ' <span class="chip err">The return as filed claimed more than the gross proceeds: an amendment is needed.</span>' : ""}</div>
        <div class="small mt8">Verification on file: stock ${esc(verifs("F8283.A1.stock"))}; vehicle ${esc(verifs("F8283.A1.vehicle"))}.</div>${docp("D65")}${docp("D66")}</div>
      <div class="card mt16"><h2>Item 2: Schedule C gross receipts vs Forms 1099-NEC (142,000) and 1099-K (12,400)</h2>
        <table class="mt8"><thead><tr><th>Source</th><th class="n">Amount</th></tr></thead><tbody>${nec.map((x) => `<tr><td>1099-NEC ${esc(x.payer)} (${x.id})</td><td class="n mono">${U.money(x.amt)}</td></tr>`).join("")}<tr class="total"><td>Total 1099-NEC</td><td class="n mono">${U.money(necSum)}</td></tr>
          <tr><td>Deposits from 11 clients who issued no Form 1099 (D15 p3)</td><td class="n mono">9,300</td></tr><tr class="total"><td>Receipts per books (D14) = 1099-NEC + non-1099</td><td class="n mono">${U.money(books)}</td></tr>
          <tr><td>Form 1099-K (D21), card payments</td><td class="n mono">${U.money(k)}</td></tr><tr class="sub"><td>…which is part of Atlas Outdoor Gear's 1099-NEC of 41,200 (28,800 by ACH + ${U.money(k)} through Paywell, D15 p3)</td><td></td></tr>
          <tr class="total"><td>Gross receipts reported on Schedule C as filed (SchC.1)</td><td class="n mono">${U.money(filedGross)}</td></tr></tbody></table>
        <div class="small mt8">${Math.abs(filedGross - books) < 1 ? "The return reports exactly the books total. The IRS's own total (1099-NEC + 1099-K) is " + U.money(necSum + k) + "; the difference of " + U.money(k) + " is the 1099-K amount that is also inside Atlas's 1099-NEC (counted twice by the third-party reports)." : filedGross === books + k ? "The return as filed reports " + U.money(filedGross) + ", which counts the 1099-K on top of books. This overstated receipts by " + U.money(k) + " (see finding DUP-1099K); an amended return is needed." : "Reported receipts differ from books by " + U.money(filedGross - books) + "."}</div>${docp("D14")}${docp("D15")}${docp("D21")}</div>
      <div class="card mt16"><h2>How the numbers were checked</h2><div class="small">${WP.findings.filter((f) => ["VEHICLE-FMV", "DUP-1099K"].includes(f.id)).map((f) => `<p><b>${esc(f.id)}</b> — ${esc(f.title)}. Status: ${esc(WP.findingState(f.id).status)}. ${esc(WP.findingState(f.id).note || "")}</p>`).join("")}<p>Sign-offs on this return: ${S.signoffOrder.map((id) => S.signoffs[id]).filter((s) => !s.revoked && (s.area === "deductions_and_credits" || s.area === "business")).map((s) => `${esc(WP.areaLabel(s.area))}, ${esc(s.level)}: ${esc(s.name)}`).join("; ") || "none recorded"}.</p></div></div>
      <div class="row mt16 noprint"><button class="btn primary" data-act="notice-log">Record this response in the file</button></div>`;
  };
  ui.acts["notice-log"] = () => { WP.store.append("notice.response", { noticeId: "N-2025-L566", hash: WP.returnDigest(), items: 2 }); ui.toast("Response record logged."); };

  /* ---------- roll-forward: everything carried to next year, with its history ---------- */
  ui.views.rollforward = () => {
    const M = WP.M, P = M.P, S = WP.store.state, T = WP.live().totals;
    const co = M.curV().v.carryovers_out, ev = WP.live().ev;
    const fed = Object.entries(co.federal), ca = Object.entries(co.california);
    const src = { minimum_tax_credit_from_2025_amt: "F6251.11", sep_contribution_not_deductible_for_2025: "Sch1.16", scorp_stock_basis_end: "F7203.15", ridgeline_capital_account_end: "ev-0970", ira_nondeductible_basis_ngozi: "F8606.14" };
    const openThreads = S.threadOrder.map((id) => S.threads[id]).filter((t) => t.status !== "resolved");
    const openFinds = WP.findings.filter((f) => (f.sev === "error" || f.sev === "warning") && WP.findingState(f.id).status !== "resolved");
    const tax = T.federal.total_tax, tcaTax = T.california.total_tax;
    const safeF = Math.min(0.9 * tax, 1.1 * tax) / 4;
    return `<div class="pagehead"><div><h1>Roll forward to 2026</h1><div class="sub">Everything the next preparer inherits, with where each item came from.</div></div><div class="grow"></div><button class="btn noprint" onclick="window.print()">Print</button><button class="btn primary noprint" data-act="roll-log">Log package</button></div>
      <div class="grid g2"><div class="card"><h3>Federal carryovers out of 2025</h3><table class="mt8"><tbody>${fed.map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td class="n mono">${U.money(v)}</td><td class="small muted">${src[k] ? `<a class="num" data-act="trace" data-key="${esc(src[k])}">${esc(src[k])}</a>` : "from v3 engine output"}</td></tr>`).join("")}</tbody></table></div>
      <div class="card"><h3>California carryovers</h3><table class="mt8"><tbody>${ca.map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td class="n mono small">${esc(typeof v === "object" ? Object.entries(v).map(([a, b]) => a + " " + U.money(b)).join(", ") : U.money(v))}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="card mt16"><h3>Assets: depreciation continues</h3><table class="mt8"><thead><tr><th>Asset</th><th>Method</th><th class="n">Federal accumulated</th><th class="n">California accumulated</th><th>Disposition</th></tr></thead><tbody>${M.curV().v.assets.map((a) => `<tr><td>${esc(a.asset_id)} <span class="muted small">${esc(a.description)}</span></td><td class="small">${esc(a.method)}</td><td class="n mono">${U.money(Math.round(a.federal.accumulated_end))}</td><td class="n mono">${U.money(Math.round(a.california.accumulated_end))}</td><td class="small">${esc(JSON.stringify(a.disposed || a.disposition || "—")).slice(0, 80)}</td></tr>`).join("")}</tbody></table></div>
      <div class="grid g2 mt16"><div class="card"><h3>Open items handed over</h3><div class="small mt8"><b>${openFinds.length}</b> unresolved finding(s), <b>${openThreads.length}</b> open thread(s):</div><div class="col gap4 mt8 small">${openFinds.slice(0, 8).map((f) => `<div>• ${esc(f.title)}</div>`).join("")}${openThreads.slice(0, 5).map((t) => `<div>• ${esc(t.title)}</div>`).join("")}</div>
        <h4 class="mt16">Outside filings to watch</h4><div class="col gap4 mt8 small">${WP.outsideFilings().map((o) => `<div>• <b>${esc(o.name)}</b>: ${esc(o.who)}, due ${esc(o.due)}</div>`).join("")}</div></div>
      <div class="card"><h3>Judgments, elections and due diligence (history)</h3><div class="col gap4 mt8 small">${S.decisionOrder.map((id) => S.decisions[id]).map((d) => `<div><b>${esc(d.title)}</b> <span class="muted">${esc(d.kind)} · ${esc(d.name)} · ${U.date(d.ts)}</span><div class="tiny">Authority: ${esc(d.authority)}</div></div>`).join("") || '<span class="muted">None recorded yet.</span>'}</div>
        <h4 class="mt16">2026 estimated payments (planning)</h4><div class="small mt8">Federal safe harbor: lesser of 90% of 2026 tax or 110% of 2025 total tax (${U.money(Math.round(tax))}) → <b>${U.money(Math.round(1.1 * tax))}</b>, about ${U.money(Math.round(1.1 * tax / 4))} per quarter on ${esc(P.planning_reference_2026.federal_estimate_due_dates.join(", "))}.<br>California (AGI over 150,000): ${U.money(Math.round(1.1 * tcaTax))} on ${esc(P.planning_reference_2026.california_estimate_due_dates.join(", "))} at ${P.planning_reference_2026.california_installment_percentages.map((x) => x * 100 + "%").join(" / ")}.<ul>${P.planning_reference_2026.known_2026_changes_for_this_household.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div></div>`;
  };
  ui.acts["roll-log"] = () => { WP.store.append("note.add", { target: "rollforward", kind: "note", text: `2026 roll-forward package generated from digest ${U.short(WP.returnDigest())}` }); ui.toast("Logged."); };
})();
