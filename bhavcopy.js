// ============================================================================
// NSE F&O BHAVCOPY FETCHER
// Official source: https://nsearchives.nseindia.com (UDiFF format, post Jul 2024)
//
// URL pattern: BhavCopy_NSE_FO_0_0_0_YYYYMMDD_F_0000.csv.zip
// Generated daily ~6 PM IST after market close.
// Contains: every F&O instrument (futures + all option strikes/expiries)
// with Open Interest, OI Change, Settle Price, Contracts Traded.
// ============================================================================

// JSZip is loaded via CDN in index.html → window.JSZip

// -------- Date helpers --------
function pad(n) { return n < 10 ? "0" + n : "" + n; }
function fmtNSEDate(d) {
  // Returns "YYYYMMDD" string from Date
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

// Walk back to the most recent trading day (skip weekends — leaves holiday-handling to retry loop)
function* tradingDaysBack(startDate, max = 7) {
  const d = new Date(startDate);
  for (let i = 0; i < max; i++) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) yield new Date(d);
    d.setDate(d.getDate() - 1);
  }
}

// -------- Fetch raw bhavcopy ZIP for a date, via CORS proxies --------
async function fetchBhavcopyZip(date) {
  const ymd = fmtNSEDate(date);
  const nseUrl =
    `https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_${ymd}_F_0000.csv.zip`;

  // NSE blocks direct browser requests — use CORS proxies
  const proxies = [
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  for (const proxy of proxies) {
    try {
      const resp = await fetch(proxy(nseUrl));
      if (!resp.ok) continue;
      const blob = await resp.blob();
      if (blob.size < 1000) continue;        // probably an error page
      return { blob, date, url: nseUrl };
    } catch (e) { /* try next proxy */ }
  }
  return null;
}

// -------- Parse the ZIP → CSV → array of records --------
async function parseBhavcopyZip(zipBlob) {
  if (!window.JSZip) throw new Error("JSZip not loaded");
  const zip = await window.JSZip.loadAsync(zipBlob);
  // Find the .csv inside (there's just one)
  const csvName = Object.keys(zip.files).find(n => n.toLowerCase().endsWith(".csv"));
  if (!csvName) throw new Error("No CSV in bhavcopy zip");
  const csvText = await zip.file(csvName).async("string");

  // Parse CSV manually (no quoted commas in NSE files — simple split)
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map(s => s.trim());

  // Field name map (UDiFF schema)
  const idx = {
    tckr:        header.indexOf("TckrSymb"),
    instr:       header.indexOf("FinInstrmTp"),    // STF=Stock Future, IDF=Index Future, STO=Stock Option, IDO=Index Option
    xpiry:       header.indexOf("XpryDt"),
    open:        header.indexOf("OpnPric"),
    high:        header.indexOf("HghPric"),
    low:         header.indexOf("LwPric"),
    close:       header.indexOf("ClsPric"),
    settle:      header.indexOf("SttlmPric"),
    oi:          header.indexOf("OpnIntrst"),
    oiChg:       header.indexOf("ChngInOpnIntrst"),
    volume:      header.indexOf("TtlTradgVol"),
    contracts:   header.indexOf("TtlNbOfTradgCntrcts"),
  };
  if (idx.tckr < 0 || idx.oi < 0) throw new Error("Unexpected CSV schema");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c.length < header.length - 2) continue;
    rows.push({
      symbol:    c[idx.tckr]?.trim(),
      instrType: c[idx.instr]?.trim(),
      expiry:    c[idx.xpiry]?.trim(),
      open:      parseFloat(c[idx.open]),
      high:      parseFloat(c[idx.high]),
      low:       parseFloat(c[idx.low]),
      close:     parseFloat(c[idx.close]),
      settle:    parseFloat(c[idx.settle]),
      oi:        parseFloat(c[idx.oi])     || 0,
      oiChg:     parseFloat(c[idx.oiChg])  || 0,
      volume:    parseFloat(c[idx.volume]) || 0,
      contracts: parseFloat(c[idx.contracts]) || 0,
    });
  }
  return rows;
}

