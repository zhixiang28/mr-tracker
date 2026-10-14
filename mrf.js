/* Materials Requisition Form rules shared by the form, the signing page, the viewer and the PDFs.
   - Authorisation limits (page 2 of the form): who must approve a requisition of a given amount
   - Signing steps: new requisitions have 3 (Manager -> Procurement -> Received); older ones keep their 4
   MRF.required(total)          -> {who, upTo, doc}   lowest appointment that may approve, and PO / LOA rule if any
   MRF.requiredText(total)      -> "Team Manager or above"
   MRF.isLegacy(steps)          -> true for requisitions created before the 3-step flow
   MRF.trackLabels(steps)       -> labels for the progress tracker
   MRF.limitsHtml(total)        -> HTML for "page 2" on screen
   MRF.drawLimitsPage(pdf, total, opts) -> adds the Authorisation Limit page to a jsPDF document */
(function(w){
  "use strict";
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const money = n => "$" + Number(n||0).toLocaleString("en-SG", {minimumFractionDigits:2, maximumFractionDigits:2});

  // lowest first; "upTo" is the largest purchase requisition that appointment may approve
  const LEVELS = [
    {who:"Section Manager", upTo:300,      quote:"Less than $8,000/-",  pr:"Up to $300/-"},
    {who:"Team Manager",    upTo:500,      quote:"Less than $16,000/-", pr:"Up to $500/-", star:true},
    {who:"Division Head",   upTo:1000,     quote:"Less than $50,000/-", pr:"Up to $1,000/-"},
    {who:"Top Management",  upTo:Infinity, quote:"Above $50,000/-",     pr:"Above $1,000/-"}
  ];
  const NOTE_ID = "* For ID team, anything above $500/- will require Top Mgmt approval until a Division Head is appointed.";
  const NEW_REQ = {
    head: "NEW Requirement for Vendors’ Quotation (wef May ’26):-",
    lines: ["Quotation value of $50k and above (i.e. $50,000 to $149,999.99/-) : PO required",
            "Quotation value of $150k and above (i.e. $150,000 onwards) : LOA required.",
            "Exception for supply (only) of goods, e.g. Furniture, Lightings; and Consultancy services"]
  };

  function required(total){
    const t = Number(total) || 0;
    const lv = LEVELS.find(l => t <= l.upTo) || LEVELS[LEVELS.length-1];
    const doc = t >= 150000 ? "LOA required (quotation $150,000 and above)" : t >= 50000 ? "PO required (quotation $50,000 to $149,999.99)" : "";
    return {who: lv.who, upTo: lv.upTo, doc, idNote: lv.who === "Team Manager" ? "For the ID team, above $500 needs Top Management until a Division Head is appointed." : ""};
  }
  const requiredText = total => { const r = required(total); return r.who === "Top Management" ? "Top Management" : r.who + " or above"; };
  const isLegacy = steps => (steps||[]).some(s => s.stage_name === "Purchase" || s.step_order === 4);
  const trackLabels = steps => isLegacy(steps) ? ["Manager","Procurement","Purchase","Received"] : ["Manager","Procurement","Received"];
  const stepShort = (s, steps) => {
    if(isLegacy(steps)) return {1:"Manager", 2:"Approve", 3:"Purchase", 4:"Received"}[s.step_order] || s.stage_name;
    return {1:"Manager", 2:"Procurement", 3:"Received"}[s.step_order] || s.stage_name;
  };

  const CSS = `
  .mrf-p2{ background:#fff; color:#111; font-family:Arial,Helvetica,sans-serif; }
  .mrf-p2 h3{ margin:0; font-size:21px; letter-spacing:.2px; } .mrf-p2 h4{ margin:2px 0 14px; font-size:16px; }
  .mrf-p2 table{ width:100%; border-collapse:collapse; font-size:13px; }
  .mrf-p2 th{ background:#000; color:#fff; text-align:left; padding:9px 10px; font-weight:600; }
  .mrf-p2 td{ background:#d9d9d9; padding:8px 10px; border-top:2px solid #fff; }
  .mrf-p2 tr.me td{ background:#fde68a; font-weight:700; outline:0; }
  .mrf-p2 .note{ font-size:11.5px; font-style:italic; margin:8px 0 14px; }
  .mrf-p2 .req b.hl{ background:#fff200; padding:0 3px; } .mrf-p2 .req{ font-size:12.5px; line-height:1.6; }
  .mrf-p2 .req ul{ margin:6px 0 0; padding-left:20px; }
  .mrf-p2 .this{ margin:0 0 14px; padding:10px 12px; border:2px solid #2f6fed; border-radius:8px; background:#eef4ff; font-size:13px; line-height:1.5; }`;

  function limitsHtml(total){
    const r = required(total), t = Number(total) || 0;
    const rows = LEVELS.slice().reverse().map(l => `<tr class="${l.who===r.who?"me":""}"><td>${esc(l.who)}${l.star?" *":""}</td><td>${esc(l.quote)}</td><td>${esc(l.pr)}</td></tr>`).join("");
    return `<style>${CSS}</style><div class="mrf-p2">
      <h3>PROCUREMENT</h3><h4>Authorisation Limit</h4>
      <div class="this"><b>This requisition is ${esc(money(t))}</b> → it must be approved by <b>${esc(requiredText(t))}</b>.${r.idNote?`<br><span style="font-size:12px">${esc(r.idNote)}</span>`:""}${r.doc?`<br><b>${esc(r.doc)}.</b>`:""}</div>
      <table><thead><tr><th>Appointment</th><th>Quote from Vendors</th><th>Purchase Requisition or Staff Expense</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="note">${esc(NOTE_ID)}</div>
      <div class="req"><b class="hl">NEW Requirement</b> <b>for Vendors’ Quotation (wef May ’26):-</b>
        <ul><li>${esc(NEW_REQ.lines[0])}</li><li>${esc(NEW_REQ.lines[1])}</li><li>${esc(NEW_REQ.lines[2])}</li></ul></div>
    </div>`;
  }

  // jsPDF page 2 (needs the jspdf-autotable plugin, which every page that exports a PDF already loads)
  function drawLimitsPage(pdf, total, opts){
    opts = opts || {};
    const r = required(total), t = Number(total) || 0, margin = opts.margin || 40, W = pdf.internal.pageSize.getWidth();
    pdf.addPage();
    let y = margin + 6;
    pdf.setTextColor(0); pdf.setFont("helvetica","bold"); pdf.setFontSize(18); pdf.text("PROCUREMENT", margin, y); y += 18;
    pdf.setFontSize(13); pdf.text("Authorisation Limit", margin, y); y += 16;
    // this requisition
    pdf.setDrawColor(47,111,237); pdf.setFillColor(238,244,255); pdf.setLineWidth(1.2);
    const msg = `This requisition is ${money(t)} - it must be approved by ${requiredText(t)}.`, extra = [r.idNote, r.doc ? r.doc + "." : ""].filter(Boolean);
    const boxH = 24 + extra.length * 13;
    pdf.roundedRect(margin, y, W - margin*2, boxH, 5, 5, "FD");
    pdf.setFont("helvetica","bold"); pdf.setFontSize(10.5); pdf.setTextColor(30,41,59); pdf.text(msg, margin + 10, y + 16);
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9); extra.forEach((e, i) => pdf.text(e, margin + 10, y + 29 + i*13, {maxWidth: W - margin*2 - 20}));
    y += boxH + 14;
    pdf.autoTable({
      startY: y, margin: {left: margin, right: margin}, theme: "plain",
      head: [["Appointment", "Quote from Vendors", "Purchase Requisition or Staff Expense"]],
      body: LEVELS.slice().reverse().map(l => [l.who + (l.star ? " *" : ""), l.quote, l.pr]),
      styles: {fontSize: 10, cellPadding: 7, fillColor: [217,217,217], lineColor: [255,255,255], lineWidth: 1.5, textColor: 20},
      headStyles: {fillColor: [0,0,0], textColor: 255, fontStyle: "bold"},
      didParseCell: d => { if(d.section === "body" && String(d.row.raw[0]).replace(" *","") === r.who){ d.cell.styles.fillColor = [253,230,138]; d.cell.styles.fontStyle = "bold"; } }
    });
    y = pdf.lastAutoTable.finalY + 14;
    pdf.setFont("helvetica","italic"); pdf.setFontSize(9); pdf.setTextColor(60); pdf.text(NOTE_ID, margin, y, {maxWidth: W - margin*2}); y += 26;
    pdf.setFont("helvetica","bold"); pdf.setFontSize(10.5); pdf.setTextColor(0);
    pdf.setFillColor(255,242,0); pdf.rect(margin, y - 10, 98, 14, "F"); pdf.text("NEW Requirement", margin + 2, y); pdf.text("for Vendors' Quotation (wef May '26):-", margin + 104, y); y += 18;
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9.5);
    NEW_REQ.lines.forEach(l => { const parts = pdf.splitTextToSize("-  " + l, W - margin*2 - 10); pdf.text(parts, margin + 6, y); y += parts.length * 13 + 2; });
    return y;
  }

  w.MRF = {LEVELS, required, requiredText, isLegacy, trackLabels, stepShort, limitsHtml, drawLimitsPage, money};
})(window);
