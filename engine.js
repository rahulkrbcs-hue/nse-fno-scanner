// ============================================================================
// NSE F&O SCANNER - Technical Analysis Engine
// All calculations done in browser on EOD data from Yahoo Finance
// ============================================================================

// -------- CORS proxies (rotated on failure) --------
const CORS_PROXIES = [
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// -------- Yahoo Finance EOD fetch --------
async function fetchYahooEOD(symbol, range = "6mo", interval = "1d") {
  // NSE symbols need .NS suffix; symbols starting with ^ are indices (no suffix)
  const ySym = symbol.startsWith("^") ? symbol : `${symbol}.NS`;
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}` +
    `?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplit`;

  let lastErr;
  for (const proxy of CORS_PROXIES) {
    try {
      const resp = await fetch(proxy(url), { method: "GET" });
      if (!resp.ok) { lastErr = new Error(`HTTP ${resp.status}`); continue; }
      const data = await resp.json();
      const r = data?.chart?.result?.[0];
      if (!r) { lastErr = new Error("No chart data"); continue; }
      const ts = r.timestamp || [];
      const q  = r.indicators?.quote?.[0] || {};
      const adj = r.indicators?.adjclose?.[0]?.adjclose || q.close || [];
      // Pack into OHLCV bars, drop nulls
      const bars = [];
      for (let i = 0; i < ts.length; i++) {
        if (q.open?.[i] == null || q.high?.[i] == null || q.low?.[i] == null || q.close?.[i] == null) continue;
        bars.push({
          t: new Date(ts[i] * 1000),
          o: q.open[i],
          h: q.high[i],
          l: q.low[i],
          c: q.close[i],
          v: q.volume?.[i] ?? 0,
          ac: adj[i] ?? q.close[i],
        });
      }
      return bars;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("All proxies failed");
}

// ============================================================================
// PRIMITIVE INDICATORS
// ============================================================================
const last = a => a[a.length - 1];
const slice = (a, n) => a.slice(-n);
const sum   = a => a.reduce((s, x) => s + x, 0);
const mean  = a => sum(a) / a.length;
const stdev = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

function sma(values, period) {
  const out = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) out[i] = mean(values.slice(i - period + 1, i + 1));
  return out;
}

function ema(values, period) {
  const out = Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) { prev = mean(values.slice(0, period)); out[i] = prev; }
    else { prev = values[i] * k + prev * (1 - k); out[i] = prev; }
  }
  return out;
}

function rsi(closes, period = 14) {
  const out = Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

function bollingerBands(closes, period = 20, mult = 2) {
  const mid = sma(closes, period);
  const up = Array(closes.length).fill(null);
  const dn = Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const sd = stdev(closes.slice(i - period + 1, i + 1));
    up[i] = mid[i] + mult * sd;
    dn[i] = mid[i] - mult * sd;
  }
  return { mid, up, dn };
}

function atr(bars, period = 14) {
  const tr = [0];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h, l = bars[i].l, pc = bars[i - 1].c;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return sma(tr, period);
}

// Accumulation/Distribution Line
function adLine(bars) {
  const out = [];
  let acc = 0;
  for (const b of bars) {
    const range = b.h - b.l;
    const clv = range === 0 ? 0 : ((b.c - b.l) - (b.h - b.c)) / range;
    acc += clv * b.v;
    out.push(acc);
  }
  return out;
}

// On Balance Volume
function obv(bars) {
  const out = [0];
  for (let i = 1; i < bars.length; i++) {
    const prev = out[i - 1];
    if (bars[i].c > bars[i - 1].c) out.push(prev + bars[i].v);
    else if (bars[i].c < bars[i - 1].c) out.push(prev - bars[i].v);
    else out.push(prev);
  }
  return out;
}

// Linear regression slope (for trend direction of OBV/AD)
function lrSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const xs = Array.from({ length: n }, (_, i) => i);
  const mx = mean(xs), my = mean(values);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (values[i] - my); den += (xs[i] - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}

// Find swing highs/lows (pivot points) — value at i is swing if higher/lower than k bars each side
function swings(values, k = 3) {
  const highs = [], lows = [];
  for (let i = k; i < values.length - k; i++) {
    let isH = true, isL = true;
    for (let j = 1; j <= k; j++) {
      if (values[i] <= values[i - j] || values[i] <= values[i + j]) isH = false;
      if (values[i] >= values[i - j] || values[i] >= values[i + j]) isL = false;
    }
    if (isH) highs.push({ i, v: values[i] });
    if (isL) lows.push({ i, v: values[i] });
  }
  return { highs, lows };
}

// ============================================================================
// SCORING MODULES — each returns { score: -10..+10, label, detail }
// ============================================================================

// -------- 1. Bollinger Bands Up/Down --------
function scoreBB(bars) {
  const closes = bars.map(b => b.c);
  const { mid, up, dn } = bollingerBands(closes, 20, 2);
  if (last(up) == null) return zero("BB", "insufficient data");
  const c = last(closes), u = last(up), d = last(dn), m = last(mid);
  const pctB = (c - d) / (u - d); // 0..1 typically
  const bw = (u - d) / m; // bandwidth as fraction
  // Bandwidth squeeze: compare current bw to last 100 bars
  const bws = [];
  for (let i = closes.length - 100; i < closes.length; i++)
    if (i >= 0 && up[i] != null && mid[i] != null) bws.push((up[i] - dn[i]) / mid[i]);
  const bwMin = Math.min(...bws), bwMax = Math.max(...bws);
  const bwPos = bws.length ? (bw - bwMin) / (bwMax - bwMin + 1e-9) : 0.5;

  // Score: position + trend of mid
  const midSlope = lrSlope(slice(mid.filter(x => x != null), 10));
  let s = 0;
  if (pctB > 1.0) s = 8;             // breakout above upper band
  else if (pctB > 0.8) s = 6;
  else if (pctB > 0.6) s = 3;
  else if (pctB > 0.4) s = 0;
  else if (pctB > 0.2) s = -3;
  else if (pctB > 0.0) s = -6;
  else s = -8;                        // breakdown below lower band
  // Squeeze + direction: high-impact setup
  if (bwPos < 0.2) s += midSlope > 0 ? 2 : -2;
  // Mid line trend bias
  s += midSlope > 0 ? 1 : -1;
  s = Math.max(-10, Math.min(10, s));
  const label =
    s >= 5 ? "Riding Upper Band" :
    s >= 2 ? "Above Mid (bullish)" :
    s > -2 ? "Mid-range / Squeeze" :
    s > -5 ? "Below Mid (bearish)" : "Riding Lower Band";
  return { score: s, label, detail: `%B=${pctB.toFixed(2)}, BW pctile=${(bwPos*100).toFixed(0)}%` };
}

// -------- 2. Volume Contraction Pattern (Minervini-style VCP) --------
function scoreVCP(bars) {
  if (bars.length < 60) return zero("VCP", "need 60+ bars");
  const recent = bars.slice(-60);
  const closes = recent.map(b => b.c);
  const vols = recent.map(b => b.v);
  const { highs, lows } = swings(closes, 3);
  if (highs.length < 2 || lows.length < 2) return zero("VCP", "no clear swings");

  // Build alternating contractions: latest highs and the lows after them
  const contractions = [];
  for (let i = 1; i < Math.min(highs.length, 5); i++) {
    const hi = highs[highs.length - i].v;
    const loCandidates = lows.filter(l => l.i > highs[highs.length - i].i);
    const lo = loCandidates.length ? loCandidates[0].v : null;
    if (lo) contractions.push((hi - lo) / hi * 100); // pct depth
  }
  if (contractions.length < 2) return zero("VCP", "need 2+ contractions");

  // Each contraction should be smaller than prior (tightening)
  let tightening = 0;
  for (let i = 0; i < contractions.length - 1; i++)
    if (contractions[i] < contractions[i + 1]) tightening++;

  // Volume should be drying up (compare avg vol last 10 vs prior 30)
  const v10 = mean(vols.slice(-10)), v30 = mean(vols.slice(-40, -10));
  const volDryUp = v10 < v30;
  const dryRatio = v10 / (v30 + 1e-9);

  // Proximity to 52w high (use available data as proxy if <52w)
  const allCloses = bars.map(b => b.c);
  const hi52 = Math.max(...allCloses.slice(-Math.min(252, allCloses.length)));
  const proximity = last(allCloses) / hi52; // 0..1, want >0.9

  let s = 0;
  s += tightening * 3;                          // each tightening step
  s += volDryUp ? 3 : -2;
  s += proximity > 0.95 ? 3 : proximity > 0.85 ? 1 : -1;
  s += contractions[0] < 8 ? 2 : 0;             // final pivot very tight
  s = Math.max(-10, Math.min(10, s));
  const label =
    s >= 6 ? "Tight VCP — Pivot Ready" :
    s >= 3 ? "Forming Base" :
    s > -3 ? "No Clear Pattern" :
    s > -6 ? "Loose Structure" : "Distribution Risk";
  return {
    score: s,
    label,
    detail: `${contractions.length} bases, tighten×${tightening}, vol ${dryRatio.toFixed(2)}×, ${(proximity*100).toFixed(0)}% of high`,
  };
}

// -------- 3. Smart Money Entry/Exit (A/D + OBV + Volume Surges) --------
function scoreSmartMoney(bars) {
  if (bars.length < 40) return zero("SmartMoney", "need 40+ bars");
  const closes = bars.map(b => b.c);
  const ad = adLine(bars);
  const ob = obv(bars);
  // Slopes over last 20 bars
  const adSlope = lrSlope(slice(ad, 20));
  const obSlope = lrSlope(slice(ob, 20));
  const pxSlope = lrSlope(slice(closes, 20));

  // Detect divergence: price down but AD/OBV up = accumulation; opposite = distribution
  const accumulation = pxSlope <= 0 && (adSlope > 0 || obSlope > 0);
  const distribution = pxSlope >= 0 && (adSlope < 0 || obSlope < 0);

  // Volume thrust days last 10: green close vs red close, volume vs 20-avg
  const v20 = mean(bars.slice(-30, -10).map(b => b.v));
  let greenThrust = 0, redThrust = 0;
  for (const b of bars.slice(-10)) {
    if (b.v > v20 * 1.5) {
      if (b.c > b.o) greenThrust++;
      else if (b.c < b.o) redThrust++;
    }
  }

  let s = 0;
  if (accumulation) s += 5;
  if (distribution) s -= 5;
  s += (greenThrust - redThrust) * 1.5;
  if (adSlope > 0 && obSlope > 0 && pxSlope > 0) s += 2;
  if (adSlope < 0 && obSlope < 0 && pxSlope < 0) s -= 2;
  s = Math.max(-10, Math.min(10, s));

  const label =
    s >= 6 ? "Strong Accumulation" :
    s >= 2 ? "Smart Money Buying" :
    s > -2 ? "Neutral Flow" :
    s > -6 ? "Smart Money Selling" : "Heavy Distribution";
  return {
    score: s, label,
    detail: `Green×${greenThrust} / Red×${redThrust}, OBV ${obSlope > 0 ? "↑" : "↓"}, A/D ${adSlope > 0 ? "↑" : "↓"}`,
  };
}

// -------- 4. Monthly Camarilla Levels & Pivot --------
function scoreCamarilla(bars) {
  if (bars.length < 25) return zero("Camarilla", "need 25+ bars");
  // Use previous calendar month's H, L, C
  const now = bars[bars.length - 1].t;
  const curYM = now.getFullYear() * 12 + now.getMonth();
  const prevMonthBars = bars.filter(b => {
    const ym = b.t.getFullYear() * 12 + b.t.getMonth();
    return ym === curYM - 1;
  });
  if (prevMonthBars.length < 5) return zero("Camarilla", "no prior month data");
  const H = Math.max(...prevMonthBars.map(b => b.h));
  const L = Math.min(...prevMonthBars.map(b => b.l));
  const C = prevMonthBars[prevMonthBars.length - 1].c;
  const R = H - L;
  const piv = (H + L + C) / 3;
  const levels = {
    H6: C + R * 1.1 * 1.5,    // explosive breakout
    H4: C + R * 1.1 / 2,      // breakout
    H3: C + R * 1.1 / 4,      // resistance
    H2: C + R * 1.1 / 6,
    H1: C + R * 1.1 / 12,
    P:  piv,
    L1: C - R * 1.1 / 12,
    L2: C - R * 1.1 / 6,
    L3: C - R * 1.1 / 4,      // support
    L4: C - R * 1.1 / 2,      // breakdown
    L6: C - R * 1.1 * 1.5,
  };
  const cur = last(bars).c;

  let s = 0, label;
  if (cur > levels.H4) { s = 8;  label = "Above H4 — Breakout"; }
  else if (cur > levels.H3) { s = 5; label = "Above H3 — Bullish"; }
  else if (cur > levels.P)  { s = 2; label = "Above Pivot"; }
  else if (cur > levels.L3) { s = -2; label = "Below Pivot"; }
  else if (cur > levels.L4) { s = -5; label = "Below L3 — Bearish"; }
  else { s = -8; label = "Below L4 — Breakdown"; }

  // Distance to next level (for trade planning)
  const detail =
    `P=${piv.toFixed(1)}, H3=${levels.H3.toFixed(1)}, L3=${levels.L3.toFixed(1)}`;
  return { score: s, label, detail, levels };
}

// -------- 5. Bull Trap & Bear Trap detection --------
function scoreTraps(bars) {
  if (bars.length < 30) return zero("Traps", "need 30+ bars");
  const recent = bars.slice(-30);
  const closes = recent.map(b => b.c);
  const highs = recent.map(b => b.h);
  const lows = recent.map(b => b.l);
  // Identify recent significant resistance (max of bars [-30..-5]) and support
  const resistance = Math.max(...highs.slice(0, -3));
  const support = Math.min(...lows.slice(0, -3));
  const lastBars = recent.slice(-3);
  const cur = last(closes);

  let bullTrap = 0, bearTrap = 0;
  // Bull trap: any of last 3 bars broke resistance but current closed back below
  for (const b of lastBars) {
    if (b.h > resistance && cur < resistance) bullTrap++;
  }
  // Bear trap: broke support but closed back above
  for (const b of lastBars) {
    if (b.l < support && cur > support) bearTrap++;
  }

  let s = 0, label = "No Trap";
  if (bullTrap > 0) { s = -7; label = "Bull Trap Detected"; }
  else if (bearTrap > 0) { s = 7; label = "Bear Trap (Reversal Up)"; }
  // Mild: testing the level (price within 1% of resistance/support with rejection wick)
  else {
    const lb = last(recent);
    const upperWick = lb.h - Math.max(lb.o, lb.c);
    const lowerWick = Math.min(lb.o, lb.c) - lb.l;
    const body = Math.abs(lb.c - lb.o);
    if (lb.h > resistance * 0.99 && upperWick > body * 1.5) { s = -3; label = "Resistance Rejection"; }
    else if (lb.l < support * 1.01 && lowerWick > body * 1.5) { s = 3; label = "Support Bounce"; }
  }
  return {
    score: s, label,
    detail: `R=${resistance.toFixed(1)}, S=${support.toFixed(1)}`,
  };
}

// -------- 6. CRT (Candle Range Theory) + TBS (Turtle Soup) --------
// Liquidity sweep + reversal: ICT-style logic
function scoreCRT_TBS(bars) {
  if (bars.length < 10) return zero("CRT", "need 10+ bars");
  const r = bars.slice(-5);
  const [b3, b2, b1, b0] = [r[r.length - 4], r[r.length - 3], r[r.length - 2], r[r.length - 1]];

  let s = 0, label = "No CRT/TBS";
  // CRT bullish: prev bar swept low of bar before, current closes back above that low
  if (b1.l < Math.min(b2.l, b3.l) && b0.c > Math.min(b2.l, b3.l)) {
    s = 6;
    label = "CRT Bullish Sweep";
  }
  // CRT bearish: prev bar swept high, current closes back below
  if (b1.h > Math.max(b2.h, b3.h) && b0.c < Math.max(b2.h, b3.h)) {
    s = -6;
    label = "CRT Bearish Sweep";
  }
  // TBS: last 20 days low taken out then reversal
  const last20 = bars.slice(-22, -2);
  if (last20.length > 0) {
    const lo20 = Math.min(...last20.map(b => b.l));
    const hi20 = Math.max(...last20.map(b => b.h));
    if (b0.l < lo20 && b0.c > lo20) { s = Math.max(s, 7); label = "TBS — 20D Low Sweep Reversal"; }
    if (b0.h > hi20 && b0.c < hi20) { s = Math.min(s, -7); label = "TBS — 20D High Sweep Reversal"; }
  }
  return { score: s, label, detail: "Liquidity sweep + close-back logic" };
}

// -------- 7. Breakout / Breakdown Potential --------
function scoreBreakout(bars) {
  if (bars.length < 40) return zero("Breakout", "need 40+ bars");
  // Consolidation: range of last 20 bars
  const last20 = bars.slice(-20);
  const hi = Math.max(...last20.map(b => b.h));
  const lo = Math.min(...last20.map(b => b.l));
  const cur = last(bars).c;
  const rangePct = (hi - lo) / lo * 100;
  const distToHi = (hi - cur) / cur * 100;
  const distToLo = (cur - lo) / cur * 100;

  // Tight range + price near edge = breakout/breakdown setup
  let s = 0, label = "No Setup";
  const tight = rangePct < 8;
  if (tight && distToHi < 1.0) { s = 7; label = "Imminent Breakout Setup"; }
  else if (tight && distToLo < 1.0) { s = -7; label = "Imminent Breakdown Setup"; }
  else if (cur > hi * 0.999) { s = 8; label = "Breakout in Progress"; }
  else if (cur < lo * 1.001) { s = -8; label = "Breakdown in Progress"; }
  else if (distToHi < 2)  { s = 4; label = "Approaching Resistance"; }
  else if (distToLo < 2)  { s = -4; label = "Approaching Support"; }
  else { s = 0; label = "Mid-Range"; }
  return { score: s, label, detail: `Range ${rangePct.toFixed(1)}%, ${distToHi.toFixed(1)}% to H, ${distToLo.toFixed(1)}% to L` };
}

// -------- 8. RSI Divergence --------
function scoreRSIDiv(bars) {
  if (bars.length < 30) return zero("RSI Div", "need 30+ bars");
  const closes = bars.map(b => b.c);
  const r = rsi(closes, 14);
  const win = 30;
  const pxWin = closes.slice(-win);
  const rsWin = r.slice(-win).map(x => x ?? 50);

  const pxSwings = swings(pxWin, 3);
  const rsSwings = swings(rsWin, 3);

  let s = 0, label = "No Divergence";
  // Bullish: price lower low, RSI higher low
  if (pxSwings.lows.length >= 2 && rsSwings.lows.length >= 2) {
    const p = pxSwings.lows.slice(-2);
    const x = rsSwings.lows.slice(-2);
    if (p[1].v < p[0].v && x[1].v > x[0].v) { s = 7; label = "Bullish RSI Divergence"; }
  }
  // Bearish: price higher high, RSI lower high
  if (pxSwings.highs.length >= 2 && rsSwings.highs.length >= 2) {
    const p = pxSwings.highs.slice(-2);
    const x = rsSwings.highs.slice(-2);
    if (p[1].v > p[0].v && x[1].v < x[0].v) { s = -7; label = "Bearish RSI Divergence"; }
  }
  // Overbought / oversold context
  const curR = last(r);
  let detail = `RSI=${curR ? curR.toFixed(1) : "—"}`;
  if (curR > 70) { detail += " (OB)"; if (s === 0) s = -2; }
  else if (curR < 30) { detail += " (OS)"; if (s === 0) s = 2; }
  return { score: s, label, detail };
}

// -------- 9. EMA Trend Stack (Bonus indicator from quant research) --------
function scoreEMAStack(bars) {
  if (bars.length < 200) {
    // Fallback to shorter EMAs if we don't have 200 bars
    const closes = bars.map(b => b.c);
    const e20 = ema(closes, 20), e50 = ema(closes, 50);
    if (last(e20) == null || last(e50) == null) return zero("EMA", "need data");
    const c = last(closes);
    let s = 0;
    if (c > last(e20) && last(e20) > last(e50)) s = 6;
    else if (c > last(e20)) s = 3;
    else if (c < last(e20) && last(e20) < last(e50)) s = -6;
    else if (c < last(e20)) s = -3;
    return { score: s, label: "EMA Trend", detail: "20/50 stack (no 200)" };
  }
  const closes = bars.map(b => b.c);
  const e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200);
  const c = last(closes);
  let s = 0, label;
  if (c > last(e20) && last(e20) > last(e50) && last(e50) > last(e200)) {
    s = 8; label = "Bullish Stack (20>50>200)";
  } else if (c < last(e20) && last(e20) < last(e50) && last(e50) < last(e200)) {
    s = -8; label = "Bearish Stack";
  } else if (c > last(e200)) { s = 3; label = "Above 200 EMA"; }
  else { s = -3; label = "Below 200 EMA"; }
  return { score: s, label, detail: `20=${last(e20).toFixed(1)} 50=${last(e50).toFixed(1)} 200=${last(e200).toFixed(1)}` };
}

function zero(name, why) { return { score: 0, label: `${name} — ${why}`, detail: why }; }

// ============================================================================
// COMPOSITE SCORE & VERDICT
// ============================================================================
// Indicator weights (tuned for Indian F&O swing/positional setups)
const WEIGHTS = {
  bb:         1.0,
  vcp:        1.5,   // setup-quality is high-signal
  smartMoney: 1.5,   // institutional flow is critical in NSE F&O
  camarilla:  1.0,
  traps:      1.2,   // F&O is full of fake-outs — important
  crtTbs:     1.0,
  breakout:   1.3,
  rsiDiv:     1.0,
  emaStack:   1.0,
};

function compositeScore(scores) {
  let num = 0, den = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    if (scores[k] && typeof scores[k].score === "number") {
      num += scores[k].score * w;
      den += w * 10;       // max possible
    }
  }
  // Normalize to -100..+100
  const composite = den > 0 ? (num / den) * 100 : 0;
  return composite;
}

function verdict(score) {
  if (score >= 50)  return { tag: "STRONG BUY",   cls: "verdict-sb" };
  if (score >= 20)  return { tag: "BUY",          cls: "verdict-b"  };
  if (score >= -20) return { tag: "NEUTRAL",      cls: "verdict-n"  };
  if (score >= -50) return { tag: "SELL",         cls: "verdict-s"  };
  return              { tag: "STRONG SELL",  cls: "verdict-ss" };
}

// ============================================================================
// MAIN ANALYZER — called per stock
// ============================================================================
async function analyzeStock(symbol) {
  const bars = await fetchYahooEOD(symbol, "1y", "1d");
  if (!bars || bars.length < 30) throw new Error("Not enough data");
  const closes = bars.map(b => b.c);
  const lastBar = last(bars);
  const prevClose = bars[bars.length - 2]?.c ?? lastBar.c;
  const change = lastBar.c - prevClose;
  const changePct = (change / prevClose) * 100;
  // ATR for stop-loss suggestion
  const atr14 = atr(bars, 14);

  const scores = {
    bb:         scoreBB(bars),
    vcp:        scoreVCP(bars),
    smartMoney: scoreSmartMoney(bars),
    camarilla:  scoreCamarilla(bars),
    traps:      scoreTraps(bars),
    crtTbs:     scoreCRT_TBS(bars),
    breakout:   scoreBreakout(bars),
    rsiDiv:     scoreRSIDiv(bars),
    emaStack:   scoreEMAStack(bars),
  };

  const composite = compositeScore(scores);
  const v = verdict(composite);

  // Trade plan (rough): stop = 1.5 ATR away, target = 3 ATR
  const a = last(atr14) || lastBar.c * 0.02;
  const trade = composite > 0
    ? { side: "LONG",  entry: lastBar.c, sl: lastBar.c - 1.5 * a, t1: lastBar.c + 2 * a, t2: lastBar.c + 4 * a }
    : { side: "SHORT", entry: lastBar.c, sl: lastBar.c + 1.5 * a, t1: lastBar.c - 2 * a, t2: lastBar.c - 4 * a };

  return {
    symbol,
    price: lastBar.c,
    change, changePct,
    volume: lastBar.v,
    bars, scores,
    composite, verdict: v,
    atr: a, trade,
    asOf: lastBar.t,
  };
}

// Expose globally
window.FNOEngine = {
  fetchYahooEOD, analyzeStock,
  // expose for unit-style tests in dev
  _ind: { sma, ema, rsi, bollingerBands, atr, adLine, obv, lrSlope, swings },
  WEIGHTS, verdict, compositeScore,
};
