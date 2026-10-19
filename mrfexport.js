/* One export format for every page (form, form view, signing page): the Materials Requisition Form PDF and its CSV.
   MRFExport.pdf(req)        -> Promise<jsPDF>           A4 page laid out like the paper form
   MRFExport.csv(req)        -> string                    the same facts as a CSV (with a BOM so Excel shows Chinese)
   MRFExport.fileName(req,e) -> "MRF_<project>_<yymmdd>.<e>"
   MRFExport.downloadCSV(req)
   `req` is {tracking_no, project_name, project_location, request_by, form_date (yyyy-mm-dd), supply_date, pc_no, pm_incharge,
             status, requisition_items:[{name, description, qty, unit_price, delivery_tax, link}], steps:[approval steps]}.
   Needs jsPDF + jspdf-autotable (for the PDF), dates.js, mrf.js and session.js (ExportOpts) on the page. */
(function(w){
  "use strict";
  const num = n => Number(n||0);
  const fmt = n => num(n).toFixed(2);
  const lineTotal = it => num(it.qty)*num(it.unit_price) + num(it.delivery_tax);
  const fmtDate = d => (w.fmtDMY ? w.fmtDMY(d) : String(d||"")) || "";
  const fmtStamp = ts => ts ? (w.fmtDateTime ? w.fmtDateTime(ts) : String(ts)) : "";
  const showReceived = () => !w.ExportOpts || w.ExportOpts.showReceived();
  const BTN_DONE = {2:"Ordered", 3:"Received", 4:"Received"};          // one-tap steps (no signature drawn)

  function slug(s){ return String(s||"").trim().replace(/[\\/:*?"<>|]/g,"").replace(/\s+/g,"_").slice(0,40); }
  function yymmdd(d){ const m = String(d||"").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1].slice(2)+m[2]+m[3] : ""; }
  function fileName(r, ext){ return `MRF_${slug(r.project_name)||"form"}_${yymmdd(r.form_date)}.${ext}`; }

  const isLegacy = steps => w.MRF ? w.MRF.isLegacy(steps) : false;
  const isBtnStep = (steps, o) => isLegacy(steps) ? o === 4 : o >= 2;
  // sign-off lines, in order (the Received line can be left out of an export)
  function slots(steps){
    const all = isLegacy(steps)
      ? [{order:1,label:"TO BE VERIFY BY TEAM MANAGER"},{order:2,label:"APPROVE BY"},{order:3,label:"PURCHASE BY"},{order:4,label:"RECEIVED BY"}]
      : [{order:1,label:"TO BE VERIFIED BY"},{order:2,label:"PROCUREMENT DEPT : PROCESSED BY"},{order:3,label:"RECEIVED BY"}];
    return all.filter(s => showReceived() || s.order !== all.length);
  }

  // ---------------- CSV ----------------
  function csv(r){
    const steps = r.steps || [], items = r.requisition_items || [];
    const rows = [
      ["Tracking No.", r.tracking_no||""], ["Project Name", r.project_name||""], ["Project Location", r.project_location||""],
      ["Request By", r.request_by||""], ["Date", fmtDate(r.form_date)], ["Supply Date", fmtDate(r.supply_date)],
      ["PC No.", r.pc_no||""], ["PM Incharge", r.pm_incharge||""], [],
      ["S/N","Name","Description","Qty","Unit Price","Delivery","Link","Total"],
      ...items.map((it,i)=>[i+1, it.name||"", it.description||"", num(it.qty), fmt(it.unit_price), fmt(it.delivery_tax), it.link||"", fmt(lineTotal(it))]),
      ["","","","","","","Grand Total", fmt(items.reduce((a,it)=>a+lineTotal(it),0))], [],
      ["Sign-off","Signed by","Signed at"],
      ...slots(steps).map(sl=>{ const st = steps.find(x=>x.step_order===sl.order)||{};
        return [sl.label, st.status==="Signed"?(st.assigned_person_name||""):"", st.status==="Signed"?fmtStamp(st.signed_at):""]; })
    ];
    return "﻿" + rows.map(row=>row.map(x=>`"${String(x==null?"":x).replace(/"/g,'""')}"`).join(",")).join("\n");   // BOM so Excel shows Chinese correctly
  }
  function downloadCSV(r){
    const blob = new Blob([csv(r)], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = fileName(r, "csv");
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
  }

  // ---------------- PDF ----------------
  function isCJK(str){ return /[㐀-鿿豈-﫿＀-￯]/.test(String(str||"")); }
  // jsPDF's built-in fonts have no CJK glyphs, so CJK text is rendered via canvas and placed as an image.
  function cjkTextToImage(text, fontSizePt, fontWeight){
    const scale = 4, px = fontSizePt*scale;
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    const font = `${fontWeight||"normal"} ${px}px "PingFang SC","Microsoft YaHei","Noto Sans SC","Heiti SC",Arial,sans-serif`;
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(text).width) + scale*4, height = Math.ceil(px*1.4);
    canvas.width = width; canvas.height = height;
    ctx.font = font; ctx.textBaseline = "middle"; ctx.fillStyle = "#000";
    ctx.fillText(text, scale*2, height/2);
    return { dataUrl: canvas.toDataURL("image/png"), wPt: width/scale, hPt: height/scale };
  }
  function drawText(pdf, text, x, y, size, style, opts){
    opts = opts || {}; text = String(text==null?"":text);
    if(!text) return;
    if(isCJK(text)){
      let {dataUrl, wPt, hPt} = cjkTextToImage(text, size, style==="bold"?"bold":"normal");
      if(opts.maxWidth && wPt>opts.maxWidth){ hPt*=opts.maxWidth/wPt; wPt=opts.maxWidth; }
      pdf.addImage(dataUrl, "PNG", x, y-hPt*0.68, wPt, hPt);
    } else {
      pdf.setFont("helvetica", style||"normal"); pdf.setFontSize(size); pdf.setTextColor(0,0,0);
      pdf.text(text, x, y, opts.align?{align:opts.align}:undefined);
    }
  }
  const imgSize = dataUrl => new Promise(res=>{ const i=new Image(); i.onload=()=>res({w:i.naturalWidth,h:i.naturalHeight}); i.onerror=()=>res(null); i.src=dataUrl; });

  async function pdf(r){
    const { jsPDF } = w.jspdf;
    const doc = new jsPDF({orientation:"portrait", unit:"pt", format:"a4"});
    const items = r.requisition_items || [], steps = (r.steps || []).slice().sort((a,b)=>a.step_order-b.step_order);
    const m = 28, W = 595, cw = W-m*2;

    // logo + title
    doc.setFont("helvetica","bold"); doc.setFontSize(24); doc.setTextColor(0,0,0);
    doc.text("SPACElogic", W-m, 56, {align:"right"});
    doc.setLineWidth(1.4); doc.rect(m, 68, cw, 20);
    doc.setFontSize(12.5); doc.text("MATERIALS REQUISITION FORM", W/2, 82, {align:"center"});

    // header fields
    const lx = m, lvx = 140, lend = 296, rx = 405, rvx = 470, rend = W-m;
    function field(label, value, x, vx, end, y){
      doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(0,0,0);
      doc.text(label, x, y);
      drawText(doc, value, vx+2, y, 8.5, "normal", {maxWidth:end-vx-4});
      doc.setLineWidth(1.2); doc.line(vx, y+4, end, y+4);
    }
    let y = 114;
    field("PROJECT NAME :", r.project_name, lx, lvx, lend, y);
    field("DATE :", fmtDate(r.form_date), rx, rvx, rend, y);
    y += 17; field("PROJECT LOCATION :", r.project_location, lx, lvx, lend, y);
    y += 17; field("REQUEST BY :", r.request_by, lx, lvx, lend, y);
    field("PC NO.:", r.pc_no, rx, rvx, rend, y);
    y += 25; field("SUPPLY DATE :", fmtDate(r.supply_date), lx, lvx, lend, y);
    field("PM Incharge:", r.pm_incharge, rx, rvx, rend, y);

    // items table
    const rowCount = Math.max(10, items.length), body = [];
    for(let i=0;i<rowCount;i++){
      const it = items[i];
      body.push([ i+1, it?it.name||"":"", it?it.description||"":"", it?String(num(it.qty)):"",
        it?fmt(it.unit_price):"", it?fmt(it.delivery_tax):"", it&&it.link?"#":"", it?fmt(lineTotal(it)):"-" ]);
    }
    const money = new Set([4,5,7]);
    doc.autoTable({
      startY: y+20, margin:{left:m,right:m}, theme:"grid",
      head:[["S/N","NAME","DESCRIPTION","QTY","UNIT PRICE","DELIVERY","LINK","TOTAL"]], body,
      styles:{ fontSize:8.5, cellPadding:{top:3,right:4,bottom:3,left:4}, lineColor:[0,0,0], lineWidth:0.6, textColor:0, minCellHeight:15, valign:"middle" },
      headStyles:{ fillColor:255, textColor:0, fontStyle:"bold", halign:"center" },
      columnStyles:{ 0:{cellWidth:29,halign:"center"}, 1:{cellWidth:78}, 2:{cellWidth:161}, 3:{cellWidth:52,halign:"center"},
        4:{cellWidth:52,halign:"right"}, 5:{cellWidth:64,halign:"right"}, 6:{cellWidth:41,halign:"center",textColor:[0,0,238]}, 7:{cellWidth:60,halign:"right"} },
      didParseCell(d){
        if(d.section!=="body") return;
        if(d.column.index===1 || d.column.index===2){
          const t = Array.isArray(d.cell.text)?d.cell.text.join(" "):String(d.cell.raw||"");
          if(isCJK(t)){ d.cell._cjk = t; d.cell.text = []; }
        }
      },
      didDrawCell(d){
        if(d.section!=="body") return;
        if(d.cell._cjk){
          const {dataUrl,wPt,hPt} = cjkTextToImage(d.cell._cjk, 8.5, "normal");
          const dw = Math.min(wPt, d.cell.width-8), dh = hPt*(dw/wPt);
          doc.addImage(dataUrl,"PNG", d.cell.x+4, d.cell.y+d.cell.height/2-dh/2, dw, dh);
        }
        if(money.has(d.column.index) && d.cell.raw!==""){
          doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(0,0,0);
          doc.text("$", d.cell.x+4, d.cell.y+d.cell.height/2+3);
        }
        if(d.column.index===6 && d.cell.raw==="#"){
          const l = items[d.row.index].link;
          doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, {url: /^https?:\/\//i.test(l)?l:"https://"+l});
        }
      }
    });

    let fy = doc.lastAutoTable.finalY + 12;
    const total = items.reduce((a,it)=>a+lineTotal(it),0);
    doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(0,0,0);
    doc.text("$", rend-60, fy); doc.text(fmt(total), rend-4, fy, {align:"right"});

    // sign-off lines
    fy += 38;
    if(fy + 4*44 + 40 > 842-m){ doc.addPage(); fy = 60; }
    const stepBy = o => steps.find(s=>s.step_order===o) || {};
    async function sigRow(order, label, yy){
      doc.setFont("helvetica","bold"); doc.setFontSize(label.length > 17 ? 7.5 : 8.5); doc.setTextColor(0,0,0);
      doc.text(doc.splitTextToSize(label + " :", 100), lx, yy);
      if(label.startsWith("PROCUREMENT DEPT")){ const uw = doc.getTextWidth("PROCUREMENT DEPT"); doc.setLineWidth(0.6); doc.line(lx, yy+1.5, lx+uw, yy+1.5); }   // "PROCUREMENT DEPT" is underlined
      doc.setLineWidth(1.2); doc.line(lvx, yy+10, lend, yy+10);
      const s = stepBy(order);
      if(s.status==="Signed"){
        if(s.signature_data){
          const sz = await imgSize(s.signature_data);
          if(sz){
            let h = 30, wd = h*sz.w/sz.h;
            if(wd>lend-lvx-8){ wd = lend-lvx-8; h = wd*sz.h/sz.w; }
            doc.addImage(s.signature_data, "PNG", lvx+4, yy+9-h, wd, h);
          }
        } else if(isBtnStep(steps, order)){ drawText(doc, (BTN_DONE[order]||"Done").toUpperCase(), lvx+4, yy+6, 10, "bold"); }
        doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(90,90,90);
        drawText(doc, `${s.assigned_person_name||""}  ·  ${fmtStamp(s.signed_at)}`, lvx, yy+19, 6.5, "normal", {maxWidth:lend-lvx});
        doc.setTextColor(0,0,0);
      }
    }
    for(const sl of slots(steps)){
      if(sl.order === 1 && !isLegacy(steps)){
        await sigRow(1, sl.label, fy);
        doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(90,90,90);
        doc.text("Required: " + (w.MRF ? w.MRF.requiredText(total) : ""), lx, fy+19, {maxWidth:94}); doc.setTextColor(0,0,0);
        fy += 44;
      } else if(isLegacy(steps) && sl.order === 2){
        // older requisitions: "PROCUREMENT DEPT :" heading over Approve by / Purchase by
        doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(0,0,0);
        doc.text("PROCUREMENT DEPT :", lx, fy);
        doc.setLineWidth(0.6); doc.line(lx, fy+1.5, lx+doc.getTextWidth("PROCUREMENT DEPT :"), fy+1.5);
        fy += 28; await sigRow(2, sl.label, fy); fy += 40;
      } else {
        await sigRow(sl.order, sl.label, fy);
        fy += isLegacy(steps) ? (sl.order === 1 ? 44 : 40) : 44;
      }
    }
    if(r.status==="Declined" || r.status==="Withdrawn"){
      const d = steps.find(s=>s.status==="Declined");
      doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(185,28,28);
      drawText(doc, `${String(r.status).toUpperCase()}${d?` — ${d.assigned_person_name||""}: ${d.decline_reason||""}`:""}`, lx, fy+12, 8.5, "bold", {maxWidth:cw});
      doc.setTextColor(0,0,0);
    }

    doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(120,120,120);
    doc.text(`Tracking no. ${r.tracking_no || "— (not submitted yet)"}`, m, 842-18);
    return doc;
  }

  w.MRFExport = { pdf, csv, downloadCSV, fileName, slug, yymmdd };
})(window);
