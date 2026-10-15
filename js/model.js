/* Packet model: indexes, derivation graph, source resolution, live evaluation of adjustments. */
window.WP = window.WP || {};
(function () {
  const U = WP.U;

  WP.buildModel = function (P) {
    const M = (WP.M = { P });
    M.docs = P.documents;
    M.docById = Object.fromEntries(P.documents.map((d) => [d.id, d]));
    M.evById = Object.fromEntries(P.extracted_values.map((e) => [e.id, e]));
    M.evsByDoc = {};
    P.extracted_values.forEach((e) => (M.evsByDoc[e.document_id] ||= []).push(e));
    M.rules = P.engine_reference.rules;
    M.params = P.engine_reference.parameters;
    M.household = P.household;
    M.staff = P.firm.staff;
    M.versionIds = P.return_versions.map((v) => v.version);
    M.cur = M.versionIds[M.versionIds.length - 1];
    M.verMap = {};

    P.return_versions.forEach((v) => {
      const idx = Object.fromEntries(v.lines.map((l) => [l.key, l]));
      const deps = {};
      v.lines.forEach((l) => (l.inputs || []).forEach((i) => (deps[i] ||= []).push(l.key)));
      // Infer how R-SUM / R-CARRY lines combine their inputs so adjustments can flow upward.
      const ops = {};
      v.lines.forEach((l) => {
        if (l.rule !== "R-SUM" && l.rule !== "R-CARRY") return;
        if (!l.inputs.length || !U.isNum(l.value)) return;
        const vals = l.inputs.map((i) => idx[i] && idx[i].value);
        if (!vals.every(U.isNum)) return;
        if (Math.abs(U.sum(vals) - l.value) < 1.01) ops[l.key] = "sum";
        else if (vals.length > 1 && Math.abs(vals[0] - U.sum(vals.slice(1)) - l.value) < 1.01) ops[l.key] = "diff";
      });
      M.verMap[v.version] = { v, idx, deps, ops, lines: v.lines };
    });

    M.ver = (id) => M.verMap[id || M.cur];
    M.line = (key, vid) => (M.ver(vid).idx[key]);
    M.curV = () => M.ver(M.cur);

    /* ---------- reverse indexes: which claims used which evidence / documents ---------- */
    const PY_DOC = {
      return_2024: ["D06"], prior_preparer_workpaper: ["D07"], asset_records: ["D07"], basis_records: ["D07"],
      carryovers_into_2025: ["D06", "D07"],
    };
    const AG_DOC = { irs_account_transcript_2025: ["D69"], notices: ["D70", "D72"], efile: [], ftb_account: [] };
    function buildReverse(vid) {
      const evToClaims = {}, docToClaims = {};
      M.ver(vid).lines.forEach((l) => {
        (l.sources || []).forEach((s) => {
          const docs = [];
          if (/^ev-\d+$/.test(s)) {
            (evToClaims[s] ||= []).push(l.key);
            const e = M.evById[s];
            if (e) docs.push(e.document_id);
          } else if (/^py:\//.test(s)) {
            const seg = s.split("/")[1];
            (PY_DOC[seg] || []).forEach((d) => docs.push(d));
          } else if (/^agency:\//.test(s)) {
            const seg = s.split("/")[1];
            (AG_DOC[seg] || []).forEach((d) => docs.push(d));
          }
          docs.forEach((d) => {
            const a = (docToClaims[d] ||= []);
            if (!a.includes(l.key)) a.push(l.key);
          });
        });
      });
      return { evToClaims, docToClaims };
    }
    M.rev = {};
    M.reverse = (vid = M.cur) => (M.rev[vid] ||= buildReverse(vid));

    /* ---------- source resolution ---------- */
    const ptr = (obj, p) => {
      const parts = p.split("/").slice(1).map((x) => decodeURIComponent(x).replace(/~1/g, "/").replace(/~0/g, "~"));
      let cur = obj;
      for (const k of parts) {
        if (cur === undefined || cur === null) return undefined;
        cur = cur[k];
      }
      return cur;
    };
    M.resolveSource = (s, vid) => {
      let m;
      if (/^ev-\d+$/.test(s)) {
        const e = M.evById[s];
        if (!e) return { kind: "missing", ref: s };
        const d = M.docById[e.document_id];
        return { kind: "ev", ref: s, ev: e, doc: d, page: e.page, title: `${d.id} p${e.page} · ${e.field}`, text: e.label, read: e.text_as_read, value: e.value, conf: e.confidence };
      }
      if (/^qa-/.test(s)) {
        const q = P.client.questionnaire.find((x) => x.id === s);
        return { kind: "qa", ref: s, title: s + " · client questionnaire", text: q && q.question, value: q && q.answer, q };
      }
      if (/^msg-/.test(s)) {
        const q = P.client.messages.find((x) => x.id === s);
        return { kind: "msg", ref: s, title: s + " · client message", text: q && q.text, q };
      }
      if (/^call-/.test(s)) {
        const q = P.client.call_notes.find((x) => x.id === s);
        return { kind: "call", ref: s, title: s + " · call note", text: q && q.notes.join(" "), q };
      }
      if (/^py:\//.test(s)) {
        const v = ptr(P.prior_years, s.slice(3));
        return { kind: "py", ref: s, title: "Prior year · " + s.slice(3), value: v, text: typeof v === "object" ? JSON.stringify(v) : String(v) };
      }
      if (/^agency:\//.test(s)) {
        const v = ptr(P.tax_agency_records, s.slice(7));
        return { kind: "agency", ref: s, title: "Agency record · " + s.slice(7), value: v, text: typeof v === "object" ? JSON.stringify(v) : String(v) };
      }
      if ((m = /^asset:(.+)$/.exec(s))) {
        const a = (M.ver(vid).v.assets || []).find((x) => x.asset_id === m[1]) || P.prior_years.asset_records.find((x) => x.asset_id === m[1]);
        return { kind: "asset", ref: s, title: "Asset " + m[1], asset: a, text: a && a.description };
      }
      if ((m = /^ref:param\.(.+)$/.exec(s))) return { kind: "ref", ref: s, title: "Engine parameter " + m[1], value: M.params[m[1]], text: String(ptr(M.params, "/" + m[1].split(".").join("/"))) };
      if ((m = /^ref:fx\.SEK\.(.+)$/.exec(s))) return { kind: "ref", ref: s, title: "FX SEK/USD " + m[1], value: M.params.fx.SEK[m[1]], text: `${M.params.fx.SEK[m[1]]} SEK per USD (${m[1]})` };
      if ((m = /^timeline:(.+)$/.exec(s))) {
        const t = P.timeline.find((x) => x.id === m[1]);
        return { kind: "timeline", ref: s, title: "Timeline " + m[1], text: t && t.event + " · " + U.date(t.at), t };
      }
      if ((m = /^household:(.+)$/.exec(s))) {
        const p = P.household.people.find((x) => x.id === m[1]);
        return { kind: "household", ref: s, title: "Household · " + (p ? p.name : m[1]), text: p && p.name, p };
      }
      if ((m = /^D\d+$/.exec(s))) return { kind: "doc", ref: s, doc: M.docById[s], title: s };
      return { kind: "other", ref: s, title: s };
    };

    /* ---------- live evaluation of adjustments over the derivation graph ---------- */
    M.evaluate = (vid, adjs) => {
      const V = M.ver(vid);
      const by = {};
      adjs.forEach((a) => (by[a.target] ||= []).push(a));
      const memo = {}, changed = {}, stale = {};
      function val(key) {
        if (key in memo) return memo[key];
        const l = V.idx[key];
        if (!l) return (memo[key] = undefined);
        memo[key] = l.value; // cycle guard
        let v = l.value, ch = false, st = false;
        const ins = l.inputs || [];
        if (ins.length) {
          const iv = ins.map(val);
          const anyCh = ins.some((k, i) => changed[k] || stale[k]);
          if (anyCh) {
            const op = V.ops[key];
            if (op && iv.every(U.isNum)) {
              v = op === "sum" ? U.sum(iv) : iv[0] - U.sum(iv.slice(1));
              ch = true;
            } else st = true;
          }
        }
        (by[key] || []).forEach((a) => {
          if (a.mode === "set") v = a.amount;
          else v = (U.isNum(v) ? v : 0) + a.amount;
          ch = true;
        });
        memo[key] = v; changed[key] = ch; stale[key] = st && !ch;
        return v;
      }
      V.lines.forEach((l) => val(l.key));
      return {
        get: (k) => memo[k],
        orig: (k) => (V.idx[k] ? V.idx[k].value : undefined),
        changed: (k) => !!changed[k],
        stale: (k) => !!stale[k],
        delta: (k) => (U.isNum(memo[k]) && V.idx[k] && U.isNum(V.idx[k].value) ? memo[k] - V.idx[k].value : 0),
      };
    };

    /* BFS downstream of a claim: the chain a change travels through the return. */
    M.downstream = (key, vid) => {
      const V = M.ver(vid), seen = new Set([key]), order = [], q = [key];
      while (q.length) {
        const k = q.shift();
        (V.deps[k] || []).forEach((n) => { if (!seen.has(n)) { seen.add(n); order.push(n); q.push(n); } });
      }
      return order;
    };

    /* ---------- tax effect: change x rate (the README forbids rerunning the engine) ---------- */
    M.rates = (vid = M.cur) => M.ver(vid).v.tax_effect_rates;
    M.CATEGORIES = {
      wages: "Wages (federal + CA-source wages)",
      interest: "Interest and dividends",
      schc_profit: "Schedule C profit (drives SE tax and QBI)",
      stcg: "Short-term capital gain",
      ltcg: "Long-term capital gain",
      ordinary_income: "Other ordinary income (CA-source)",
      adjustment: "Adjustment to income",
      salt: "State and local taxes (subject to cap)",
      itemized: "Other itemized deductions",
      ca_source_income: "California-source income only",
      fed_itemized: "Federal itemized deduction only (cap-aware)",
      credit: "Credit (1:1 against tax)",
      payment: "Payment (1:1 against balance)",
      none: "No tax effect (data correction)",
    };
    /* amount: change in the line's value. sign: +1 if raising the line raises income (or the measured quantity). */
    M.effectOf = (adj, vid) => {
      const r = M.rates(vid);
      const l = M.ver(vid).idx[adj.target];
      const base = l ? l.value : 0;
      let d = adj.mode === "set" ? adj.amount - (U.isNum(base) ? base : 0) : adj.amount;
      d = d * (adj.sign || 1);
      const out = { taxFed: 0, taxCA: 0, balFed: 0, balCA: 0 };
      const c = adj.category;
      if (c === "none" || !c) return out;
      if (c === "payment") {
        const jur = l ? l.jurisdiction : "federal";
        if (jur === "california") out.balCA = -d; else out.balFed = -d;
        return out;
      }
      if (c === "credit") {
        const jur = l ? l.jurisdiction : "federal";
        if (jur === "california") { out.taxCA = -d; out.balCA = -d; } else { out.taxFed = -d; out.balFed = -d; }
        return out;
      }
      if (c === "fed_itemized") {
        out.taxFed = d * r.itemized.federal_per_dollar;
        out.balFed = out.taxFed;
        return out;
      }
      const rt = r[c];
      if (!rt) return out;
      out.taxFed = d * rt.federal_per_dollar;
      out.taxCA = d * rt.california_per_dollar;
      out.balFed = out.taxFed;
      out.balCA = out.taxCA;
      return out;
    };

    M.totals = (adjs, vid = M.cur) => {
      const s = M.ver(vid).v.summary;
      const ev = M.evaluate(vid, adjs);
      const e = { taxFed: 0, taxCA: 0, balFed: 0, balCA: 0 };
      adjs.forEach((a) => {
        const x = M.effectOf(a, vid);
        for (const k in e) e[k] += x[k];
      });
      const agi = ev.get("F1040.11");
      const cagi = ev.get("F540NR.17");
      return {
        e,
        federal: {
          agi: U.isNum(agi) ? agi : s.federal.agi,
          taxable_income: s.federal.taxable_income + (U.isNum(agi) ? agi - s.federal.agi : 0),
          total_tax: s.federal.total_tax + e.taxFed,
          payments: s.federal.payments - (e.balFed - e.taxFed),
          balance_due: s.federal.balance_due + e.balFed,
        },
        california: {
          total_agi: U.isNum(cagi) ? cagi : s.california.total_agi,
          total_tax: s.california.total_tax + e.taxCA,
          payments: s.california.payments - (e.balCA - e.taxCA),
          balance_due: s.california.balance_due + e.balCA,
        },
        base: s,
      };
    };

    /* ---------- page text with highlights for the simulated source document ---------- */
    const variants = (t) => {
      const out = new Set([t]);
      const s = String(t).trim();
      out.add(s.replace(/\.00$/, ""));
      const n = Number(s.replace(/,/g, ""));
      if (s !== "" && isFinite(n)) {
        out.add(n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        out.add(n.toLocaleString("en-US", { maximumFractionDigits: 0 }));
      }
      let m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(s);
      if (m) out.add(`${m[3]}-${m[1]}-${m[2]}`);
      return [...out].filter((x) => x.length > 0);
    };
    M.pageSegments = (docId, pageNo) => {
      const d = M.docById[docId];
      const pg = d.pages.find((p) => p.page === pageNo);
      const text = pg ? pg.printed_content : "";
      const evs = (M.evsByDoc[docId] || []).filter((e) => e.page === pageNo).sort((a, b) => a.position.y0 - b.position.y0 || a.position.x0 - b.position.x0);
      const cursor = {}, ranges = [], unlocated = [];
      evs.forEach((e) => {
        const t = e.text_as_read;
        if (!t || (t.length < 2 && e.value_type === "boolean")) { unlocated.push(e); return; }
        let found = -1, len = 0;
        for (const v of variants(t)) {
          const from = cursor[v] || 0;
          let i = text.indexOf(v, from);
          // numeric tokens must not be glued to other digits
          while (i >= 0 && /^[\d.,-]/.test(v) && (/[\d]/.test(text[i - 1] || "") || /[\d]/.test(text[i + v.length] || ""))) i = text.indexOf(v, i + 1);
          if (i >= 0) { found = i; len = v.length; cursor[v] = i + len; break; }
        }
        if (found >= 0) ranges.push({ s: found, e: found + len, ev: e });
        else unlocated.push(e);
      });
      ranges.sort((a, b) => a.s - b.s);
      const segs = [];
      let pos = 0;
      ranges.forEach((r) => {
        if (r.s < pos) return;
        if (r.s > pos) segs.push({ text: text.slice(pos, r.s) });
        segs.push({ text: text.slice(r.s, r.e), ev: r.ev });
        pos = r.e;
      });
      if (pos < text.length) segs.push({ text: text.slice(pos) });
      return { segs, unlocated, text };
    };

    /* ---------- clients' own household, with approved corrections layered over ---------- */
    M.person = (id) => P.household.people.find((p) => p.id === id);

    return M;
  };
})();
