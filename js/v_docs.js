/* Documents: proof of completeness (every document used, or why not) and the simulated source viewer. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;
  const KIND_CHIP = { used: ["used", "ok"], superseded: ["superseded", "warn"], duplicate: ["duplicate", "warn"], not_extracted: ["not extracted", "info"], administrative: ["procedural", "acc"], unused: ["not used", "err"] };

  ui.views.documents = (r) => {
    const M = WP.M, S = WP.store.state;
    const rows = M.docs.map((d) => ({ d, disp: WP.docDisposition(d.id) }));
    const counts = {};
    rows.forEach((x) => (counts[x.disp.kind] = (counts[x.disp.kind] || 0) + 1));
    const f = r.q.k || "";
    const shown = rows.filter((x) => !f || x.disp.kind === f);
    const isClient = WP.me().role === "client";
    const partial = M.docs.filter((d) => d.extraction.status !== "extracted");
    return `<div class="pagehead"><div><h1>Documents</h1><div class="sub">Completeness proof: all ${M.docs.length} documents accounted for. ${isClient ? "Everything you uploaded is listed here." : ""}</div></div></div>
      <div class="row wrap mb8">${Object.entries(counts).map(([k, n]) => `<a href="#/documents${f === k ? "" : "?k=" + k}" style="text-decoration:none">${ui.chip(`${KIND_CHIP[k] ? KIND_CHIP[k][0] : k}: ${n}`, f === k ? "acc" : KIND_CHIP[k] ? KIND_CHIP[k][1] : "")}</a>`).join("")}${f ? `<a href="#/documents" class="small">clear</a>` : ""}</div>
      ${partial.length ? `<div class="callout warn mb8 small"><b>${partial.length} documents were not fully extracted:</b> ${partial.map((d) => `${d.id} (${d.extraction.status})`).join(", ")}. Their printed text is still shown; nothing is hidden because the pipeline skipped it.</div>` : ""}
      <div class="tablewrap"><table><thead><tr><th>Doc</th><th>Title</th><th>For</th><th>Received</th><th>By</th><th class="n">Pages</th><th>Extraction</th><th>Disposition</th><th class="n">Lines fed</th></tr></thead><tbody>
      ${shown.map(({ d, disp }) => {
        const k = KIND_CHIP[disp.kind] || [disp.kind, ""];
        const n = (M.reverse().docToClaims[d.id] || []).length;
        const minc = Math.min(1, ...(M.evsByDoc[d.id] || []).map((e) => e.confidence));
        return `<tr class="click" data-act="nav" data-to="#/doc/${d.id}"><td class="mono"><b>${d.id}</b></td><td>${esc(d.title.slice(0, 70))}${d.marked_corrected ? " " + ui.chip("CORRECTED", "warn") : ""}</td><td class="small">${esc(d.belongs_to)}</td><td class="small mono">${U.date(d.received_at)}</td><td class="small">${esc(d.uploaded_by)}</td><td class="n">${d.page_count}</td>
          <td>${ui.chip(d.extraction.status, d.extraction.status === "extracted" ? "" : "warn")} ${minc < 0.8 ? ui.chip("min conf " + minc, "err") : ""}</td><td title="${esc(disp.reason)}">${ui.chip(k[0], k[1])} <span class="tiny muted">${esc(disp.reason.slice(0, 60))}</span></td><td class="n">${n || ""}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  };

  ui.views.doc = (r) => {
    const M = WP.M, S = WP.store.state;
    const id = r.args[0], d = M.docById[id];
    if (!d) return `<div class="callout err">Document ${esc(id)} not found.</div>`;
    const pageNo = +(r.q.p || 1), focus = r.q.ev || null;
    const disp = WP.docDisposition(id);
    const evs = (M.evsByDoc[id] || []);
    const rv = M.reverse();
    const claims = rv.docToClaims[id] || [];
    const reveal = ui.revealedDocs.has(id) && WP.canSeeSensitive();
    const notes = S.notes[id] || [];
    const threads = S.threadOrder.map((t) => S.threads[t]).filter((t) => t.target === id);
    const flagPage = WP.docFlags[id + "#" + pageNo];
    const evOnPage = evs.filter((e) => e.page === pageNo);
    const k = KIND_CHIP[disp.kind] || [disp.kind, ""];
    const landed = evs.filter((e) => (rv.evToClaims[e.id] || []).length).length;
    return `<div class="pagehead"><div><div class="muted small"><a href="#/documents">Documents</a> ›</div><h1>${esc(d.id)} · ${esc(d.title)}</h1>
      <div class="sub">${esc(d.issuer || "")} · for ${esc(d.belongs_to)} · received ${U.date(d.received_at)} from ${esc(d.uploaded_by)} · ${esc(d.file_name)}</div></div><div class="grow"></div>
      ${WP.canSeeSensitive() ? `<button class="btn" data-act="${reveal ? "noop" : "reveal-doc"}" data-id="${id}">${reveal ? "Sensitive values shown (logged)" : "Reveal sensitive values (logged)"}</button>` : `<span class="chip warn">🔒 sensitive values masked for your role</span>`}
      <button class="btn" data-act="note-add" data-target="${id}">Attach note / file</button>
      <button class="btn" data-act="thread-new" data-target="${id}" data-title="Question about ${id}">Ask about this document</button></div>
      <div class="row wrap mb8">${ui.chip(k[0], k[1])} <span class="small muted">${esc(disp.reason)}</span>${d.marked_corrected ? ui.chip("Marked CORRECTED by the issuer", "warn") : ""}${ui.chip("extraction: " + d.extraction.status, d.extraction.status === "extracted" ? "" : "warn")}${d.extraction.reason ? `<span class="small muted">${esc(d.extraction.reason)}</span>` : ""}</div>
      ${ui.aiDocBlock ? `<div class="mb8">${ui.aiDocBlock(id)}</div>` : ""}
      <div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)">
        <div class="col">
          <div class="row wrap">${d.pages.map((p) => `<a class="chip ${p.page === pageNo ? "acc" : ""}" href="#/doc/${id}?p=${p.page}" style="text-decoration:none">page ${p.page}${WP.docFlags[id + "#" + p.page] ? " ⚠ duplicate" : ""}</a>`).join("")}
            <span class="legend"><span><mark class="hl">≥0.9</mark></span><span><mark class="hl mid">0.7–0.9</mark></span><span><mark class="hl lo">&lt;0.7</mark></span></span></div>
          ${flagPage ? `<div class="callout warn small">Page ${pageNo} is a second scan of another page of this document. See the finding for the effect.</div>` : ""}
          ${ui.paper(id, pageNo, focus)}
          <div class="tiny muted">Simulated source: rendered from the packet's <code>printed_content</code>. Highlights are placed by text match, so a real page image with the packet's coordinates can replace this view without changing any trace link.</div>
        </div>
        <div class="col">
          <div class="card"><h4>What this document fed (${landed}/${evs.length} values cited)</h4>
            ${claims.length ? `<div class="refs mt8">${claims.slice(0, 40).map((k2) => `<a class="ref" data-act="trace" data-key="${esc(k2)}" title="${esc(M.line(k2).label)}">${esc(k2)}</a>`).join("")}${claims.length > 40 ? `<span class="muted tiny">+${claims.length - 40} more</span>` : ""}</div>` : `<div class="mt8 small"><b>No line cites this document.</b> ${esc(disp.reason)}</div>`}</div>
          <div class="tablewrap" style="max-height:44vh"><table><thead><tr><th>Field</th><th>Printed</th><th>Read</th><th>Conf</th><th>Landed in</th></tr></thead><tbody>
          ${evOnPage.map((e) => { const cl = rv.evToClaims[e.id] || []; const sensitive = e.value_type === "ssn" || e.value_type === "account_number";
            return `<tr class="click ${focus === e.id ? "sub" : ""}" data-act="nav" data-to="#/doc/${id}?p=${pageNo}&ev=${e.id}"><td class="small"><div class="mono">${esc(e.field)}</div><div class="tiny muted">${esc(e.label.slice(0, 40))}</div></td><td class="mono small">${sensitive && !reveal ? "••••" : esc(e.text_as_read || "—")}</td><td class="mono small">${sensitive ? ui.sens(e.value, e.value_type === "ssn" ? "ssn" : "acct") : esc(String(e.value).slice(0, 28))}</td>
              <td><span class="conf ${ui.confCls(e.confidence)}"><i style="width:${e.confidence * 100}%"></i></span> <span class="tiny mono">${e.confidence}</span></td><td>${cl.length ? cl.slice(0, 3).map((k2) => `<a class="num tiny" data-act="trace" data-key="${esc(k2)}">${esc(k2)}</a>`).join(" ") + (cl.length > 3 ? ` <span class="tiny muted">+${cl.length - 3}</span>` : "") : `<span class="tiny muted">${esc(e.value_type === "text" || e.value_type === "date" ? "not used" : "not cited")}</span>`}</td></tr>`; }).join("") || `<tr><td colspan="5" class="muted">No values were extracted from this page.</td></tr>`}
          </tbody></table></div>
          ${notes.length || threads.length ? `<div class="card"><h4>Notes and conversation</h4>${notes.map((n) => `<div class="msg small"><b>${esc(n.name)}</b> <span class="muted">${n.kind} · ${U.date(n.ts)}</span><div>${esc(n.text || "")}</div>${n.file ? `<div>📎 ${esc(n.file.name)}</div>` : ""}</div>`).join("")}${threads.map((t) => `<div class="msg small"><a href="#/people/threads/${t.id}">${esc(t.title)}</a> ${ui.chip(t.status)}</div>`).join("")}</div>` : ""}
        </div>
      </div>`;
  };
  ui.acts.noop = () => {};
  ui.post = null;
})();
