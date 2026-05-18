// ============================================================================
// NSE F&O SCANNER — UI Controller
// ============================================================================

const STATE = {
  results: [],     // analyzed stocks
  filtered: [],    // after filters applied
  sortKey: "composite",
  sortDir: "desc",
  scanning: false,
  scanIndex: 0,
  errors: [],
};

// ---------- Concurrency-limited parallel runner ----------
async function runWithConcurrency(items, worker, concurrency, onProgress) {
  const queue = [...items];
  let done = 0;
  const results = [];
  async function next() {
    while (queue.length) {
      const item = queue.shift();
      try {
        const r = await worker(item);
        if (r) results.push(r);
      } catch (e) {
        STATE.errors.push({ item, error: e.message || String(e) });
      }
      done++;
      onProgress(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()));
  return results;
}

// ---------- Sparkline (inline SVG) ----------
function sparkline(values, width = 80, height = 24, color = "#7ee787") {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) =>
    `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`
  ).join(" ");
  return `<svg class="spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <polyline fill="none" stroke="${color}" stroke-width="1.5" points="${pts}"/>
  </svg>`;
}

// ---------- Format helpers ----------
const fmt = {
  num: (n, d = 2) => n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct: n => n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
  vol: n => {
    if (!n) return "—";
    if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
    if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
    return n.toString();
  },
  date: d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—",
};

// ---------- Score chip ----------
function scoreChip(s) {
  const cls = s.score >= 5 ? "chip-bull" : s.score >= 1 ? "chip-bull-light" :
              s.score <= -5 ? "chip-bear" : s.score <= -1 ? "chip-bear-light" : "chip-neut";
  const sign = s.score > 0 ? "+" : "";
  return `<span class="chip ${cls}" title="${s.label}: ${s.detail || ''}">${sign}${s.score}</span>`;
}

