/* Reconciliations (figures that should agree) and the completeness register (every answer and area considered).
   Left and right sides are computed from documents and from the live return, so a correction makes a difference disappear. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;

  WP.recons = () => {
    const M = WP.M, P = M.P, ev = WP.live().ev;
    const evv = (d, f) => { const e = (M.evsByDoc[d] || []).find((x) => x.field === f); return e ? e.value : 0; };
    const live = (k) => ev.get(k);
    const txt = (d) => M.docById[d].pages.map((p) => p.printed_content).join(" ");
    const nums = (s, re) => [...s.matchAll(re)].map((m) => Number(m[1].replace(/,/g, "")));
    const out = [];
    const R = (id, name, area, a, b, o = {}) => out.push({ id, name, area, a, b, tol: o.tol ?? 1, finding: o.finding, note: o.note });
    const side = (label, value, refs = []) => ({ label, value, refs });

    R("W2-WAGES", "W-2 box 1: distinct W-2s vs Form 1040 line 1a", "wages_and_stock_compensation", side("D08 + D09 (D10 is a copy of D09)", evv("D08", "box1") + evv("D09", "box1"), ["D08p1", "D09p1"]), side("F1040.1a", live("F1040.1a"), ["F1040.1a"]));
    R("W2-WH", "W-2 box 2 federal withholding vs line 25a", "wages_and_stock_compensation", side("D08 + D09 box 2", evv("D08", "box2") + evv("D09", "box2"), ["D08p1", "D09p1"]), side("F1040.25a", live("F1040.25a"), ["F1040.25a"]));
    R("W2-CAWH", "W-2 box 17 California withholding vs 540NR line 71", "california", side("D08 + D09 box 17", evv("D08", "box17") + evv("D09", "box17"), ["D08p1", "D09p1"]), side("F540NR.71", live("F540NR.71"), ["F540NR.71"]), { note: "Halvorsen withheld California tax through 09/30 by mistake (qa-45)" });
    R("HSA", "HSA: employer contributions on the W-2s (code W) vs Form 5498-SA", "deductions_and_credits", side("W-2 box 12 W (D08 + D09)", evv("D08", "box12_W") + evv("D09", "box12_W"), ["D08p1", "D09p1"]), side("Form 5498-SA box 2 (D45)", nums(txt("D45"), /contributions made in 2025: ([\d,]+\.\d\d)/g)[0], ["D45p1"]));
    R("ROTH", "Roth conversion: 1099-R box 1 vs 5498 box 3 vs Form 8606", "deductions_and_credits", side("Form 1099-R gross distribution (D41)", nums(txt("D41"), /gross distribution ([\d,]+\.\d\d)/g)[0], ["D41p1"]), side("Form 8606 line 8 (and 5498 box 3 = " + U.money(nums(txt("D43"), /conversion amount[^0-9]*([\d,]+\.\d\d)/g)[0]) + ")", live("F8606.8"), ["F8606.8", "D43p1"]));
    const nec = M.docs.filter((d) => d.document_type === "1099-NEC").reduce((s, d) => s + evv(d.id, "box1"), 0);
    const non = nums(txt("D15"), /Deposits from clients who issued no Form 1099: ([\d,]+\.\d\d)/g)[0] || 0;
    R("BOOKS-1099", "Books revenue vs 1099-NEC plus non-1099 deposits", "business", side("Books: sales (D14)", evv("D14", "Sales - client projects") + evv("D14", "Sales - print and licensing"), ["D14p1"]), side("1099-NEC " + U.money(nec) + " + non-1099 " + U.money(non), nec + non, ["D16p1", "D15p3"]));
    R("SCHC-GROSS", "Schedule C gross receipts vs books revenue", "business", side("SchC.1", live("SchC.1"), ["SchC.1"]), side("Books revenue", evv("D14", "Sales - client projects") + evv("D14", "Sales - print and licensing"), ["D14p1"]), { finding: "DUP-1099K" });
    // mileage: unique pages
    const d23 = M.docById.D23, pages = d23.pages.map((p) => p.page);
    const tot = (pg) => (M.evsByDoc.D23.find((e) => e.page === pg && e.field === "page_total") || { value: 0 }).value;
    const uniq = pages.filter((pg) => !WP.docFlags["D23#" + pg]).reduce((s, pg) => s + tot(pg), 0);
    R("MILES", "Business miles: Schedule C vs unique pages of the log", "business", side("SchC.44a", live("SchC.44a"), ["SchC.44a"]), side("Sum of page totals, duplicate scan excluded", uniq, ["D23p1", "D23p2", "D23p4"]), { finding: "DUP-PAGE-D23" });
    R("MILES-DED", "Mileage deduction vs miles × rate", "business", side("SchC.9", live("SchC.9"), ["SchC.9"]), side(`SchC.44a × ${M.params.mileage_rate}`, Math.round(live("SchC.44a") * M.params.mileage_rate), ["ref:param.mileage_rate"]));
    const dup = Object.values(WP.docFlags).filter((f) => f.kind === "duplicate" && /interest/i.test(f.reason || ""));
    const intLines = M.curV().lines.filter((l) => /^SchB\.1\.\d+$/.test(l.key));
    R("INTEREST", "Schedule B interest vs distinct interest documents", "investments_and_digital_assets", side("SchB.2", live("SchB.2"), ["SchB.2"]), side("Sum of lines, the sweep counted once", U.sum(intLines.map((l) => ev.get(l.key))) - (dup.length && live("SchB.1.2") === l_orig("SchB.1.2") ? l_orig("SchB.1.2") : 0), ["D28p1", "D29p1"]), { finding: "DUP-INTEREST" });
    function l_orig(k) { return M.line(k).value; }
    // brokers: summary vs lots
    const n2 = M.docById.D28.pages[1].printed_content;
    const nSumm = nums(n2, /proceeds ([\d,]+\.\d\d)/g).reduce((s, x) => s + x, 0);
    const nLots = U.sum(M.evsByDoc.D28.filter((e) => /^N\d+_proceeds$/.test(e.field)).map((e) => e.value));
    R("B-NORTHLAKE", "Northlake 1099-B: summary vs lots", "investments_and_digital_assets", side("Summary proceeds (D28 p2)", nSumm, ["D28p2"]), side("Sum of lots (p3)", nLots, ["D28p3"]));
    const mSum = evv("D31", "b_summary_proceeds"), mLots = U.sum(M.evsByDoc.D31.filter((e) => /^M\d+_proceeds$/.test(e.field)).map((e) => e.value));
    R("B-MERIDIAN", "Meridian 1099-B (corrected): summary vs lots", "investments_and_digital_assets", side("Summary proceeds", mSum, ["ev-0703"]), side("Sum of lots read (page 32 unread)", mLots, ["D31p2", "D31p32"]), { finding: "BROKER-D31", tol: 0.5 });
    const bs = evv("D74", "st_proceeds") + evv("D74", "lt_proceeds"), bl = U.sum(M.evsByDoc.D74.filter((e) => /^X\d+_proceeds$/.test(e.field)).map((e) => e.value));
    R("B-BRIGHTPATH", "Brightpath 1099-B: summary vs 260 lots", "investments_and_digital_assets", side("Summary proceeds", bs, ["ev-1083", "ev-1086"]), side("Sum of lots", bl, ["D74p2"]), { tol: 1 });
    const da = nums(txt("D34"), /C\d+ [A-Z]+ [\d.]+ sold [\d-]+ gross proceeds ([\d,]+\.\d\d)/g).reduce((s, x) => s + x, 0), cx = nums(txt("D35"), /proceeds ([\d,]+\.\d\d)/g).reduce((s, x) => s + x, 0);
    R("CRYPTO", "Coinhaven: Form 1099-DA vs transaction export", "investments_and_digital_assets", side("1099-DA gross proceeds (D34)", da, ["D34p1"]), side("CSV export proceeds (D35)", cx, ["D35p1"]));
    const cap = (id, f) => evv(id, f);
    const k1 = nums(txt("D37"), /current year net income ([\d,]+)/g)[0];
    R("K1-CAP", "Ridgeline capital account: begin + income − distributions − other = end", "pass_throughs_and_basis", side("60,000 + " + U.money(k1) + " − 6,000 − 210", cap("D37", "cap_begin") + k1 - cap("D37", "box19a") - cap("D37", "box21"), ["D37p1"]), side("Ending capital account (K-1)", cap("D37", "cap_end"), ["ev-0970"]));
    R("SCORP-DIST", "S-corp distributions: K-1 box 16D vs Form 7203", "pass_throughs_and_basis", side("K-1 box 16D (D39)", evv("D39", "box16d"), ["ev-0977"]), side("F7203.6", live("F7203.6"), ["F7203.6"]));
    R("RENT", "Fremont Way rent: owner statement vs 1099-MISC vs Schedule E", "rentals_and_sale", side("Owner statement rent (D46)", evv("D46", "rent"), ["ev-0998"]), side("Schedule E line 3 (A) · 1099-MISC " + U.money(evv("D46", "1099misc_rents")), live("SchE.3A"), ["SchE.3A", "ev-1003"]));
    R("SALE", "Condo sale: closing statement vs 1099-S vs Form 4797", "rentals_and_sale", side("Closing statement price (D51)", nums(txt("D51"), /Contract sales price ([\d,]+\.\d\d)/g)[0], ["D51p1"]), side("F4797.21 (1099-S " + U.money(nums(txt("D52"), /([\d,]+\.\d\d)/g)[0] || 0) + ")", live("F4797.21"), ["F4797.21", "D52p1"]));
    // depreciation roll-forward
    const bad = [];
    M.curV().v.assets.forEach((a) => {
      const pr = M.P.prior_years.asset_records.find((x) => x.asset_id === a.asset_id);
      if (!pr) return;
      const s = U.sum(Object.values(pr.federal));
      if (Math.abs(s - a.federal.prior_accumulated) > 1) bad.push(a.asset_id);
    });
    R("DEPR", "Federal accumulated depreciation: prior schedule vs engine opening balance", "rentals_and_sale", side("Σ prior-year depreciation, assets with history", U.sum(M.P.prior_years.asset_records.map((a) => U.sum(Object.values(a.federal)))), ["py:/asset_records"]), side("Σ engine 'prior accumulated' for the same assets", U.sum(M.P.prior_years.asset_records.map((a) => (M.curV().v.assets.find((x) => x.asset_id === a.asset_id) || { federal: { prior_accumulated: 0 } }).federal.prior_accumulated)), ["asset:SAC-BLDG"]), { note: bad.length ? "differs: " + bad.join(", ") : "" });
    R("MORT", "Mortgage interest: Σ Forms 1098 and statements vs Schedule A", "deductions_and_credits", side("1098s D55 13,900 + D57 997 + points 4,800 + refinance points 9", evv("D55", "box1") + evv("D57", "box1") + 4800 + 9, ["D55p1", "D57p1", "D54p1"]), side("SchA.8e", live("SchA.8e"), ["SchA.8e"]), { finding: "MORT-DOUBLE", note: "Payoff interest 2,150 is already in D55 box 1 (D56)" });
    const cashR = nums(txt("D63"), /gift ([\d,]+\.\d\d)/g).reduce((s, x) => s + x, 0) + 1500;
    R("GIFT-CASH", "Cash gifts: receipts vs Schedule A line 11", "deductions_and_credits", side("D63 600 + 1,250 + D64 1,500 (confirmed, msg-08)", cashR, ["D63p1", "D64p1", "msg-08"]), side("SchA.11", live("SchA.11"), ["SchA.11"]));
    R("GIFT-NONCASH", "Noncash gifts: stock FMV + vehicle proceeds vs Schedule A line 12", "deductions_and_credits", side("D65 14,500 + D66 gross proceeds " + U.money(evv("D66", "box4c")), 14500 + evv("D66", "box4c"), ["D65p1", "ev-1054"]), side("SchA.12", live("SchA.12"), ["SchA.12"]), { finding: "VEHICLE-FMV" });
    R("DEPCARE", "Dependent care: provider statements vs Form 2441", "deductions_and_credits", side("D61 5,400 + D62 4,200", nums(txt("D61"), /total paid ([\d,]+\.\d\d)/g)[0] + nums(txt("D62"), /total paid ([\d,]+\.\d\d)/g)[0], ["D61p1", "D62p1"]), side("F2441.2", live("F2441.2"), ["F2441.2"]));
    const ftb = P.tax_agency_records.ftb_account.tax_year_2025_payments.reduce((s, x) => s + x.amount, 0);
    R("PAY-IRS", "Federal estimated payments: return vs IRS transcript", "partner_review", side("F1040.26", live("F1040.26"), ["F1040.26"]), side("Transcript code 670 'Estimated'", P.tax_agency_records.irs_account_transcript_2025.slice(-1)[0].transactions.filter((x) => x.code === "670" && /Estimated/.test(x.description)).reduce((s, x) => s + x.amount, 0), ["agency:/irs_account_transcript_2025"]), { finding: "PAYMENTS-IRS" });
    R("PAY-FTB", "California estimated payments: return vs FTB record", "california", side("F540NR.72", live("F540NR.72"), ["F540NR.72"]), side("FTB tax-year-2025 payments", ftb, ["agency:/ftb_account"]), { finding: "PAYMENTS-FTB" });
    R("EXT", "Extension payment: Schedule 3 line 10 vs IRS transcript code 670", "partner_review", side("Sch3.10", live("Sch3.10"), ["Sch3.10"]), side("Transcript 2026-04-14", 36000, ["agency:/irs_account_transcript_2025"]));
    R("CA-WAGES", "California-source wages: W-2 box 16 vs work location (paystub)", "california", side("SchCA540NR.1.E", live("SchCA540NR.1.E"), ["SchCA540NR.1.E"]), side("Corvane box 16 + Halvorsen California wages through 07/15 (D73 paystub)", evv("D08", "box16") + evv("D73", "ytd_ca_wages"), ["D08p1", "ev-1081", "qa-45"]), { finding: "CA-WAGE-SOURCE" });
    R("FX", "Swedish interest: SEK amount at the 2025 average rate vs Schedule B", "investments_and_digital_assets", side("SEK 18,450 ÷ " + M.params.fx.SEK["2025_average"], Math.round(18450 / M.params.fx.SEK["2025_average"]), ["D36p1", "ref:fx.SEK.2025_average"]), side("SchB.1.6", live("SchB.1.6"), ["SchB.1.6"]), { finding: "FX-YEAR" });
    R("RE-TAX", "Austin property tax: escrow bill less seller's share vs Schedule A", "deductions_and_credits", side("1098 box 10 (D57) 13,420 − seller credit (D54)", 13420 - evv("D54", "tax_credit"), ["D57p1", "D54p1"]), side("SchA.5b", live("SchA.5b"), ["SchA.5b"]), { finding: "RE-TAX-CREDIT" });
    out.forEach((r) => { r.diff = (r.a.value || 0) - (r.b.value || 0); r.ok = Math.abs(r.diff) <= r.tol; });
    return out;
  };

  /* client answers: where each one lands, and whether it is contradicted */
  WP.QA_MAP = {
    "qa-01": [[], "Filing status stays MFJ"], "qa-02": [["F540NR.34", "SchCA540NR.1.E"], "Part-year California residency (195 days)"], "qa-03": [["F1040.1a"], "Two W-2s"], "qa-04": [["F8863.7", "F8812.11"], "Ada: AOTC phased out; other-dependent credit"], "qa-05": [["F2441.2"], "Two care providers"],
    "qa-06": [["F6251.11", "F8949.B.N1"], "ISO exercise (AMT), RSU and ESPP sales"], "qa-07": [["F8938.1.max", "SchB.7a"], "Swedish account"], "qa-08": [[], "No foreign gift this year; 2023 inheritance is OUTSIDE-3520"], "qa-09": [["SchA.8a", "SchA.8c"], "Purchase 07/08, refinance November"], "qa-10": [["F4797.25"], "Austin condo sale"],
    "qa-11": [["SchE.3A", "SchE.3B"], "Two rentals"], "qa-12": [["F7203.1", "SchE.28B"], "Woodworks and Ridgeline"], "qa-13": [["SchE.28B"], "Ridgeline K-1 late (2026-06-22)"], "qa-14": [["SchD.16"], "Contradicted by documents"], "qa-15": [["F8949.H.C6", "SchD.3"], "Digital assets"],
    "qa-16": [["SchC.31"], "Lindqvist Studio"], "qa-17": [["SchC.1"], "Cash method"], "qa-18": [["F4562-C.14"], "Equipment 38,000"], "qa-19": [["SchC.30"], "Home office (two homes)"], "qa-20": [["SchC.9", "SchC.44a"], "Mileage log"],
    "qa-21": [["SchC.24b"], "Meals at 50%"], "qa-22": [["SchC.11"], "Two contractors"], "qa-23": [[], "No 1099-NECs filed (OUTSIDE-1099NEC)"], "qa-24": [["SchC.1"], "Non-1099 deposits 9,300"], "qa-25": [["Sch1.17"], "Employer coverage available"],
    "qa-26": [["Sch1.16"], "SEP 18,000 (deposited 2026-04-10)"], "qa-27": [["F8889.3"], "Family HDHP"], "qa-28": [["F8889.13"], "No outside HSA contributions"], "qa-29": [["F8889.15"], "Medical use"], "qa-30": [["F8606.1"], "Backdoor Roth"],
    "qa-31": [["F8606.2"], "Contradicted by the 2024 Form 8606"], "qa-32": [["F1040.26", "F540NR.72"], "Estimated payments"], "qa-33": [[], "No refund applied from 2024"], "qa-34": [["SchE.11A"], "Management fee"], "qa-35": [["SchE.3A"], "No personal use"],
    "qa-36": [["SchE.9A"], "Landlord insurance 1,850"], "qa-37": [["SchE.14A"], "HVAC 11,000"], "qa-38": [["SchA.11"], "Cash gifts"], "qa-39": [["F8283.A1.stock", "F8283.A1.vehicle"], "Noncash gifts"], "qa-40": [[], "2023 CP2000 resolved (D70)"],
    "qa-41": [["F1040.26"], "Contradicted by IRS transcript"], "qa-42": [[], "Standard deduction not increased; itemizing"], "qa-43": [[], "Refund account on file (masked)"], "qa-44": [[], "Third-party designee: yes"], "qa-45": [["SchCA540NR.1.E"], "CA withholding mistake"],
  };
  const QA_FIND = { "qa-14": "QA-SALES", "qa-23": "OUTSIDE-1099NEC", "qa-25": "SEHI-ELIGIBLE", "qa-31": "ROTH-BASIS", "qa-37": "HVAC-CAPITAL", "qa-39": "VEHICLE-FMV", "qa-41": "PAYMENTS-IRS", "qa-45": "CA-WAGE-SOURCE", "qa-08": "OUTSIDE-3520", "qa-07": "OUTSIDE-FBAR", "qa-15": "CRYPTO-C6" };
  WP.qaStatus = (q) => {
    const m = WP.QA_MAP[q.id] || [[], ""], S = WP.store.state;
    const fid = QA_FIND[q.id], f = fid && WP.findingById[fid];
    const lines = m[0].filter((k) => WP.M.line(k));
    const considered = (S.verifs[q.id] || []).length > 0;
    let status = lines.length ? "reflected" : "no line";
    if (f && WP.findingState(f.id).status === "open" && f.sev !== "ok") status = "flagged";
    return { lines, note: m[1], finding: f, status, considered };
  };

  /* every area considered: evidence of work, not just a checkbox */
  WP.areaRegister = () =>
    WP.AREAS.filter((a) => a.key !== "intake_and_engagement").map((a) => {
      const lines = WP.M.curV().lines.filter((l) => WP.areaOfLine(l) === a.key);
      const f = WP.findings.filter((x) => x.area === a.key);
      const open = f.filter((x) => (x.sev === "error" || x.sev === "warning") && WP.findingState(x.id).status === "open").length;
      const rv = WP.signoffStatus(WP.currentSignoff(a.key, "reviewer")).state, pt = WP.signoffStatus(WP.currentSignoff(a.key, "partner")).state;
      const recs = WP.recons().filter((r) => r.area === a.key);
      return { area: a, lines: lines.length, findings: f.length, open, rv, pt, recons: recs.length, recDiff: recs.filter((r) => !r.ok).length };
    });

  /* ---------- views (registered into Records) ---------- */
  ui.recordViews = ui.recordViews || {};
  ui.recordViews.recon = () => {
    const rs = WP.recons();
    const ok = rs.filter((r) => r.ok).length;
    const ref = (r) => (r.refs || []).slice(0, 3).map(ui.refChip).join(" ");
    return `<div class="row mb8"><div class="callout small grow">Figures that should agree, computed from the documents and the live return. ${ok} agree; ${rs.length - ok} differ. A difference with a finding goes away once the correction is approved.</div></div>
      <div class="tablewrap"><table><thead><tr><th>Check</th><th>Source side</th><th class="n">Amount</th><th>Return side</th><th class="n">Amount</th><th class="n">Diff</th><th></th></tr></thead><tbody>
      ${rs.map((r) => `<tr><td><b>${esc(r.name)}</b><div class="tiny muted">${esc(WP.areaLabel(r.area))}${r.note ? " · " + esc(r.note) : ""}</div></td><td class="small">${esc(r.a.label)}<div>${ui.refs(r.a.refs)}</div></td><td class="n">${U.money(Math.round(r.a.value * 100) / 100)}</td><td class="small">${esc(r.b.label)}<div>${ui.refs(r.b.refs)}</div></td><td class="n">${U.money(Math.round(r.b.value * 100) / 100)}</td><td class="n ${r.ok ? "" : "pos"}">${r.ok ? "0" : U.signed(Math.round(r.diff * 100) / 100)}</td><td>${r.ok ? ui.chip("agrees", "ok") : r.finding ? `<a href="#/findings/${r.finding}" style="text-decoration:none">${ui.chip("differs · " + r.finding, "err")}</a>` : ui.chip("differs", "err")}</td></tr>`).join("")}</tbody></table></div>`;
  };
  ui.recordViews.complete = () => {
    const S = WP.store.state, M = WP.M;
    const reg = WP.areaRegister();
    const qs = M.P.client.questionnaire.map((q) => ({ q, s: WP.qaStatus(q) }));
    const counts = { reflected: 0, flagged: 0, "no line": 0 };
    qs.forEach((x) => counts[x.s.status]++);
    const docs = M.docs.map((d) => WP.docDisposition(d.id).kind);
    const c = (k) => docs.filter((x) => x === k).length;
    return `<div class="grid g3 mb8"><div class="card">${ui.kpi("Documents", M.docs.length + "/" + M.docs.length, `used ${c("used")} · procedural ${c("administrative")} · superseded/duplicate ${c("superseded") + c("duplicate")} · not extracted ${c("not_extracted")}`)}</div>
      <div class="card">${ui.kpi("Client answers", String(qs.length), `reflected ${counts.reflected} · flagged ${counts.flagged} · no return line ${counts["no line"]}`)}</div>
      <div class="card">${ui.kpi("Outside filings identified", String(WP.outsideFilings().length), "in the register below")}</div></div>
      <h3 class="mb8">Every area considered</h3>
      <div class="tablewrap"><table><thead><tr><th>Area</th><th class="n">Lines</th><th class="n">Findings</th><th class="n">Open</th><th class="n">Reconciliations</th><th>Reviewer</th><th>Partner</th></tr></thead><tbody>${reg.map((r) => `<tr><td><b>${esc(r.area.label)}</b></td><td class="n">${r.lines}</td><td class="n">${r.findings}</td><td class="n ${r.open ? "pos" : ""}">${r.open}</td><td class="n">${r.recons ? r.recons - r.recDiff + "/" + r.recons + " agree" : "—"}</td><td>${ui.chip(r.rv === "none" ? "not signed" : r.rv, r.rv === "valid" ? "ok" : r.rv === "reopened" ? "err" : "")}</td><td>${ui.chip(r.pt === "none" ? "not signed" : r.pt, r.pt === "valid" ? "ok" : r.pt === "reopened" ? "err" : "")}</td></tr>`).join("")}</tbody></table></div>
      <h3 class="mt16 mb8">Every client answer, and where it landed</h3>
      <div class="tablewrap" style="max-height:60vh"><table><thead><tr><th>Answer</th><th>Question</th><th>Client said</th><th>Where it landed</th><th>Status</th><th></th></tr></thead><tbody>${qs.map(({ q, s }) => `<tr><td>${ui.refChip(q.id)}</td><td class="small">${esc(q.question.slice(0, 70))}</td><td class="small">${esc(String(q.answer).slice(0, 80))}</td><td class="small">${s.lines.map((k) => `<a class="num tiny" data-act="trace" data-key="${esc(k)}">${esc(k)}</a>`).join(" ") || '<span class="muted">—</span>'}<div class="tiny muted">${esc(s.note)}</div></td><td>${s.status === "flagged" ? `<a href="#/findings/${s.finding.id}" style="text-decoration:none">${ui.chip("flagged · " + s.finding.id, "err")}</a>` : ui.chip(s.status, s.status === "reflected" ? "ok" : "")}${s.considered ? " " + ui.chip("considered", "acc") : ""}</td><td><button class="btn sm" data-act="verify" data-key="${q.id}" data-type="confirmed_with_client">Mark considered</button></td></tr>`).join("")}</tbody></table></div>
      <div class="mt16">${ui.outsideReg()}</div>`;
  };
})();
