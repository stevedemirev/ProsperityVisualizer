// Keep multi-panels, but make top chart big and include bid/ask 1–3 overlays
const S = { raw: { prices: [], trades: [], own: [] }, tsFrac: 1.0 };
const $ = (id) => document.getElementById(id);

const el = {
  file: $("file"), sep: $("sep"),
  product: $("product"), day: $("day"),
  ts: $("ts"), tsLabel: $("tsLabel"),
  featured: $("featuredChart"),
  book: $("bookChart"),
  trades: $("tradesChart"),
  preview: $("preview"),
};

function detectKind(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("own") && n.includes("trade")) return "own";
  if (n.includes("trade")) return "trades";
  return "prices";
}

function parseFiles(files) {
  const delimiter = el.sep.value;
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
      const k = detectKind(name);
      S.raw[k] = S.raw[k].concat(data);
    }
  });
}

function uniq(xs) { return [...new Set(xs)]; }
function num(x) { const v = Number(x); return Number.isFinite(v) ? v : null; }

function refreshSelectors() {
  const products = uniq(S.raw.prices.map(r => r.product).filter(Boolean)).sort();
  const days = uniq(S.raw.prices.map(r => r.day).filter(d => d !== undefined)).sort((a,b)=>a-b);
  el.product.innerHTML = products.map(p => `<option>${p}</option>`).join("");
  el.day.innerHTML = days.map(d => `<option>${d}</option>`).join("");
}

function byTime(rows) {
  if (!rows.length) return rows;
  const maxTs = Math.max(...rows.map(r => +r.timestamp || 0));
  const cutoff = maxTs * S.tsFrac;
  return rows.filter(r => (+r.timestamp || 0) <= cutoff);
}

function draw() {
  const product = el.product.value;
  const day = el.day.value;

  const prices = byTime(S.raw.prices.filter(r => String(r.product)===String(product) && String(r.day)===String(day)));
  const trades = byTime(S.raw.trades.filter(r => String(r.product)===String(product) && String(r.day)===String(day)));
  const own = byTime(S.raw.own.filter(r => String(r.product)===String(product) && String(r.day)===String(day)));

  el.preview.textContent = JSON.stringify(prices.slice(0, 12), null, 2);

  // ---------- FEATURED CHART (mid + bid/ask levels 1–3) ----------
  const t = prices.map(r => r.timestamp);
  const mid = prices.map(r => num(r.mid_price));
  const tracesFeatured = [];

  if (mid.some(x=>x!=null)) tracesFeatured.push({ x:t, y:mid, mode:"lines", name:"mid" });

  for (let i=1;i<=3;i++){
    const b = prices.map(r => num(r[`bid_price_${i}`]));
    const a = prices.map(r => num(r[`ask_price_${i}`]));
    if (b.some(x=>x!=null)) tracesFeatured.push({ x:t, y:b, mode:"lines", name:`bid_${i}` });
    if (a.some(x=>x!=null)) tracesFeatured.push({ x:t, y:a, mode:"lines", name:`ask_${i}` });
  }

  Plotly.newPlot(el.featured, tracesFeatured, {
    margin: { t: 24, r: 20, b: 48, l: 56 },
    xaxis: { title: "timestamp" },
    yaxis: { title: "price" },
    legend: { orientation: "h" }
  }, { responsive: true });

  // ---------- SECONDARY: Order Book (levels 1–5) ----------
  const bookTraces = [];
  for (let i=1;i<=5;i++){
    const b = prices.map(r => num(r[`bid_price_${i}`]));
    const a = prices.map(r => num(r[`ask_price_${i}`]));
    if (b.some(x=>x!=null)) bookTraces.push({ x:t, y:b, mode:"lines", name:`bid_${i}` });
    if (a.some(x=>x!=null)) bookTraces.push({ x:t, y:a, mode:"lines", name:`ask_${i}` });
  }
  Plotly.newPlot(el.book, bookTraces, {
    margin: { t: 24, r: 8, b: 40, l: 48 },
    xaxis: { title: "timestamp" },
    yaxis: { title: "price" }
  });

  // ---------- SECONDARY: Trades ----------
  Plotly.newPlot(el.trades, [
    { x: trades.map(r=>r.timestamp), y: trades.map(r=>num(r.price)), mode:"markers", name:"market trades", text: trades.map(r=>`qty=${r.quantity}`) },
    { x: own.map(r=>r.timestamp), y: own.map(r=>num(r.price)), mode:"markers", name:"your trades", marker:{ size:10, symbol:"diamond" }, text: own.map(r=>`qty=${r.quantity}`) },
  ], {
    margin: { t: 24, r: 8, b: 40, l: 48 },
    xaxis: { title: "timestamp" },
    yaxis: { title: "price" }
  });
}

function wire() {
  el.file.addEventListener("change", async (e) => {
    await parseFiles(e.target.files); refreshSelectors(); draw();
  });
  el.sep.addEventListener("change", async () => {
    if (el.file.files.length) { await parseFiles(el.file.files); refreshSelectors(); draw(); }
  });
  el.product.addEventListener("change", draw);
  el.day.addEventListener("change", draw);
  el.ts.addEventListener("input", (e) => {
    S.tsFrac = Number(e.target.value) / 100;
    el.tsLabel.textContent = S.tsFrac === 1 ? "end" : `${Math.round(S.tsFrac*100)}%`;
    draw();
  });

  // Keep charts responsive to window size
  window.addEventListener("resize", () => {
    Plotly.Plots.resize(el.featured);
    Plotly.Plots.resize(el.book);
    Plotly.Plots.resize(el.trades);
  });
}

window.addEventListener("DOMContentLoaded", wire);