// ---------- Render results table ----------
function renderTable() {
  const tbody = document.getElementById("results-tbody");
  if (!tbody) return;
  if (!STATE.filtered.length) {
    tbody.innerHTML = `<tr><td colspan="13" class="empty-cell">${
      STATE.scanning ? "Scanning… first results coming." : "No results yet. Click Run Scan."
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = STATE.filtered.map((r, idx) => {
    const closes = r.bars.slice(-30).map(b => b.c);
    const sparkColor = r.composite > 0 ? "#5dffb6" : r.composite < 0 ? "#ff7676" : "#888";
    const stockMeta = FNO_STOCKS.find(s => s.symbol === r.symbol) || {};
    return `
      <tr class="row" data-symbol="${r.symbol}" data-idx="${idx}">
        <td class="td-rank">${idx + 1}</td>
        <td class="td-sym">
          <div class="sym-cell">
            <span class="sym">${r.symbol}</span>
            <span class="sym-name">${stockMeta.name || ""}</span>
          </div>
        </td>
        <td class="td-num">${fmt.num(r.price)}</td>
        <td class="td-num ${r.change >= 0 ? "pos" : "neg"}">${fmt.pct(r.changePct)}</td>
        <td class="td-spark">${sparkline(closes, 70, 22, sparkColor)}</td>
        <td>${scoreChip(r.scores.bb)}</td>
        <td>${scoreChip(r.scores.vcp)}</td>
        <td>${scoreChip(r.scores.smartMoney)}</td>
        <td>${scoreChip(r.scores.camarilla)}</td>
        <td>${scoreChip(r.scores.traps)}</td>
        <td>${scoreChip(r.scores.breakout)}</td>
        <td>${scoreChip(r.scores.rsiDiv)}</td>
        <td class="td-score">
          <div class="composite ${r.verdict.cls}">
            <span class="comp-num">${r.composite.toFixed(0)}</span>
            <span class="comp-tag">${r.verdict.tag}</span>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Bind row clicks for detail modal
  tbody.querySelectorAll(".row").forEach(tr => {
    tr.addEventListener("click", () => openDetail(parseInt(tr.dataset.idx)));
  });
}

// ---------- Update stats summary ----------
function renderStats() {
  const total = STATE.results.length;
  const strongBuy = STATE.results.filter(r => r.composite >= 50).length;
  const buy       = STATE.results.filter(r => r.composite >= 20 && r.composite < 50).length;
  const sell      = STATE.results.filter(r => r.composite <= -20 && r.composite > -50).length;
  const strongSell = STATE.results.filter(r => r.composite <= -50).length;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-sb").textContent = strongBuy;
  document.getElementById("stat-b").textContent = buy;
  document.getElementById("stat-s").textContent = sell;
  document.getElementById("stat-ss").textContent = strongSell;
}

// ---------- Filters & sorting ----------
function applyFilters() {
  const verdictFilter = document.getElementById("filter-verdict").value;
  const sectorFilter = document.getElementById("filter-sector").value;
  const search = document.getElementById("filter-search").value.trim().toUpperCase();
  const minScore = parseFloat(document.getElementById("filter-min-score").value) || -100;
  const maxScore = parseFloat(document.getElementById("filter-max-score").value) || 100;

  STATE.filtered = STATE.results.filter(r => {
    if (verdictFilter !== "all" && r.verdict.tag !== verdictFilter) return false;
    if (search && !r.symbol.includes(search)) return false;
    if (sectorFilter !== "all") {
      const stock = FNO_STOCKS.find(s => s.symbol === r.symbol);
      if (!stock || stock.sector !== sectorFilter) return false;
    }
    if (r.composite < minScore || r.composite > maxScore) return false;
    return true;
  });

  sortFiltered();
  renderTable();
}

function sortFiltered() {
  const k = STATE.sortKey, dir = STATE.sortDir === "asc" ? 1 : -1;
  const accessor = {
    rank:       r => 0,
    symbol:     r => r.symbol,
    price:      r => r.price,
    change:     r => r.changePct,
    composite:  r => r.composite,
    bb:         r => r.scores.bb.score,
    vcp:        r => r.scores.vcp.score,
    smartMoney: r => r.scores.smartMoney.score,
    camarilla:  r => r.scores.camarilla.score,
    traps:      r => r.scores.traps.score,
    breakout:   r => r.scores.breakout.score,
    rsiDiv:     r => r.scores.rsiDiv.score,
  }[k] || (r => r.composite);
  STATE.filtered.sort((a, b) => {
    const va = accessor(a), vb = accessor(b);
    if (typeof va === "string") return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });
}

// ---------- Detail Modal ----------
function openDetail(idx) {
  const r = STATE.filtered[idx];
  if (!r) return;
  const stock = FNO_STOCKS.find(s => s.symbol === r.symbol) || {};
  const modal = document.getElementById("detail-modal");
  const body = document.getElementById("detail-body");

  // Build detailed breakdown
  const scoreRows = Object.entries(r.scores).map(([k, v]) => {
    const cls = v.score >= 5 ? "pos" : v.score <= -5 ? "neg" : v.score > 0 ? "pos-light" : v.score < 0 ? "neg-light" : "neut";
    const niceName = {
      bb: "Bollinger Bands",
      vcp: "Volume Contraction (VCP)",
      smartMoney: "Smart Money Flow",
      camarilla: "Monthly Camarilla",
      traps: "Bull/Bear Trap",
      crtTbs: "CRT + TBS",
      breakout: "Breakout Potential",
      rsiDiv: "RSI Divergence",
      emaStack: "EMA Trend Stack",
    }[k] || k;
    return `
      <div class="score-row">
        <div class="score-row-name">${niceName}</div>
        <div class="score-row-bar">
          <div class="score-bar-track">
            <div class="score-bar-fill ${cls}" style="width:${Math.abs(v.score) * 10}%;
              ${v.score < 0 ? "right:50%" : "left:50%"}"></div>
          </div>
        </div>
        <div class="score-row-val ${cls}">${v.score > 0 ? "+" : ""}${v.score}</div>
        <div class="score-row-label">${v.label}</div>
      </div>
    `;
  }).join("");

  // Sparkline of last 90 days
  const sparkBig = r.bars.slice(-90).map(b => b.c);
  const sparkColor = r.composite >= 0 ? "#5dffb6" : "#ff7676";

  // Camarilla levels if available
  const cam = r.scores.camarilla.levels;
  const camRows = cam ? `
    <table class="cam-table">
      <tr><td>R3 (H4)</td><td class="pos">${fmt.num(cam.H4)}</td><td>Breakout target</td></tr>
      <tr><td>R2 (H3)</td><td class="pos-light">${fmt.num(cam.H3)}</td><td>Strong resistance</td></tr>
      <tr><td>Pivot</td><td>${fmt.num(cam.P)}</td><td>Center</td></tr>
      <tr><td>S2 (L3)</td><td class="neg-light">${fmt.num(cam.L3)}</td><td>Strong support</td></tr>
      <tr><td>S3 (L4)</td><td class="neg">${fmt.num(cam.L4)}</td><td>Breakdown target</td></tr>
    </table>` : `<p class="muted">Camarilla data unavailable (need previous month).</p>`;

  body.innerHTML = `
    <div class="modal-header">
      <div>
        <div class="modal-sym">${r.symbol}</div>
        <div class="modal-name">${stock.name || ""} · ${stock.sector || ""}</div>
      </div>
      <div class="modal-price">
        <div class="big-price">₹${fmt.num(r.price)}</div>
        <div class="${r.change >= 0 ? "pos" : "neg"}">${fmt.pct(r.changePct)} · As of ${fmt.date(r.asOf)}</div>
      </div>
      <div class="modal-verdict">
        <div class="composite ${r.verdict.cls}" style="font-size:1.6em">
          <span class="comp-num">${r.composite.toFixed(0)}</span>
          <span class="comp-tag">${r.verdict.tag}</span>
        </div>
      </div>
    </div>

    <div class="modal-chart">
      ${sparkline(sparkBig, 720, 100, sparkColor)}
      <div class="chart-label">90-day price action</div>
    </div>

    <div class="modal-grid">
      <div class="modal-section">
        <h3>Indicator Breakdown</h3>
        ${scoreRows}
      </div>

      <div class="modal-section">
        <h3>Monthly Camarilla Levels</h3>
        ${camRows}

        <h3 style="margin-top:24px">Trade Plan (Suggested)</h3>
        <table class="trade-table">
          <tr><td>Side</td><td><strong>${r.trade.side}</strong></td></tr>
          <tr><td>Entry</td><td>₹${fmt.num(r.trade.entry)}</td></tr>
          <tr><td>Stop Loss</td><td class="neg">₹${fmt.num(r.trade.sl)}</td></tr>
          <tr><td>Target 1 (1:1.3)</td><td class="pos">₹${fmt.num(r.trade.t1)}</td></tr>
          <tr><td>Target 2 (1:2.6)</td><td class="pos">₹${fmt.num(r.trade.t2)}</td></tr>
          <tr><td>ATR(14)</td><td>₹${fmt.num(r.atr)}</td></tr>
        </table>
      </div>
    </div>

    <div class="modal-foot">
      <p class="muted">
        <strong>Disclaimer:</strong> Algorithmic technical signals only. Not investment advice. Always confirm with your own analysis,
        check Open Interest, options skew, news flow, and risk-manage every trade. Past patterns don't guarantee future outcomes.
      </p>
    </div>
  `;
  modal.classList.add("open");
}

function closeDetail() { document.getElementById("detail-modal").classList.remove("open"); }

// ---------- Scan controller ----------
async function runScan() {
  if (STATE.scanning) return;
  STATE.scanning = true;
  STATE.results = [];
  STATE.errors = [];
  STATE.scanIndex = 0;

  const btn = document.getElementById("scan-btn");
  btn.textContent = "Scanning…";
  btn.disabled = true;

  const progressBar = document.getElementById("progress-fill");
  const progressLabel = document.getElementById("progress-label");
  document.getElementById("progress-wrap").style.display = "block";

  // Choose universe
  const universe = document.getElementById("universe-select").value;
  let stocks;
  if (universe === "nifty50") {
    const NIFTY50 = ["HDFCBANK","ICICIBANK","SBIN","AXISBANK","KOTAKBANK","BAJFINANCE","BAJAJFINSV",
      "HDFCLIFE","SBILIFE","INFY","TCS","WIPRO","HCLTECH","TECHM","LTIM","RELIANCE","ONGC","BPCL",
      "NTPC","POWERGRID","TATASTEEL","JSWSTEEL","HINDALCO","COALINDIA","MARUTI","M&M","TATAMOTORS",
      "BAJAJ-AUTO","HEROMOTOCO","EICHERMOT","HINDUNILVR","ITC","NESTLEIND","BRITANNIA","TATACONSUM",
      "SUNPHARMA","DRREDDY","CIPLA","APOLLOHOSP","ULTRACEMCO","GRASIM","LT","ASIANPAINT","TITAN",
      "BHARTIARTL","ADANIENT","ADANIPORTS","ETERNAL","JIOFIN","TRENT"];
    stocks = FNO_STOCKS.filter(s => NIFTY50.includes(s.symbol));
  } else if (universe === "banknifty") {
    const BN = ["HDFCBANK","ICICIBANK","SBIN","AXISBANK","KOTAKBANK","INDUSINDBK","BANKBARODA",
      "PNB","CANBK","AUBANK","IDFCFIRSTB","FEDERALBNK"];
    stocks = FNO_STOCKS.filter(s => BN.includes(s.symbol));
  } else {
    stocks = FNO_STOCKS;
  }

  const total = stocks.length;
  await runWithConcurrency(
    stocks,
    async (s) => {
      const r = await FNOEngine.analyzeStock(s.symbol);
      STATE.results.push(r);
      // Re-render incrementally every 5 stocks
      if (STATE.results.length % 5 === 0) {
        applyFilters();
        renderStats();
      }
      return r;
    },
    6,    // concurrency — keep moderate to avoid rate limiting
    (done) => {
      progressBar.style.width = `${(done / total) * 100}%`;
      progressLabel.textContent = `${done} / ${total} stocks analyzed`;
    }
  );

  applyFilters();
  renderStats();
  STATE.scanning = false;
  btn.textContent = "🔄 Re-Run Scan";
  btn.disabled = false;
  if (STATE.errors.length)
    progressLabel.textContent += ` · ${STATE.errors.length} failed (rate limited / no data)`;
}

// ---------- Export CSV ----------
function exportCSV() {
  if (!STATE.filtered.length) return alert("Nothing to export. Run a scan first.");
  const rows = [["Symbol", "Price", "Change %", "BB", "VCP", "SmartMoney", "Camarilla", "Traps", "CRT/TBS", "Breakout", "RSI Div", "EMA", "Composite", "Verdict"]];
  for (const r of STATE.filtered) {
    rows.push([
      r.symbol, r.price.toFixed(2), r.changePct.toFixed(2),
      r.scores.bb.score, r.scores.vcp.score, r.scores.smartMoney.score,
      r.scores.camarilla.score, r.scores.traps.score, r.scores.crtTbs.score,
      r.scores.breakout.score, r.scores.rsiDiv.score, r.scores.emaStack.score,
      r.composite.toFixed(1), r.verdict.tag,
    ]);
  }
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nse-fno-scan-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ---------- Init ----------
function init() {
  // Populate sector filter
  const sectors = [...new Set(FNO_STOCKS.map(s => s.sector))].sort();
  const sectorSel = document.getElementById("filter-sector");
  for (const sec of sectors) {
    const o = document.createElement("option");
    o.value = sec; o.textContent = sec;
    sectorSel.appendChild(o);
  }

  // Bind events
  document.getElementById("scan-btn").addEventListener("click", runScan);
  document.getElementById("export-btn").addEventListener("click", exportCSV);
  document.getElementById("modal-close").addEventListener("click", closeDetail);
  document.getElementById("detail-modal").addEventListener("click", (e) => {
    if (e.target.id === "detail-modal") closeDetail();
  });
  ["filter-verdict","filter-sector","filter-search","filter-min-score","filter-max-score"]
    .forEach(id => document.getElementById(id).addEventListener("input", applyFilters));

  // Sort by column header
  document.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const k = th.dataset.sort;
      if (STATE.sortKey === k) STATE.sortDir = STATE.sortDir === "asc" ? "desc" : "asc";
      else { STATE.sortKey = k; STATE.sortDir = "desc"; }
      document.querySelectorAll("th[data-sort]").forEach(t => t.classList.remove("sorted-asc","sorted-desc"));
      th.classList.add(STATE.sortDir === "asc" ? "sorted-asc" : "sorted-desc");
      sortFiltered(); renderTable();
    });
  });

  // Show universe size
  document.getElementById("universe-count").textContent = FNO_STOCKS.length;
}

document.addEventListener("DOMContentLoaded", init);
