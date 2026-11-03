/* "Share this draft": the person who started a draft picks colleagues who may edit it with them.
   DraftShare.open({client, personId, pin, draftId, current:[{id,name}], onSaved(list)})   (list = [{id,name}] now allowed to edit) */
(function(w){
  "use strict";
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  function open(o){
    const old = document.getElementById("dsShare"); if(old) old.remove();
    const back = document.createElement("div"); back.id = "dsShare";
    back.setAttribute("role","dialog"); back.setAttribute("aria-modal","true"); back.setAttribute("aria-label","Share this draft");
    back.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:14px;z-index:1400;font-family:inherit;";
    back.innerHTML = `<div style="background:var(--surface,#fff);color:var(--ink,#1f2933);border-radius:16px;max-width:460px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden">
      <div style="padding:18px 20px 10px"><div style="font-size:17px;font-weight:800">Share this draft</div>
        <div style="font-size:12.5px;color:var(--muted,#6b7280);margin-top:3px;line-height:1.45">People you tick can open it from <b>My Drafts</b> and edit it with you. They are notified. Only you can share or delete it.</div>
        <input id="dsSearch" type="text" placeholder="Search by name…" style="margin-top:10px;width:100%;font:inherit;font-size:14px;padding:9px 12px;border:1px solid var(--line,#d7dbe0);border-radius:9px;background:var(--surface,#fff);color:inherit" autocomplete="off"></div>
      <div id="dsList" style="overflow:auto;padding:4px 14px;min-height:120px;flex:1"><div style="padding:20px;color:var(--muted,#6b7280);font-size:13px">Loading…</div></div>
      <div id="dsMsg" style="padding:0 20px;font-size:12.5px;color:#b91c1c;min-height:18px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 20px 16px;border-top:1px solid var(--line,#d7dbe0)">
        <button type="button" id="dsCancel" style="font:inherit;font-weight:700;font-size:13px;padding:9px 16px;border-radius:9px;border:1px solid var(--line,#d7dbe0);background:var(--surface,#fff);color:inherit;cursor:pointer">Cancel</button>
        <button type="button" id="dsSave" style="font:inherit;font-weight:700;font-size:13px;padding:9px 18px;border-radius:9px;border:1px solid #2f6fed;background:#2f6fed;color:#fff;cursor:pointer">Save</button></div></div>`;
    document.body.appendChild(back);
    const picked = new Set((o.current || []).map(p => p.id));
    let people = [];
    const close = () => { back.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if(e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", e => { if(e.target === back) close(); });
    back.querySelector("#dsCancel").onclick = close;
    const list = back.querySelector("#dsList"), msg = back.querySelector("#dsMsg");
    function draw(){
      const q = back.querySelector("#dsSearch").value.trim().toLowerCase();
      const rows = people.filter(p => !q || p.name.toLowerCase().includes(q) || String(p.position||"").toLowerCase().includes(q));
      list.innerHTML = rows.length ? rows.map(p => `<label style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid var(--line,#eef0f2);cursor:pointer"><input type="checkbox" data-id="${esc(p.id)}" ${picked.has(p.id)?"checked":""} style="width:18px;height:18px;margin:0"><span style="font-size:14px"><b>${esc(p.name)}</b>${p.position?`<br><span style="font-size:12px;color:var(--muted,#6b7280)">${esc(p.position)}</span>`:""}</span></label>`).join("")
        : `<div style="padding:20px;color:var(--muted,#6b7280);font-size:13px">No one found.</div>`;
    }
    list.addEventListener("change", e => { const id = e.target.getAttribute && e.target.getAttribute("data-id"); if(!id) return; e.target.checked ? picked.add(id) : picked.delete(id); });
    back.querySelector("#dsSearch").addEventListener("input", draw);
    o.client.rpc("list_share_people", {p_person_id: o.personId, p_pin: o.pin}).then(({data, error}) => {
      if(error || !data || !data.success){ list.innerHTML = ""; msg.textContent = (data && data.error) || "Could not load the list of people."; return; }
      people = data.people || []; draw();
    });
    back.querySelector("#dsSave").onclick = async () => {
      const btn = back.querySelector("#dsSave"); btn.disabled = true; msg.textContent = "";
      const {data, error} = await o.client.rpc("share_draft", {p_person_id: o.personId, p_pin: o.pin, p_draft_id: o.draftId, p_share_with: [...picked]});
      btn.disabled = false;
      if(error || !data || !data.success){ msg.textContent = (data && data.error) || (error && error.message) || "Could not share the draft."; return; }
      close(); if(o.onSaved) o.onSaved(data.shared_with || []);
    };
  }
  w.DraftShare = {open};
})(window);