// -------- Build a per-symbol OI summary from rows (futures only, near-month) --------
function summarizeOIBySymbol(rows) {
  // Keep only Stock & Index Futures (skip options)
  const futs = rows.filter(r => r.instrType === "STF" || r.instrType === "IDF");
  // Group by symbol; for each symbol pick the NEAREST expiry (current month future)
  const bySym = new Map();
  for (const r of futs) {
    const e = new Date(r.expiry);
    const cur = bySym.get(r.symbol);
    if (!cur || e < new Date(cur.expiry)) {
      bySym.set(r.symbol, r);
    }
  }
  // Aggregate ALL expiries for total OI per symbol (deeper signal)
  const totalOI = new Map();
  for (const r of futs) {
    const cur = totalOI.get(r.symbol) || { oi: 0, oiChg: 0 };
    cur.oi += r.oi;
    cur.oiChg += r.oiChg;
    totalOI.set(r.symbol, cur);
  }
  // Merge
  const out = new Map();
  for (const [sym, near] of bySym.entries()) {
    const total = totalOI.get(sym) || { oi: 0, oiChg: 0 };
    out.set(sym, {
      ...near,
      totalOI: total.oi,
      totalOIChg: total.oiChg,
      oiChgPct: near.oi > 0 ? (near.oiChg / (near.oi - near.oiChg)) * 100 : 0,
    });
  }
  return out;
}

// -------- High-level: try to fetch the most recent available bhavcopy --------
async function fetchLatestBhavcopy(onLog) {
  const log = onLog || (() => {});
  // Today's bhavcopy publishes ~6 PM IST. Walk back if we're earlier or it's a holiday.
  const candidates = [...tradingDaysBack(new Date(), 7)];
  for (const date of candidates) {
    log(`Trying NSE bhavcopy for ${fmtNSEDate(date)}…`);
    const z = await fetchBhavcopyZip(date);
    if (!z) continue;
    try {
      const rows = await parseBhavcopyZip(z.blob);
      if (rows.length > 100) {
        log(`✅ Loaded NSE bhavcopy for ${fmtNSEDate(date)} (${rows.length} rows)`);
        const summary = summarizeOIBySymbol(rows);
        return { date, rows, summary };
      }
    } catch (e) {
      log(`Parse error: ${e.message}`);
    }
  }
  log(`❌ Could not fetch NSE bhavcopy after 7 attempts. Scanner will run without OI data.`);
  return null;
}

// -------- OI Score: classify into Long Buildup / Short Buildup / Unwinding / Covering --------
// Combines price change (from Yahoo data) with OI change (from bhavcopy)
function scoreOI(priceChangePct, oiChgPct) {
  // Magnitude floors — ignore noise
  const priceMove = Math.abs(priceChangePct) > 0.3;
  const oiMove    = Math.abs(oiChgPct) > 1.0;

  if (!priceMove || !oiMove) {
    return {
      score: 0,
      setup: "—",
      label: "No clear OI setup",
      detail: `Px ${priceChangePct.toFixed(2)}% / OI ${oiChgPct.toFixed(2)}%`,
    };
  }

  if (priceChangePct > 0 && oiChgPct > 0) {
    // Long Buildup — strongest bullish F&O signal
    const intensity = Math.min(10, Math.floor((Math.abs(oiChgPct) / 5) + 4));
    return {
      score: intensity,
      setup: "LONG BUILDUP",
      label: "Long Buildup (Bullish)",
      detail: `Px +${priceChangePct.toFixed(2)}% & OI +${oiChgPct.toFixed(2)}% — fresh longs`,
    };
  }
  if (priceChangePct < 0 && oiChgPct > 0) {
    // Short Buildup — strongest bearish F&O signal
    const intensity = Math.min(10, Math.floor((Math.abs(oiChgPct) / 5) + 4));
    return {
      score: -intensity,
      setup: "SHORT BUILDUP",
      label: "Short Buildup (Bearish)",
      detail: `Px ${priceChangePct.toFixed(2)}% & OI +${oiChgPct.toFixed(2)}% — fresh shorts`,
    };
  }
  if (priceChangePct > 0 && oiChgPct < 0) {
    // Short Covering — bullish but less strong
    const intensity = Math.min(7, Math.floor((Math.abs(oiChgPct) / 5) + 3));
    return {
      score: intensity,
      setup: "SHORT COVERING",
      label: "Short Covering (Bullish)",
      detail: `Px +${priceChangePct.toFixed(2)}% & OI ${oiChgPct.toFixed(2)}% — shorts exiting`,
    };
  }
  // priceChangePct < 0 && oiChgPct < 0
  // Long Unwinding — bearish but less strong
  const intensity = Math.min(7, Math.floor((Math.abs(oiChgPct) / 5) + 3));
  return {
    score: -intensity,
    setup: "LONG UNWINDING",
    label: "Long Unwinding (Bearish)",
    detail: `Px ${priceChangePct.toFixed(2)}% & OI ${oiChgPct.toFixed(2)}% — longs exiting`,
  };
}

// Expose to global
window.Bhavcopy = {
  fetchLatestBhavcopy,
  scoreOI,
  fmtNSEDate,
  // for debugging
  _internal: { fetchBhavcopyZip, parseBhavcopyZip, summarizeOIBySymbol },
};
