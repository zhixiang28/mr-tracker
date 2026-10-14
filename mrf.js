/* Materials Requisition Form rules shared by the form, the signing page, the viewer and the PDFs.
   - Authorisation limits (reference sheet, page 2 of the paper form): who must approve a requisition of a given amount
   - Signing steps: new requisitions have 3 (Manager -> Procurement -> Received); older ones keep their 4
   MRF.required(total)          -> {who, upTo, doc}   lowest appointment that may approve, and PO / LOA rule if any
   MRF.requiredText(total)      -> "Team Manager or above"
   MRF.isLegacy(steps)          -> true for requisitions created before the 3-step flow
   MRF.trackLabels(steps)       -> labels for the progress tracker
   MRF.limitsHtml(total)        -> the rules table (HTML)
   MRF.showRules(total)         -> "View approval rules" pop-up (reference only; not part of the form or its PDF)
   MRF.workingDaysUntil(ymd)    -> Mon-Fri days from today */
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

  // "View approval rules" pop-up: the Authorisation Limit table, with the level this amount needs highlighted
  function showRules(total){
    const old = document.getElementById("mrfRules"); if(old) old.remove();
    const back = document.createElement("div"); back.id = "mrfRules";
    back.setAttribute("role","dialog"); back.setAttribute("aria-modal","true"); back.setAttribute("aria-label","Approval rules");
    back.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:14px;z-index:1400;";
    back.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:640px;width:100%;max-height:92vh;overflow:auto;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.35)">
      ${limitsHtml(total)}
      <div style="text-align:right;margin-top:14px"><button type="button" id="mrfRulesClose" style="font:inherit;font-weight:700;padding:9px 18px;border-radius:9px;border:1px solid #d7dbe0;background:#fff;cursor:pointer">Close</button></div></div>`;
    const close = () => { back.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if(e.key === "Escape") close(); };
    back.addEventListener("click", e => { if(e.target === back || e.target.id === "mrfRulesClose") close(); });
    document.addEventListener("keydown", onKey); document.body.appendChild(back);
    back.querySelector("#mrfRulesClose").focus();
  }

  // working days (Mon-Fri) from today until the given yyyy-mm-dd date; negative if it is in the past
  function workingDaysUntil(ymd){
    const m = String(ymd||"").match(/^(\d{4})-(\d{2})-(\d{2})/); if(!m) return null;
    const end = new Date(+m[1], +m[2]-1, +m[3]), t = new Date(); const d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    if(end < d) return -1;
    let n = 0; while(d < end){ d.setDate(d.getDate()+1); const wd = d.getDay(); if(wd !== 0 && wd !== 6) n++; }
    return n;
  }

  w.MRF = {LEVELS, required, requiredText, isLegacy, trackLabels, stepShort, limitsHtml, showRules, workingDaysUntil, money};
})(window);
