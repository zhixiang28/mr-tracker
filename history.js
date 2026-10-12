// Past purchases for the requisition form's item box: "what did we pay last time, and where from?"
// Uses the same smart name matching as the Purchase History page (itemmatch.js, supplier.js).
(function(w){
  const BOUGHT = ["Purchased","Received"];
  let loading = null, groups = [];

  const safeUrl = u => { const t=String(u||"").trim(); if(!t) return ""; const full=/^[a-z][a-z0-9+.-]*:\/\//i.test(t)?t:"https://"+t; return /^https?:\/\//i.test(full)?full:""; };

  function build(raw, aliases){
    const lines = raw.filter(l=>BOUGHT.includes(l.status));
    const res = ItemMatch.resolver(lines.map(l=>l.name), aliases);
    const m = new Map();
    lines.forEach(l=>{
      const k = res.keyFor(l.name), unit = Number(l.unit_price||0);
      const e = {name:String(l.name||"").trim(), desc:l.description||"", unit, qty:Number(l.qty||0)||1, link:l.link||"", url:safeUrl(l.link),
        supplier:supplierOf(l.link).name, ts:l.item_date ? new Date(l.item_date).getTime() : 0, date:l.item_date};
      if(!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    });
    groups = [...m.entries()].map(([k,ls])=>{
      ls.sort((a,b)=>b.ts-a.ts);
      const priced = ls.filter(x=>x.unit>0);
      const best = priced.length ? priced.reduce((a,b)=>b.unit<a.unit?b:a) : null;
      const counts = new Map(); ls.forEach(x=>counts.set(x.name,(counts.get(x.name)||0)+1));
      const name = res.canonicalName(k) || [...counts.entries()].sort((a,b)=>b[1]-a[1])[0][0];
      return {key:k, name, last:ls[0], best, times:ls.length, hay:(name+" "+ls.map(x=>x.name+" "+x.desc).join(" ")).toLowerCase()};
    });
  }

  function load(client, id, pin){
    if(loading) return loading;
    loading = (async()=>{
      try{
        const [h, a] = await Promise.all([
          client.rpc("list_purchase_history", {p_person_id:id, p_pin:pin}),
          client.rpc("list_item_aliases", {p_person_id:id, p_pin:pin})
        ]);
        if(h.data && h.data.success) build(h.data.items||[], (a.data && a.data.success) ? (a.data.aliases||[]) : []);
      }catch(_){ /* the form still works without suggestions */ }
      return groups;
    })();
    return loading;
  }

  // best matches first: names that start with what you typed, then the most-bought
  function suggest(q, limit){
    const words = String(q||"").toLowerCase().split(/\s+/).filter(Boolean);
    let list = groups.filter(g=>words.every(x=>g.hay.includes(x)));
    const first = words[0] || "";
    list.sort((a,b)=>{
      const sa = first && a.name.toLowerCase().startsWith(first) ? 1 : 0, sb = first && b.name.toLowerCase().startsWith(first) ? 1 : 0;
      return (sb-sa) || (b.times-a.times) || (b.last.ts-a.last.ts);
    });
    return list.slice(0, limit||8);
  }
  w.PurchaseHistory = {load, suggest, count:()=>groups.length};
})(window);
