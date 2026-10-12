// Groups item names that mean the same thing, so price history works even when people type names differently.
//  1. Smart key   : lower-case, punctuation/plurals/word order ignored   ("M3 Screws" = "screw m3")
//  2. Fuzzy merge : names that are very close (typos, one extra word) are grouped automatically
//                   — but never when their numbers/sizes differ ("M3 screw" != "M4 screw")
//  3. Manual      : people can combine or separate names; those choices (item_aliases) always win
(function(w){
  const STOP = new Set(["the","a","an","of","for","and","with","pcs","pc","piece","pieces","pack","packs","set"]);
  const singular = t => {
    if(!/^[a-z]+$/.test(t) || t.length<=3) return t;
    if(t.endsWith("ies") && t.length>4) return t.slice(0,-3)+"y";
    if(t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us")) return t.slice(0,-1);
    return t;
  };
  const hasDigit = t => /\d/.test(t);
  function tokens(name){
    const s = String(name||"").normalize("NFKC").toLowerCase().replace(/[_\-\/\\,.;:()\[\]{}"'`+*&|#@!?<>=~]+/g," ");
    const out = [];
    s.split(/\s+/).forEach(t=>{ if(!t || STOP.has(t)) return; const x = singular(t); if(!out.includes(x)) out.push(x); });
    return out;
  }
  const keyOf = name => { const t = tokens(name); return t.length ? t.slice().sort().join(" ") : String(name||"").trim().toLowerCase(); };

  function lev1(a,b){                       // true when edit distance <= 1
    if(a===b) return true;
    if(Math.abs(a.length-b.length)>1) return false;
    let i=0, j=0, edits=0;
    while(i<a.length && j<b.length){
      if(a[i]===b[j]){ i++; j++; continue; }
      if(++edits>1) return false;
      if(a.length>b.length) i++; else if(a.length<b.length) j++; else { i++; j++; }
    }
    return edits + (a.length-i) + (b.length-j) <= 1;
  }
  const tokEq = (a,b) => a===b || (a.length>=5 && b.length>=5 && !hasDigit(a) && !hasDigit(b) && lev1(a,b));

  // 0..1 similarity of two names; 0 when their numbers/sizes differ
  function score(nameA, nameB){
    const A = tokens(nameA), B = tokens(nameB);
    if(!A.length || !B.length) return 0;
    const nA = A.filter(hasDigit).sort().join(","), nB = B.filter(hasDigit).sort().join(",");
    let cap = 1;
    if(nA !== nB){
      if(nA && nB) return 0;          // both carry sizes/numbers and they differ: not the same item
      cap = AUTO - 0.01;              // only one side has a size ("PLA white" vs "PLA white 1kg"): suggest, never auto-merge
    }
    const used = new Set(); let m = 0;
    A.forEach(a=>{ const j = B.findIndex((b,idx)=>!used.has(idx) && tokEq(a,b)); if(j>=0){ used.add(j); m++; } });
    return Math.min(cap, m / (A.length + B.length - m));
  }
  const AUTO = 0.8, SUGGEST = 0.5;

  // names: every raw name seen; aliasRows: [{member_key, canonical_key, canonical_name}]
  // returns {keyFor(name), nameFor(key), isManual(key), suggestions(key, keys)}
  function resolver(names, aliasRows){
    const alias = new Map((aliasRows||[]).map(a=>[a.member_key, a]));
    const freq = new Map(), sample = new Map();
    names.forEach(n=>{ const k = keyOf(n); freq.set(k,(freq.get(k)||0)+1); if(!sample.has(k)) sample.set(k, String(n).trim()); });
    const auto = [...freq.keys()].filter(k=>!alias.has(k)).sort((a,b)=>freq.get(b)-freq.get(a) || a.length-b.length);
    const rep = new Map(), reps = [];
    auto.forEach(k=>{
      const hit = reps.find(r=>score(sample.get(r), sample.get(k))>=AUTO);
      if(hit) rep.set(k, hit); else { reps.push(k); rep.set(k, k); }
    });
    const keyForKey = k => alias.has(k) ? alias.get(k).canonical_key : (rep.get(k) || k);
    return {
      keyFor: name => keyForKey(keyOf(name)),
      smartKey: keyOf,
      isManual: k => [...alias.values()].some(a=>a.canonical_key===k && a.member_key!==k),
      canonicalName: k => { for(const a of alias.values()) if(a.canonical_key===k) return a.canonical_name; return null; },
      pinnedAlone: smart => alias.has(smart) && alias.get(smart).canonical_key===smart,
      aliasOf: smart => alias.get(smart) || null
    };
  }
  w.ItemMatch = {tokens, keyOf, score, resolver, AUTO, SUGGEST};
})(window);
