/* Shared actions: every write goes through here and becomes an event in the log. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;
  const A = ui.acts;

  const staffOptions = (withClients) =>
    WP.users.filter((u) => withClients || u.kind === "staff").map((u) => [u.id, `${u.name} · ${WP.roleLabel(u.role)}`]);

  /* ---------- adjustments ---------- */
  ui.propose = (list, ctx = {}) => {
    if (!ui.guard("propose")) return null;
    const batch = ui.batch();
    list.forEach((a) =>
      WP.store.append("adj.propose", {
        id: U.uid("adj"), target: a.target, mode: a.mode, amount: a.amount, category: a.category, sign: a.sign || 1,
        reason: a.reason || a.note || "", note: a.note || "", label: a.label || "", findingId: ctx.findingId || null,
        evidence: ctx.refs || [], whatif: !!a.whatif, area: WP.areaOfKey(a.target),
      }, { batch })
    );
    if (ctx.findingId) WP.store.append("finding.set", { id: ctx.findingId, status: "accepted", note: `${list.length} adjustment(s) proposed` }, { batch });
    return batch;
  };
  A["adj-propose"] = (el) => {
    const f = WP.findingById[el.dataset.fid];
    const sid = el.dataset.sid;
    const sug = sid === "all" ? f.suggest : f.suggest.filter((s) => s.sid === sid);
    const b = ui.propose(sug.map((s) => ({ ...s, reason: `${f.title}. ${s.note}` })), { findingId: f.id, refs: f.refs });
    if (b) {
      const t = WP.live().totals.e;
      ui.toast(`Proposed ${sug.length} adjustment(s). Estimated tax effect: federal ${U.signed(Math.round(sug.reduce((s, x) => s + x.effect.taxFed, 0)))}, California ${U.signed(Math.round(sug.reduce((s, x) => s + x.effect.taxCA, 0)))}. Original values are kept.`);
    }
  };
  A["adj-new"] = async (el) => {
    if (!ui.guard("propose")) return;
    const target = el.dataset.key || "";
    const wi = !!el.dataset.whatif;
    const l = WP.M.line(target);
    const r = await ui.form({
      title: "Adjust without losing the original",
      intro: l ? `<b>${esc(l.label)}</b><br>Engine value: <span class="mono">${esc(ui.fmtVal(l.value))}</span>. The original stays on record; the adjustment is a separate, reviewable entry.` : "Enter a line key such as SchC.25.",
      fields: [
        { name: "target", label: "Line key", value: target, required: true },
        { name: "mode", label: "How", type: "select", value: "delta", options: [["delta", "Change by (add this amount)"], ["set", "Set to (new value)"]] },
        { name: "amount", label: "Amount", type: "number", step: "0.01", required: true },
        { name: "category", label: "Tax effect category", type: "select", value: "schc_profit", options: Object.entries(WP.M.CATEGORIES) },
        { name: "sign", label: "Raising this line…", type: "select", value: "1", options: [["1", "raises income / the measured quantity"], ["-1", "lowers income (an expense line)"]] },
        { name: "reason", label: "Reason (who, why)", type: "textarea", required: true },
        { name: "whatif", label: "What-if only (keep out of the return)", type: "checkbox", value: wi },
      ],
      submit: "Propose adjustment",
    });
    if (!r) return;
    if (!WP.M.line(r.target) && !/^household:/.test(r.target)) return ui.toast(`Unknown line key ${r.target}`, "err");
    const b = ui.propose([{ ...r, sign: Number(r.sign) }], { refs: [] });
    if (b) {
      const a = WP.adjList().slice(-1)[0];
      ui.toast(`Proposed. Estimated effect: federal ${U.signed(Math.round(a.effect.taxFed))}, California ${U.signed(Math.round(a.effect.taxCA))}${Math.max(Math.abs(a.effect.taxFed), Math.abs(a.effect.taxCA)) > WP.store.state.standards.partner_threshold ? ". Over the threshold: needs partner approval." : ""}`);
    }
  };
  A["adj-decide"] = async (el) => {
    const a = WP.adjList().find((x) => x.id === el.dataset.id);
    const dec = el.dataset.dec;
    if (dec === "approve" && !ui.guard("approve", { adj: a })) return;
    if (dec === "reject" && !ui.guard("approve", { adj: a })) return;
    const r = await ui.form({ title: dec === "approve" ? "Approve adjustment" : "Reject adjustment", intro: `${esc(a.target)} · ${esc(a.label || a.reason)}<br>Tax effect: federal ${U.signed(Math.round(a.effect.taxFed))}, California ${U.signed(Math.round(a.effect.taxCA))}`, fields: [{ name: "note", label: "Note", type: "textarea", required: dec === "reject" }], submit: dec === "approve" ? "Approve" : "Reject" });
    if (!r) return;
    WP.store.append("adj.decide", { id: a.id, decision: dec, note: r.note }, { batch: ui.batch() });
  };
  A["adj-revert"] = async (el) => {
    const a = WP.adjList().find((x) => x.id === el.dataset.id);
    if (a.author !== WP.store.userId && !WP.can("approve_any").ok && !WP.can("approve_small").ok) return ui.toast("Only the author, a reviewer or a partner can revert.", "err");
    const r = await ui.form({ title: "Revert adjustment", intro: "The adjustment stays in the ledger as reverted; the original value returns to the return.", fields: [{ name: "note", label: "Why", type: "textarea", required: true }], submit: "Revert" });
    if (r) WP.store.append("adj.revert", { id: a.id, note: r.note }, { batch: ui.batch() });
  };
  A["adj-whatif"] = (el) => { const a = WP.adjList().find((x) => x.id === el.dataset.id); WP.store.append("adj.whatif", { id: a.id, on: !a.whatif }, { batch: ui.batch() }); };
  A["adj-bulk"] = async (el) => {
    const ids = Array.from(document.querySelectorAll("input.adjchk:checked")).map((c) => c.value);
    if (!ids.length) return ui.toast("Select adjustments first.");
    const dec = el.dataset.dec;
    const list = WP.adjList().filter((a) => ids.includes(a.id));
    const r = await ui.form({ title: `${dec} ${list.length} adjustment(s)`, intro: "One batch: a single undo reverses all of them.", fields: [{ name: "note", label: "Note", type: "textarea", required: dec !== "approve" }], submit: dec[0].toUpperCase() + dec.slice(1), danger: dec !== "approve" });
    if (!r) return;
    const batch = ui.batch();
    let done = 0, skipped = [];
    list.forEach((a) => {
      if (dec === "revert") { WP.store.append("adj.revert", { id: a.id, note: r.note }, { batch }); done++; return; }
      const can = WP.can("approve", { adj: a });
      if (!can.ok) { skipped.push(`${a.target}: ${can.why}`); return; }
      WP.store.append("adj.decide", { id: a.id, decision: dec, note: r.note }, { batch }); done++;
    });
    ui.toast(`${done} done` + (skipped.length ? `; ${skipped.length} blocked by roles (${skipped[0]})` : ""), skipped.length ? "err" : "");
  };

  /* ---------- verification ---------- */
  A.verify = async (el) => {
    if (!ui.guard("verify")) return;
    const key = el.dataset.key;
    const r = await ui.form({
      title: "Record how this number was verified",
      intro: esc(key) + " · " + esc((WP.M.line(key) || {}).label || ""),
      fields: [
        { name: "vtype", label: "Verification type", type: "select", value: el.dataset.type || WP.store.state.standards.verification_types[0], options: WP.store.state.standards.verification_types.map((t) => [t, t.replace(/_/g, " ")]) },
        { name: "evidence", label: "Evidence (document page, message, record)", placeholder: "e.g. D08p1, msg-08, agency:/irs_account_transcript_2025" },
        { name: "note", label: "Note", type: "textarea" },
      ],
      submit: "Record verification",
    });
    if (r) { WP.store.append("verify.add", { target: key, vtype: r.vtype, evidence: r.evidence, note: r.note }, { batch: ui.batch() }); ui.toast("Verification recorded."); }
  };

  /* ---------- findings ---------- */
  A["finding-set"] = async (el) => {
    if (!ui.guard("finding")) return;
    const f = WP.findingById[el.dataset.fid], st = el.dataset.st;
    const r = await ui.form({ title: { accepted: "Accept finding", dismissed: "Dismiss finding", resolved: "Mark resolved", open: "Reopen finding" }[st], intro: esc(f.title), fields: [{ name: "note", label: st === "dismissed" ? "Why is this not an issue? (required, becomes evidence)" : "Note / how it was resolved", type: "textarea", required: st === "dismissed" || st === "resolved" }], submit: "Save" });
    if (r) WP.store.append("finding.set", { id: f.id, status: st, note: r.note }, { batch: ui.batch() });
  };
  A["finding-assign"] = async (el) => {
    const f = WP.findingById[el.dataset.fid];
    const r = await ui.form({ title: "Assign finding", intro: esc(f.title), fields: [{ name: "assignee", label: "Assign to", type: "select", options: staffOptions(false) }], submit: "Assign" });
    if (r) WP.store.append("finding.assign", { id: f.id, assignee: r.assignee });
  };

  /* ---------- threads: questions, review notes, tasks ---------- */
  A["thread-new"] = async (el) => {
    const me = WP.me();
    const kindDefault = el.dataset.kind || "colleague_question";
    const kinds = [["client_question", "Question to the client"], ["colleague_question", "Question to a colleague"], ["review_note", "Review note"], ["task", "Task / assignment"]];
    const r = await ui.form({
      title: "New thread",
      intro: "Questions and notes attach to a number or document and become part of the evidence.",
      fields: [
        { name: "kind", label: "Kind", type: "select", value: kindDefault, options: me.role === "client" ? [["client_question", "Question for the firm"]] : kinds },
        { name: "title", label: "Title", required: true, value: el.dataset.title || "" },
        { name: "text", label: "Message", type: "textarea", required: true, value: el.dataset.text || "" },
        { name: "target", label: "Attached to (line key, document id or finding id)", value: el.dataset.target || "" },
        { name: "assignee", label: "Assigned to", type: "select", value: el.dataset.assignee || "", options: [["", "— nobody —"], ...staffOptions(true)] },
        { name: "due", label: "Due", type: "date", value: el.dataset.due || "" },
        { name: "blocking", label: "Blocks filing until resolved (review notes)", type: "checkbox", value: kindDefault === "review_note" },
      ],
      submit: "Create",
    });
    if (!r) return;
    if (r.kind === "review_note" && !ui.guard("block_note")) return;
    if (r.kind !== "client_question" && me.role === "client") return ui.toast("Clients can ask the firm questions only.", "err");
    if (!ui.guard(me.role === "client" ? "answer" : "thread")) return;
    const id = U.uid("th");
    WP.store.append("thread.open", { id, kind: r.kind, title: r.title, text: r.text, target: r.target, assignee: r.assignee || (r.kind === "client_question" ? "cu-01" : ""), due: r.due, blocking: r.blocking && r.kind === "review_note", visibility: r.kind === "client_question" ? "client" : "internal" }, { batch: ui.batch() });
    ui.toast("Thread created.");
    return id;
  };
  A["thread-reply"] = async (el) => {
    const me = WP.me();
    if (!ui.guard(me.role === "client" ? "answer" : "thread")) return;
    const t = WP.store.state.threads[el.dataset.id];
    const r = await ui.form({
      title: "Reply", intro: esc(t.title),
      fields: [
        { name: "text", label: "Message", type: "textarea", required: true },
        { name: "file", label: "Attach a file (optional)", type: "file", hint: "Stored in the log (small files only)" },
        ...(me.role === "client" ? [{ name: "answers", label: "This answers the question", type: "checkbox", value: true }] : []),
      ],
      submit: "Send",
    });
    if (!r) return;
    WP.store.append("thread.reply", { id: t.id, text: r.text, attachments: r.file ? [r.file] : [], answers: !!r.answers }, { batch: ui.batch() });
  };
  A["thread-status"] = async (el) => {
    const t = WP.store.state.threads[el.dataset.id], st = el.dataset.st;
    if (t.kind === "review_note" && !ui.guard("block_note")) return;
    const claim = WP.M.line(t.target);
    const r = await ui.form({
      title: st === "resolved" ? "Resolve thread" : "Reopen thread", intro: esc(t.title),
      fields: [{ name: "note", label: "Resolution note", type: "textarea", required: st === "resolved" }, ...(st === "resolved" && claim ? [{ name: "verify", label: `Record as verification of ${t.target} (confirmed with client / colleague)`, type: "checkbox", value: true }] : [])],
      submit: "Save",
    });
    if (!r) return;
    const batch = ui.batch();
    WP.store.append("thread.status", { id: t.id, status: st, note: r.note }, { batch });
    if (r.note) WP.store.append("thread.reply", { id: t.id, text: `[${st}] ${r.note}`, attachments: [] }, { batch });
    if (r.verify && claim) WP.store.append("verify.add", { target: t.target, vtype: t.kind === "client_question" ? "confirmed_with_client" : "agreed_to_third_party_record", evidence: `thread:${t.id}`, note: r.note || t.title }, { batch });
  };
  A["thread-assign"] = async (el) => {
    if (!WP.can("assign").ok && !WP.can("thread").ok) return ui.toast("You cannot assign work.", "err");
    const t = WP.store.state.threads[el.dataset.id];
    const r = await ui.form({ title: "Assign", intro: esc(t.title), fields: [{ name: "assignee", label: "Assign to", type: "select", value: t.assignee, options: staffOptions(true) }, { name: "due", label: "Due", type: "date", value: t.due }], submit: "Assign" });
    if (r) WP.store.append("thread.assign", { id: t.id, assignee: r.assignee, due: r.due });
  };

  /* ---------- notes, messages, attachments ---------- */
  A["note-add"] = async (el) => {
    const me = WP.me();
    if (!ui.guard(me.role === "client" ? "client_note" : "note")) return;
    const r = await ui.form({
      title: "Attach evidence", intro: `Attached to <b>${esc(el.dataset.target)}</b>. Any file, message or note can serve as evidence.`,
      fields: [
        { name: "kind", label: "Kind", type: "select", value: "note", options: [["note", "Note"], ["message", "Message (paste from email / chat)"], ["file", "File"]] },
        { name: "text", label: "Text", type: "textarea" },
        { name: "file", label: "File", type: "file" },
      ],
      submit: "Attach",
    });
    if (!r) return;
    if (!r.text && !r.file) return ui.toast("Add text or a file.", "err");
    WP.store.append("note.add", { target: el.dataset.target, kind: r.kind, text: r.text, file: r.file }, { batch: ui.batch() });
  };

  /* ---------- decisions: judgment, election, due diligence, penalty ---------- */
  A["decision-add"] = async (el) => {
    if (!ui.guard("decision")) return;
    const topics = [["", "—"], ["ctc_odc", "Child tax credit / other dependents"], ["aotc", "American opportunity credit"], ["eic", "Earned income credit"], ["hoh", "Head of household"]];
    const r = await ui.form({
      title: "Record a decision",
      intro: "Every judgment call records the authority relied on. Elections, due diligence and penalty decisions live here.",
      fields: [
        { name: "kind", label: "Kind", type: "select", value: el.dataset.kind || "judgment", options: [["judgment", "Judgment call"], ["election", "Election"], ["due_diligence", "Due diligence (Form 8867)"], ["penalty", "Penalty / reasonable cause"]] },
        { name: "topic", label: "Due-diligence topic (if applicable)", type: "select", value: el.dataset.topic || "", options: topics },
        { name: "title", label: "Decision", required: true, value: el.dataset.title || "" },
        { name: "body", label: "Facts, analysis and conclusion", type: "textarea", required: true, value: el.dataset.body || "" },
        { name: "authority", label: "Authority relied on (statute, regulation, ruling, form instructions)", required: true, value: el.dataset.authority || "" },
        { name: "target", label: "Related line or finding", value: el.dataset.target || "" },
      ],
      submit: "Record decision",
    });
    if (!r) return;
    const id = U.uid("dec");
    const batch = ui.batch();
    WP.store.append("decision.add", { id, ...r }, { batch });
    if (el.dataset.fid) WP.store.append("finding.set", { id: el.dataset.fid, status: "resolved", note: `Decision recorded: ${r.title}` }, { batch });
    ui.toast("Decision recorded.");
  };
  A["decision-approve"] = async (el) => {
    if (!ui.guard("release")) return;
    const r = await ui.form({ title: "Approve decision", fields: [{ name: "note", label: "Note", type: "textarea" }], submit: "Approve as partner" });
    if (r) WP.store.append("decision.approve", { id: el.dataset.id, note: r.note });
  };

  /* ---------- sign-offs ---------- */
  A.signoff = async (el) => {
    const area = el.dataset.area, level = el.dataset.level;
    if (!ui.guard("signoff", { area, level })) return;
    const open = WP.findings.filter((f) => f.area === area && (f.sev === "error" || f.sev === "warning") && WP.findingState(f.id).status === "open");
    const blocking = WP.openBlockers().filter((t) => WP.areaOfKey(t.target) === area);
    const r = await ui.form({
      title: `${level === "partner" ? "Partner" : "Reviewer"} sign-off: ${WP.areaLabel(area)}`,
      intro: `You are attesting to ${WP.areaKeys(area).length} lines as they stand now. If any of them change, this sign-off reopens automatically.` +
        (open.length ? `<div class="callout warn mt8">${open.length} open finding(s) in this area: ${open.map((f) => esc(f.id)).join(", ")}.</div>` : "") +
        (blocking.length ? `<div class="callout err mt8">${blocking.length} blocking review note(s) open in this area.</div>` : ""),
      fields: [{ name: "note", label: "Note (optional)", type: "textarea" }],
      submit: "Sign",
    });
    if (!r) return;
    if (blocking.length) return ui.toast("Open review notes block sign-off in this area.", "err");
    WP.store.append("signoff.add", { id: U.uid("so"), area, level, values: WP.areaSnapshot(area), note: r.note }, { batch: ui.batch() });
    ui.toast("Signed. It will reopen if anything it covers changes.");
  };
  A["signoff-revoke"] = async (el) => {
    const so = WP.store.state.signoffs[el.dataset.id];
    if (so.by !== WP.store.userId && !WP.can("release").ok) return ui.toast("Only the signer or a partner can revoke.", "err");
    WP.store.append("signoff.revoke", { id: so.id });
  };

  /* ---------- time ---------- */
  A["time-add"] = async (el) => {
    if (!ui.guard("time")) return;
    const r = await ui.form({ title: "Log time", fields: [{ name: "area", label: "Area", type: "select", value: el.dataset.area || WP.AREAS[1].key, options: WP.AREAS.map((a) => [a.key, a.label]) }, { name: "hours", label: "Hours", type: "number", step: "0.25", required: true }, { name: "note", label: "What was done" }], submit: "Log" });
    if (r && r.hours > 0) WP.store.append("time.add", r);
  };

  /* ---------- step toggles ---------- */
  A["step-set"] = (el) => {
    if (!ui.guard("verify")) return;
    WP.store.append("step.set", { step: el.dataset.step, done: el.dataset.done === "1" });
  };
})();
