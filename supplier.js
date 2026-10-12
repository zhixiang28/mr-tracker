// Works out a supplier name from a product link (the form has no separate supplier field).
// "https://www.shopee.sg/product/123" -> {name:"Shopee", host:"shopee.sg"}; no/invalid link -> {name:"(no link)", host:""}
(function(w){
  const PRETTY = {shopee:"Shopee", lazada:"Lazada", amazon:"Amazon", taobao:"Taobao", tmall:"Tmall", aliexpress:"AliExpress", alibaba:"Alibaba",
    carousell:"Carousell", qoo10:"Qoo10", rs:"RS Components", "rs-online":"RS Components", digikey:"Digi-Key", mouser:"Mouser", sgbotic:"SG Botic",
    "1688":"1688", jd:"JD.com", ikea:"IKEA", fairprice:"FairPrice", bunnings:"Bunnings", homedepot:"Home Depot", "e-sun":"eSUN", esun3d:"eSUN"};
  const SLD = new Set(["com","co","org","net","gov","edu","ac"]);
  w.supplierOf = function(link){
    const raw = String(link||"").trim();
    if(!raw) return {name:"(no link)", host:""};
    let host;
    try{ host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://"+raw).hostname.toLowerCase(); }catch(_){ return {name:"(no link)", host:""}; }
    host = host.replace(/^(www|m|mobile|shop|store|item|detail|product|s)\./,"");
    const parts = host.split(".");
    if(parts.length < 2) return {name:"(no link)", host:""};
    let i = parts.length - 2;                                   // second-level label
    if(parts.length >= 3 && SLD.has(parts[parts.length-2]) && parts[parts.length-1].length===2) i = parts.length - 3; // example.com.sg
    const label = parts[i];
    const name = PRETTY[label] || (label.charAt(0).toUpperCase() + label.slice(1));
    return {name, host: parts.slice(i).join(".")};
  };
})(window);
