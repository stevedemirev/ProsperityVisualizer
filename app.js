// Focused: only mid-price line chart, no trades/preview/volumes
const S = { prices: [], tsFrac: 1.0 };
const $ = (id) => document.getElementById(id);

const el = {
  file: $("file"), sep: $("sep"),
  product: $("product"), day: $("day"),
  ts: $("ts"), tsLabel: $("tsLabel"),
  chart: $("chart"),
};

function parseFiles(files) {
  const delimiter = el.sep.value;
  const tasks = [...files].map((f) => new Promise((resolve, reject) => {
    Papa.parse(f, {
      header: true, dynamicTyping: true, delimiter,
      skipEmptyLines: "greedy",
      complete: (res) => resolve(res.data),
      error: reject,
    });
  }));
  return Promise.all(tasks).then((parts) => {
    // Keep rows that look like price rows (must have product, day, timestamp, mid_price)
    const all = parts.flat().filter(r =>
      r && r.product != null && r.day != null && r.timestamp != null && r.mid_price != null
    );
    S.prices = all;
  });
}

function uniq(xs) { return [...new Set(xs)]; }
function toNum(x) { const v = Number(x); return Number.isFinite(v) ? v : null; }

function refreshSelectors() {
  const products = uniq(S.prices.map(r => r.product).filter(Boolean)).sort();
  const days = uniq(S.prices.map(r => r.day).filter(d => d !== undefined)).sort((a,b)=>a-b);

  el.product.innerHTML = products.map(p => `<option>${p}</option>`).join("");
  el.day.innerHTML = days.map(d => `<option>${d}</option>`).join("");
}

function sliceByTime(rows) {
  if (!rows.length) return rows;
  const maxTs = Math.max(...rows.map(r => +r.timestamp || 0));
  const cutoff = maxTs * S.tsFrac;
  return rows.filter(r => (+r.timestamp || 0) <= cutoff);
}

function draw() {
  const product = el.product.value;
  const day = el.day.value;
  const rows = sliceByTime(S.prices.filter(r =>
    String(r.product) === String(product) && String(r.day) === String(day)
  ));

  const t = rows.map(r => r.timestamp);
  const mid = rows.map(r => toNum(r.mid_price));

  const traces = [{ x: t, y: mid, mode: "lines", name: "mid" }];

  const layout = {
    margin: { t: 20, r: 20, b: 48, l: 56 },
    xaxis: { title: "timestamp" },
    yaxis: { title: "mid price", rangemode: "tozero", automargin: true },
  };

  Plotly.newPlot(el.chart, traces, layout, { responsive: true });
}

function wire() {
  el.file.addEventListener("change", async (e) => {
    await parseFiles(e.target.files);
    refreshSelectors();
    draw();
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

  // Resize handler to keep it full screen
  window.addEventListener("resize", () => Plotly.Plots.resize(el.chart));
}
window.addEventListener("DOMContentLoaded", wire);

}

window.addEventListener("DOMContentLoaded", wire);
