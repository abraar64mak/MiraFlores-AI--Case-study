/* Domain logic over the projected state: areas, live return, sign-off validity, required steps, blockers. */
window.WP = window.WP || {};
(function () {
  const U = WP.U;

  WP.AREAS = [
    { key: "intake_and_engagement", label: "Intake and engagement" },
    { key: "wages_and_stock_compensation", label: "Wages and stock compensation" },
    { key: "investments_and_digital_assets", label: "Investments and digital assets" },
    { key: "business", label: "Business (Schedule C)" },
    { key: "rentals_and_sale", label: "Rentals and the sale" },
    { key: "pass_throughs_and_basis", label: "Pass-throughs and basis" },
    { key: "deductions_and_credits", label: "Deductions and credits" },
    { key: "california", label: "California and state split" },
    { key: "partner_review", label: "Summary, payments and partner review" },
  ];
  WP.SIGN_AREAS = WP.AREAS.filter((a) => a.key !== "intake_and_engagement");
  WP.areaLabel = (k) => (WP.AREAS.find((a) => a.key === k) || { label: k || "—" }).label;

  /* A line belongs to the area a CPA would look for it in. */
  WP.areaOfLine = (l) => {
    const f = l.form, k = l.key;
    if (/^F1040\.(1[a-z]?|25[ab]|25c|25d)$/.test(k) || f === "F6251" || f === "F8959") return "wages_and_stock_compensation";
    if (["SchB", "SchD", "F8949", "F8960"].includes(f)) return "investments_and_digital_assets";
    if (["SchC", "SchSE", "F4562-C", "F8995", "F8995A", "ScheduleS_"].includes(f) || /^Sch1\.(15|16|17)$/.test(k)) return "business";
    if (["SchE", "F4797", "F4562-E", "F8582"].includes(f)) return "rentals_and_sale";
    if (["F7203"].includes(f)) return "pass_throughs_and_basis";
    if (["SchA", "F8283", "F8812", "F8863", "F2441", "F8867", "F8889", "F8606", "F8938"].includes(f)) return "deductions_and_credits";
    if (["SchCA540NR", "F540NR", "FTB3885A", "FTB5805", "ScheduleS"].includes(f)) return "california";
    return "partner_review";
  };
  WP.areaOfKey = (key) => {
    if (!key) return null;
    if (/^household:/.test(key)) return "intake_and_engagement";
    const l = WP.M && WP.M.line(key);
    return l ? WP.areaOfLine(l) : null;
  };

  /* ---------- active adjustments and the live return ---------- */
  WP.adjList = () => {
    const S = WP.store.state;
    return S.adjOrder.map((id) => {
      const a = S.adj[id];
      if (!a.effect) a.effect = WP.M.effectOf(a);
      return a;
    });
  };
  WP.isLive = (a, includeWhatif) => (a.status === "proposed" || a.status === "approved") && (includeWhatif || !a.whatif);

  let liveCache = { n: -1, key: "" };
  WP.live = (opt = {}) => {
    const S = WP.store.state, n = WP.store.events.length;
    const key = n + "|" + (opt.whatif ? 1 : 0) + "|" + (opt.approvedOnly ? 1 : 0) + "|" + (opt.upTo === undefined ? "" : opt.upTo);
    if (liveCache.key === key) return liveCache.val;
    S.adj && Object.values(S.adj).forEach((a) => delete a.effect);
    let adjs = WP.adjList().filter((a) => WP.isLive(a, opt.whatif));
    if (opt.approvedOnly) adjs = adjs.filter((a) => a.status === "approved");
    if (opt.upTo !== undefined) adjs = adjs.filter((a) => a.at <= opt.upTo);
    const lineAdjs = adjs.filter((a) => WP.M.line(a.target));
    const ev = WP.M.evaluate(WP.M.cur, lineAdjs);
    const totals = WP.M.totals(adjs);
    const val = { adjs, ev, totals };
    liveCache = { n, key, val };
    return val;
  };
  WP.adjsFor = (key) => WP.adjList().filter((a) => a.target === key && a.status !== "reverted" && a.status !== "rejected");

  /* ---------- sign-offs ---------- */
  WP.areaKeys = (area) => WP.M.curV().lines.filter((l) => WP.areaOfLine(l) === area && U.isNum(l.value)).map((l) => l.key);
  WP.areaSnapshot = (area) => {
    const ev = WP.live().ev, out = {};
    WP.areaKeys(area).forEach((k) => (out[k] = ev.get(k)));
    return out;
  };
  WP.signoffStatus = (so) => {
    if (!so) return { state: "none" };
    if (so.revoked) return { state: "revoked" };
    const ev = WP.live().ev;
    const changed = Object.keys(so.values).filter((k) => ev.get(k) !== so.values[k]);
    return changed.length ? { state: "reopened", changed } : { state: "valid" };
  };
  WP.currentSignoff = (area, level) => {
    const S = WP.store.state;
    return S.signoffOrder.map((id) => S.signoffs[id]).filter((s) => s.area === area && s.level === level && !s.revoked).slice(-1)[0] || null;
  };

  /* ---------- findings status ---------- */
  WP.findingState = (id) => WP.store.state.findings[id] || { status: "open" };
  WP.findingOpen = (f) => {
    if (f.sev === "ok" || f.sev === "info" && f.kind !== "variance") return WP.findingState(f.id).status === "open" && f.sev !== "ok" && f.sev !== "info" ? true : false;
    return WP.findingState(f.id).status === "open";
  };
  WP.findingsBlocking = () => (WP.findings || []).filter((f) => (f.sev === "error" || f.sev === "warning") && WP.findingState(f.id).status === "open");

  /* ---------- threads ---------- */
  WP.openBlockers = () => {
    const S = WP.store.state;
    return S.threadOrder.map((id) => S.threads[id]).filter((t) => t.blocking && t.status !== "resolved" && t.status !== "closed");
  };

  /* ---------- required steps (starter standards), evaluated against live state ---------- */
  WP.steps = () => {
    const S = WP.store.state, M = WP.M, st = S.standards;
    const steps = [];
    const docsOk = M.docs.every((d) => WP.docDisposition(d.id));
    const idMismatch = (WP.findings || []).filter((f) => f.id === "SSN-MISMATCH-THEO").map((f) => WP.findingState(f.id).status === "open")[0];
    const varOpen = (WP.variances() || []).filter((v) => !v.explained).length;
    const estF = WP.findingState("PAYMENTS-IRS").status, estC = WP.findingState("PAYMENTS-FTB").status;
    const ddTopics = ["ctc_odc", "aotc", "eic", "hoh"];
    const ddDone = ddTopics.filter((t) => S.decisionOrder.some((id) => S.decisions[id].kind === "due_diligence" && S.decisions[id].topic === t));
    const blocking = WP.findingsBlocking();
    const reviewerOk = WP.SIGN_AREAS.every((a) => WP.signoffStatus(WP.currentSignoff(a.key, "reviewer")).state === "valid");
    const partnerOk = WP.SIGN_AREAS.every((a) => WP.signoffStatus(WP.currentSignoff(a.key, "partner")).state === "valid");
    const manual = (label) => (S.stepsDone[label] && S.stepsDone[label].done);
    const carry = M.curV().lines.filter((l) => (l.sources || []).some((s) => /^py:\/carryovers/.test(s)));
    const carryOk = carry.length === 0 || carry.every((l) => (S.verifs[l.key] || []).some((v) => v.vtype === "agreed_to_prior_year"));
    const defs = {
      "Engagement letter and consents signed": [!!M.docById.D01 && !!M.docById.D02, "D01 signed 2026-01-12 and D02 (7216 consent) in file"],
      "Identity verified": [!!M.docById.D04 && !!M.docById.D05 && idMismatch === false, idMismatch === false ? "Licenses on file; SSNs agree to cards" : "A dependent SSN disagrees with its card (see findings)"],
      "Prior-year return reviewed": [manual("Prior-year return reviewed"), "Mark complete after reviewing D06/D07"],
      "All documents accounted for": [docsOk, `${M.docs.length} documents each have a disposition`],
      "Prior-year variances explained": [varOpen === 0, `${varOpen} flagged variance(s) without an explanation`],
      "Carryovers agreed to prior year": [carryOk, carry.length ? `${carry.length} carryover lines; verify each as "agreed to prior year"` : "no carryover lines"],
      "Estimated payments agreed to IRS and FTB records": [estF !== "open" && estC !== "open", "Federal and California payment checks resolved"],
      "Due diligence completed": [ddDone.length === ddTopics.length, `${ddDone.length}/${ddTopics.length} due-diligence topics documented (CTC/ODC, AOTC, EIC, HOH)`],
      "Diagnostics resolved": [blocking.length === 0, `${blocking.length} open error/warning finding(s)`],
      "Reviewer sign-off": [reviewerOk, "Every area needs a current reviewer sign-off"],
      "Partner sign-off": [partnerOk, "Every area needs a current partner sign-off"],
      "Client approval and e-file authorization": [!!S.filing.esign, S.filing.esign ? `Signed by ${S.filing.esign.name}` : "Form 8879 not signed"],
    };
    st.required_steps.forEach((label) => {
      const d = defs[label];
      if (d) steps.push({ label, done: !!d[0], detail: d[1], auto: !/Prior-year return reviewed/.test(label) });
      else steps.push({ label, done: manual(label), detail: "Manual step", auto: false, manual: true });
    });
    return steps;
  };
  WP.blockers = () => {
    const out = [];
    WP.openBlockers().forEach((t) => out.push({ kind: "note", text: `Open review note: ${t.title}`, id: t.id }));
    WP.steps().filter((s) => !s.done && !/Client approval/.test(s.label)).forEach((s) => out.push({ kind: "step", text: `${s.label}: ${s.detail}` }));
    return out;
  };

  /* ---------- document dispositions: every document used, or why not ---------- */
  WP.docDisposition = (id) => {
    const M = WP.M, d = M.docById[id];
    const v = M.curV().v, rev = M.reverse().docToClaims[id];
    const flag = WP.docFlags[id];
    if (flag) return { kind: flag.kind, reason: flag.reason };
    if (v.documents_superseded.includes(id)) return { kind: "superseded", reason: "Superseded by a later version of the document" };
    if (rev && rev.length) return { kind: "used", reason: `Feeds ${rev.length} line(s)` };
    if (d.extraction.status === "not_extracted") return { kind: "not_extracted", reason: d.extraction.reason || "Not extracted by the pipeline" };
    if (["engagement_letter", "consent_7216", "identity_document", "irs_ip_pin_notice"].includes(d.document_type)) return { kind: "administrative", reason: "Procedural evidence (engagement, consent, identity)" };
    if (!v.documents_used.includes(id)) return { kind: "unused", reason: "Not used by the engine in the current version" };
    return { kind: "used", reason: "Used by the engine; evidence is cited through the document itself" };
  };

  /* ---------- prior-year variance register ---------- */
  WP.variances = () => {
    const M = WP.M, S = WP.store.state, st = S.standards;
    const py = M.P.prior_years.return_2024.lines, labels = M.P.prior_years.return_2024.line_labels || {};
    const ev = WP.live().ev, out = [];
    Object.keys(py).forEach((k) => {
      const l = M.line(k);
      if (!l || !U.isNum(py[k]) || !U.isNum(l.value)) return;
      if (/^(F8606|F8582\.unallowed|F7203)/.test(k)) return;
      const cur = ev.get(k), diff = cur - py[k];
      const pct = py[k] !== 0 ? Math.abs(diff) / Math.abs(py[k]) : Infinity;
      if (Math.abs(diff) > st.variance_amount && pct * 100 > st.variance_percent) {
        const notes = (S.notes[k] || []).filter((n) => n.kind === "variance");
        out.push({ key: k, label: labels[k] || l.label, py: py[k], cur, diff, pct, explained: notes.length > 0, notes });
      }
    });
    return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  };

  /* ---------- sensitive values ---------- */
  WP.canSeeSensitive = () => !!WP.me().clearance;
})();
