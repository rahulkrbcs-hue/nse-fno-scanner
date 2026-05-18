// ============================================================================
// NSE F&O SCANNER — UI Controller
// ============================================================================

const STATE = {
  timeframe: "1d",  // "1h" | "1d" | "1wk" — selected timeframe
  results: [],     // analyzed stocks
  filtered: [],    // after filters applied
  sortKey: "composite",
  sortDir: "desc",
  scanning: false,
  scanIndex: 0,
  errors: [],

  // ---- Auto-scan & persistence ----
  autoScan: false,            // is auto-scan toggled on?
  autoScanInterval: 30,       // minutes between auto-scans (15, 30, 60)
  marketHoursOnly: true,      // only auto-scan during NSE market hours
  lastScanAt: null,           // ISO timestamp of last successful scan
  lastScanTimeframe: null,    // which timeframe was last scanned
  autoScanTimerId: null,      // setInterval handle
  countdownTimerId: null,     // setInterval handle for UI countdown
  bhavcopyDate: null,
};

// ============================================================================
// LOCAL STORAGE — persist last scan + settings
// ============================================================================
const STORAGE_KEY = "nse-fno-scanner-v1";
const SETTINGS_KEY = "nse-fno-scanner-settings-v1";

function saveResults() {
  try {
    // Strip the heavy `bars` array before storing — we only need it during the
    // live session for re-rendering sparklines. Reduces storage from ~5MB to ~200KB.
    const lite = STATE.results.map(r => {
      const closes30 = r.bars.slice(-30).map(b => b.c); // keep 30-bar spark only
      const closes90 = r.bars.slice(-90).map(b => b.c); // keep 90-bar modal chart
      return { ...r, bars: undefined, closes30, closes90 };
    });
    const payload = {
      timestamp: STATE.lastScanAt,
      timeframe: STATE.lastScanTimeframe,
      bhavcopyDate: STATE.bhavcopyDate,
      results: lite,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Could not save results to localStorage:", e.message);
  }
}

function loadResults() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload?.results?.length) return false;
    // Re-hydrate: synthesize a minimal `bars` array from `closes30` for sparkline
    STATE.results = payload.results.map(r => ({
      ...r,
      bars: (r.closes30 || []).map(c => ({ c })),
    }));
    STATE.lastScanAt = payload.timestamp;
    STATE.lastScanTimeframe = payload.timeframe;
    STATE.bhavcopyDate = payload.bhavcopyDate;
    return true;
  } catch (e) {
    console.warn("Could not load saved results:", e.message);
    return false;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      autoScan: STATE.autoScan,
      autoScanInterval: STATE.autoScanInterval,
      marketHoursOnly: STATE.marketHoursOnly,
      timeframe: STATE.timeframe,
    }));
  } catch (e) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.autoScan === "boolean") STATE.autoScan = s.autoScan;
    if (s.autoScanInterval) STATE.autoScanInterval = s.autoScanInterval;
    if (typeof s.marketHoursOnly === "boolean") STATE.marketHoursOnly = s.marketHoursOnly;
    if (s.timeframe) STATE.timeframe = s.timeframe;
  } catch (e) {}
}

// ============================================================================
// MARKET HOURS — NSE: Mon–Fri, 9:15 AM – 3:30 PM IST (UTC+5:30)
// ============================================================================
function isMarketOpen(now = new Date()) {
  // Convert local time to IST. IST = UTC+5:30
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (5.5 * 60 * 60 * 1000));
  const dow = ist.getDay();           // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  // 9:15 = 555, 15:30 = 930 — extend to 6 PM (1080) to include bhavcopy publication window
  return mins >= 555 && mins <= 1080;
}

function timeSinceText(iso) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

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

// ---------- OI Setup chip ----------
function oiSetupChip(r) {
  if (!r.oiInfo) return `<span class="oi-chip oi-none" title="No bhavcopy data">—</span>`;
  const setup = r.oiInfo.setup;
  const chgPct = r.oiInfo.oiChgPct;
  const cls = {
    "LONG BUILDUP":   "oi-lb",
    "SHORT COVERING": "oi-sc",
    "SHORT BUILDUP":  "oi-sb",
    "LONG UNWINDING": "oi-lu",
  }[setup] || "oi-none";
  const setupShort = {
    "LONG BUILDUP":   "L⤴",
    "SHORT COVERING": "Cv",
    "SHORT BUILDUP":  "S⤵",
    "LONG UNWINDING": "Uw",
  }[setup] || "—";
  const tip = setup === "—" ? "No clear OI setup" : `${setup} · OI ${chgPct >= 0 ? "+" : ""}${chgPct.toFixed(1)}%`;
  return `<span class="oi-chip ${cls}" title="${tip}">${setupShort} <span class="oi-pct">${chgPct >= 0 ? "+" : ""}${chgPct.toFixed(0)}%</span></span>`;
}

