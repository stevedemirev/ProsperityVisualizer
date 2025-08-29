const S = { raw: { prices: [], trades: [], own: [] }, tsFrac: 1.0 };

const $ = (id) => document.getElementById(id);
const els = { file: $("file"), drop: $("drop"), sep: $("sep"),
              product: $("product"), day: $("day"), ts: $("ts"),
              tsLabel: $("tsLabel"), preview: $("preview") };

function detectKind(name) {
  const n = name.toLowerCase();
  if (n.includes("own") && n.includes("trade")) return "own";
  if (n.includes("trade")) return "trades";
  return "prices";
}

function parseFiles(files) {
  const delimiter = els.sep.value;
  const tasks = [...files].map((f) => new Promise((resolve, reject) => {
    Papa.parse(f, {
      header: true,
      dynamicTyping: true,
      delimiter,
      skipEmptyLines: "greedy",
      complete: (res) => resolve({ name: f.name, data: res.data }),
      error: reject,
    });
  }));
  return Promise.all(tasks).then((parts) => {
    S.raw = { prices: [], trades: [], own: [] };
    for (const { name, data } of parts) {
      S.raw[detectKind(name)] = S.raw[detectKind(name)].concat(data);
    }
  });
}

function uniq(xs) { return [...new Set(xs)]; }
function num(x) { const v = Number(x); return Number.isFinite(v) ? v : null; }

function refreshSelectors() {
  const products = uniq(S.raw.prices.map(r => r.product).filter(Boolean)).sort();
  const days = uniq(S.raw.prices.map(r => r.day).filter(d => d !== undefined)).sort((a,b)=>a-b);

  els.product.innerHTML = products.map(p => `<option>${p}</option>`).join("");
  els.day.innerHTML = days.map(d => `<option>${d}</option>`).join("");
}

function byTime(rows) {
  if (!rows.length) return rows;
  const maxTs = Math.max(...rows.map(r => +r.timestamp || 0));
  const cutoff = maxTs * S.tsFrac;
  return rows.filter(r => (+r.timestamp || 0) <= cutoff);
}

function draw() {
  const product = els.product.value;
  const day = els.day.value;

  const prices = byTime(S.raw.prices.filter(r => r.product === product && String(r.day) === String(day)));
  const trades = byTime(S.raw.trades.filter(r => r.product === product && String(r.day) === String(day)));
  const own = byTime(S.raw.own.filter(r => r.product === product && String(r.day) === String(day)));

  els.preview.textContent = JSON.stringify(prices.slice(0, 8), null, 2);

  const t = prices.map(r => r.timestamp);
  const mid = prices.map(r => num(r.mid_price));
  const bid1 = prices.map(r => num(r.bid_price_1));
  const ask1 = prices.map(r => num(r.ask_price_1));

  const midTraces = [];
  if (mid.some(x => x!=null)) midTraces.push({ x: t, y: mid, mode: "lines", name: "mid" });
  if (bid1.some(x => x!=null)) midTraces.push({ x: t, y: bid1, mode: "lines", name: "bid_1" });
  if (ask1.some(x => x!=null)) midTraces.push({ x: t, y: ask1, mode: "lines", name: "ask_1" });

  Plotly.newPlot("midChart", midTraces, { margin:{t:24,r:8,b:40,l:48}, xaxis:{title:"timestamp"}, yaxis:{title:"price"} });

  const bookTraces = [];
  for (let i=1;i<=5;i++){
    const b = prices.map(r => num(r[`bid_price_${i}`]));
    const a = prices.map(r => num(r[`ask_price_${i}`]));
    if (b.some(x=>x!=null)) bookTraces.push({ x:t, y:b, mode:"lines", name:`bid_${i}` });
    if (a.some(x=>x!=null)) bookTraces.push({ x:t, y:a, mode:"lines", name:`ask_${i}` });
  }
  Plotly.newPlot("bookChart", bookTraces, { margin:{t:24,r:8,b:40,l:48}, xaxis:{title:"timestamp"}, yaxis:{title:"price"} });

  Plotly.newPlot("tradesChart", [
    { x: trades.map(r=>r.timestamp), y: trades.map(r=>num(r.price)), mode:"markers", name:"market trades", text: trades.map(r=>`qty=${r.quantity}`) },
    { x: own.map(r=>r.timestamp), y: own.map(r=>num(r.price)), mode:"markers", name:"your trades", marker:{size:10, symbol:"diamond"}, text: own.map(r=>`qty=${r.quantity}`) },
  ], { margin:{t:24,r:8,b:40,l:48}, xaxis:{title:"timestamp"}, yaxis:{title:"price"} });
}

function wire() {
  els.sep.addEventListener("change", async () => {
    if (els.file.files.length) { await parseFiles(els.file.files); refreshSelectors(); draw(); }
  });

  els.file.addEventListener("change", async (e) => {
    await parseFiles(e.target.files); refreshSelectors(); draw();
  });

  els.drop.addEventListener("dragover", (e)=>{ e.preventDefault(); els.drop.classList.add("hover"); });
  els.drop.addEventListener("dragleave", ()=> els.drop.classList.remove("hover"));
  els.drop.addEventListener("drop", async (e)=>{
    e.preventDefault(); els.drop.classList.remove("hover");
    await parseFiles(e.dataTransfer.files); refreshSelectors(); draw();
  });

  els.product.addEventListener("change", draw);
  els.day.addEventListener("change", draw);
  els.ts.addEventListener("input", (e) => {
    S.tsFrac = Number(e.target.value) / 100;
    els.tsLabel.textContent = S.tsFrac === 1 ? "end" : `${Math.round(S.tsFrac*100)}%`;
    draw();
  });
}

window.addEventListener("DOMContentLoaded", wire);

window.addEventListener("DOMContentLoaded", wire);