// ---------- Render results table ----------
function renderTable() {
  const tbody = document.getElementById("results-tbody");
  if (!tbody) return;
  if (!STATE.filtered.length) {
    tbody.innerHTML = `<tr><td colspan="14" class="empty-cell">${
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
        <td class="td-oi">${oiSetupChip(r)}</td>
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
    oi:         r => r.scores.oi ? r.scores.oi.score : 0,
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
      oi: "★ OI Setup (NSE Bhavcopy)",
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

        ${r.oiInfo ? `
        <h3 style="margin-top:24px">★ Open Interest (NSE Bhavcopy)</h3>
        <table class="cam-table">
          <tr><td>Setup</td><td colspan="2"><strong class="oi-chip oi-${{"LONG BUILDUP":"lb","SHORT COVERING":"sc","SHORT BUILDUP":"sb","LONG UNWINDING":"lu"}[r.oiInfo.setup] || "none"}">${r.oiInfo.setup}</strong></td></tr>
          <tr><td>Near-month OI</td><td>${fmt.vol(r.oiInfo.oi)}</td><td class="${r.oiInfo.oiChgPct >= 0 ? "pos" : "neg"}">${r.oiInfo.oiChgPct >= 0 ? "+" : ""}${r.oiInfo.oiChgPct.toFixed(2)}%</td></tr>
          <tr><td>Total OI (all expiries)</td><td>${fmt.vol(r.oiInfo.totalOI)}</td><td class="${r.oiInfo.totalOIChg >= 0 ? "pos" : "neg"}">${r.oiInfo.totalOIChg >= 0 ? "+" : ""}${fmt.vol(Math.abs(r.oiInfo.totalOIChg))}</td></tr>
          <tr><td>Near Expiry</td><td colspan="2">${r.oiInfo.expiry || "—"}</td></tr>
        </table>` : `<p class="muted" style="margin-top:16px">★ OI data not available (bhavcopy not yet published, or this stock not in F&amp;O segment).</p>`}

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

  // -------- Prefetch NSE bhavcopy for OI data (only on 1D timeframe) --------
  let oiData = null;
  if (STATE.timeframe === "1d" && window.Bhavcopy) {
    progressLabel.textContent = "Fetching NSE F&O bhavcopy for Open Interest data…";
    const bhav = await window.Bhavcopy.fetchLatestBhavcopy((msg) => {
      progressLabel.textContent = msg;
    });
    if (bhav) {
      oiData = bhav.summary;
      STATE.bhavcopyDate = bhav.date;
      // Update OI status pill
      const oiPill = document.getElementById("oi-status");
      if (oiPill) {
        oiPill.textContent = `OI: ${window.Bhavcopy.fmtNSEDate(bhav.date)} (${oiData.size} stocks)`;
        oiPill.classList.add("oi-active");
      }
    } else {
      const oiPill = document.getElementById("oi-status");
      if (oiPill) oiPill.textContent = "OI: unavailable";
    }
  } else {
    const oiPill = document.getElementById("oi-status");
    if (oiPill) oiPill.textContent = STATE.timeframe === "1d" ? "OI: loading…" : "OI: 1D only";
  }

  await runWithConcurrency(
    stocks,
    async (s) => {
      const r = await FNOEngine.analyzeStock(s.symbol, STATE.timeframe, oiData);
      STATE.results.push(r);
      // Re-render incrementally every 5 stocks
      if (STATE.results.length % 5 === 0) {
        applyFilters();
        renderStats();
      }
      return r;
    },
    STATE.timeframe === "1h" ? 4 : 6,    // hourly is heavier — back off a bit
    (done) => {
      progressBar.style.width = `${(done / total) * 100}%`;
      progressLabel.textContent = `${done} / ${total} stocks analyzed${oiData ? " · OI overlay active" : ""}`;
    }
  );

  applyFilters();
  renderStats();
  STATE.scanning = false;
  STATE.lastScanAt = new Date().toISOString();
  STATE.lastScanTimeframe = STATE.timeframe;
  btn.textContent = "🔄 Re-Run Scan";
  btn.disabled = false;
  if (STATE.errors.length)
    progressLabel.textContent += ` · ${STATE.errors.length} failed (rate limited / no data)`;
  // Persist results for next page load
  if (STATE.results.length) saveResults();
  renderAutoScanStatus();
}

// ---------- Export CSV ----------
function exportCSV() {
  if (!STATE.filtered.length) return alert("Nothing to export. Run a scan first.");
  const rows = [["Symbol", "Price", "Change %", "BB", "VCP", "SmartMoney", "Camarilla", "Traps", "CRT/TBS", "Breakout", "RSI Div", "EMA", "OI Setup", "OI Chg %", "Near-Mo OI", "Composite", "Verdict"]];
  for (const r of STATE.filtered) {
    rows.push([
      r.symbol, r.price.toFixed(2), r.changePct.toFixed(2),
      r.scores.bb.score, r.scores.vcp.score, r.scores.smartMoney.score,
      r.scores.camarilla.score, r.scores.traps.score, r.scores.crtTbs.score,
      r.scores.breakout.score, r.scores.rsiDiv.score, r.scores.emaStack.score,
      r.oiInfo ? r.oiInfo.setup : "—",
      r.oiInfo ? r.oiInfo.oiChgPct.toFixed(2) : "—",
      r.oiInfo ? r.oiInfo.oi.toFixed(0) : "—",
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

// ============================================================================
// AUTO-SCAN CONTROLLER
// ============================================================================
function startAutoScan() {
  stopAutoScan();
  STATE.autoScan = true;
  saveSettings();
  // Check every minute whether to trigger a scan (lighter than full interval)
  STATE.autoScanTimerId = setInterval(autoScanTick, 60 * 1000);
  // Update countdown UI every 5 seconds
  STATE.countdownTimerId = setInterval(renderAutoScanStatus, 5000);
  renderAutoScanStatus();
}

function stopAutoScan() {
  STATE.autoScan = false;
  if (STATE.autoScanTimerId) { clearInterval(STATE.autoScanTimerId); STATE.autoScanTimerId = null; }
  if (STATE.countdownTimerId) { clearInterval(STATE.countdownTimerId); STATE.countdownTimerId = null; }
  saveSettings();
  renderAutoScanStatus();
}

function autoScanTick() {
  if (STATE.scanning) return;
  if (!STATE.lastScanAt) return;
  if (STATE.marketHoursOnly && !isMarketOpen()) { renderAutoScanStatus(); return; }
  const elapsedMin = (Date.now() - new Date(STATE.lastScanAt).getTime()) / 60000;
  if (elapsedMin < STATE.autoScanInterval) { renderAutoScanStatus(); return; }
  console.log("[auto-scan] Triggering scheduled scan");
  runScan();
}

function pad2(n) { return n < 10 ? "0" + n : "" + n; }

function renderAutoScanStatus() {
  const lastEl = document.getElementById("last-scan");
  const nextEl = document.getElementById("next-scan");
  const dotEl  = document.getElementById("auto-scan-dot");
  if (!lastEl || !nextEl) return;

  if (STATE.lastScanAt) {
    const tf = STATE.lastScanTimeframe ? `· ${STATE.lastScanTimeframe.toUpperCase()}` : "";
    lastEl.textContent = `Last: ${timeSinceText(STATE.lastScanAt)} ${tf}`;
    lastEl.title = `Last scan: ${new Date(STATE.lastScanAt).toLocaleString("en-IN")}`;
  } else {
    lastEl.textContent = "Last: never";
  }

  if (STATE.autoScan && STATE.lastScanAt) {
    if (STATE.marketHoursOnly && !isMarketOpen()) {
      nextEl.textContent = "Auto: paused (market closed)";
      if (dotEl) dotEl.className = "auto-dot dot-paused";
    } else {
      const nextMs = new Date(STATE.lastScanAt).getTime() + STATE.autoScanInterval * 60000;
      const remaining = nextMs - Date.now();
      if (remaining <= 0) {
        nextEl.textContent = "Auto: running soon…";
      } else {
        const min = Math.floor(remaining / 60000);
        const sec = Math.floor((remaining % 60000) / 1000);
        nextEl.textContent = `Next: ${min}m ${pad2(sec)}s`;
      }
      if (dotEl) dotEl.className = "auto-dot dot-live";
    }
  } else if (STATE.autoScan) {
    nextEl.textContent = "Auto: waiting for 1st scan";
    if (dotEl) dotEl.className = "auto-dot dot-live";
  } else {
    nextEl.textContent = "Auto: OFF";
    if (dotEl) dotEl.className = "auto-dot dot-off";
  }
}

// ============================================================================
// INIT
// ============================================================================
function init() {
  // -------- Load persisted settings + last results --------
  loadSettings();
  const hadCachedResults = loadResults();

  // Reflect timeframe from settings on the toggle
  if (STATE.timeframe !== "1d") {
    document.querySelectorAll(".tf-btn").forEach(b => {
      b.classList.toggle("tf-active", b.dataset.tf === STATE.timeframe);
    });
    const tfInfo = FNOEngine.TIMEFRAMES[STATE.timeframe];
    if (tfInfo) {
      document.getElementById("tf-pill-label").textContent = tfInfo.label;
      document.getElementById("tf-pill-desc").textContent = tfInfo.description;
    }
  }

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

  // -------- Auto-scan controls --------
  const autoToggle = document.getElementById("auto-scan-toggle");
  const intervalSel = document.getElementById("auto-scan-interval");
  const marketOnlyToggle = document.getElementById("market-hours-toggle");

  if (autoToggle) {
    autoToggle.checked = STATE.autoScan;
    autoToggle.addEventListener("change", () => {
      if (autoToggle.checked) startAutoScan();
      else stopAutoScan();
    });
  }
  if (intervalSel) {
    intervalSel.value = String(STATE.autoScanInterval);
    intervalSel.addEventListener("change", () => {
      STATE.autoScanInterval = parseInt(intervalSel.value) || 30;
      saveSettings();
      renderAutoScanStatus();
    });
  }
  if (marketOnlyToggle) {
    marketOnlyToggle.checked = STATE.marketHoursOnly;
    marketOnlyToggle.addEventListener("change", () => {
      STATE.marketHoursOnly = marketOnlyToggle.checked;
      saveSettings();
      renderAutoScanStatus();
    });
  }

  // Timeframe toggle → switch timeframe, clear results, auto-rescan
  document.querySelectorAll(".tf-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tf = btn.dataset.tf;
      if (STATE.scanning || tf === STATE.timeframe) return;
      STATE.timeframe = tf;
      saveSettings();
      // Update active state
      document.querySelectorAll(".tf-btn").forEach(b => b.classList.remove("tf-active"));
      btn.classList.add("tf-active");
      // Update meta pill
      const tfInfo = FNOEngine.TIMEFRAMES[tf];
      document.getElementById("tf-pill-label").textContent = tfInfo.label;
      document.getElementById("tf-pill-desc").textContent = tfInfo.description;
      // Clear old results (they're now stale for this timeframe)
      STATE.results = [];
      STATE.filtered = [];
      renderTable();
      renderStats();
      // Hint
      document.getElementById("progress-label").textContent = `Switched to ${tfInfo.label} — click RUN SCAN`;
      document.getElementById("progress-wrap").style.display = "block";
      document.getElementById("progress-fill").style.width = "0%";
    });
  });

  // Stat-card click → filter by verdict
  document.querySelectorAll(".stat[data-verdict]").forEach(stat => {
    stat.addEventListener("click", () => {
      const v = stat.dataset.verdict;
      const sel = document.getElementById("filter-verdict");
      sel.value = (sel.value === v) ? "all" : v;
      document.querySelectorAll(".stat[data-verdict]").forEach(s => s.classList.remove("stat-active"));
      if (sel.value !== "all") stat.classList.add("stat-active");
      applyFilters();
      document.querySelector(".table-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

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

  // -------- Restore last scan if cached --------
  if (hadCachedResults) {
    applyFilters();
    renderStats();
    // Restore OI pill text if we have a bhavcopy date
    if (STATE.bhavcopyDate) {
      const oiPill = document.getElementById("oi-status");
      if (oiPill) {
        const d = new Date(STATE.bhavcopyDate);
        const ymd = `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`;
        oiPill.textContent = `OI: ${ymd} (cached)`;
        oiPill.classList.add("oi-active");
      }
    }
  }

  // -------- Resume auto-scan if it was on before --------
  if (STATE.autoScan) startAutoScan();
  renderAutoScanStatus();
}

document.addEventListener("DOMContentLoaded", init);
