# 📈 NSE F&O Quant Scanner

A **multi-factor, multi-timeframe scoring engine** for Indian derivatives (NSE F&O segment) that runs entirely in your browser. Pulls OHLCV data from Yahoo Finance on three timeframes — **1 Hour, Daily (EOD), and Weekly** — computes 9 technical indicators per stock, and ranks ~200 F&O stocks with a composite **STRONG BUY / BUY / NEUTRAL / SELL / STRONG SELL** verdict.

**Live demo:** Deploy to GitHub Pages in 5 minutes (see below).

---

## 🕐 Multi-Timeframe Support

Toggle between three timeframes at the top — all 9 indicators recompute on the selected bars:

| Timeframe | Bars Used        | Camarilla Pivot Source     | Best For                          |
|-----------|------------------|----------------------------|-----------------------------------|
| **1H**    | Last 60 days, hourly close | Previous trading day | Intraday F&O, BTST, short-term scalps |
| **1D**    | Last 1 year, EOD daily      | Previous calendar month | Swing trading (3–15 days)             |
| **1W**    | Last 5 years, weekly close  | Previous quarter        | Positional trades (weeks–months)      |

---

## ✨ Features

The scanner scores each F&O stock on **9 independent factors**, then combines them into a normalized −100 to +100 composite score:

| # | Indicator                  | What it catches                                                         |
|---|----------------------------|-------------------------------------------------------------------------|
| 1 | **Bollinger Bands**        | %B position + bandwidth squeeze percentile + mid-line trend             |
| 2 | **Volume Contraction (VCP)** | Minervini-style tightening bases with drying volume near 52w high      |
| 3 | **Smart Money Flow**       | A/D Line + OBV slope + high-vol green/red day asymmetry (accumulation) |
| 4 | **Camarilla Levels**       | H1–H4 / L1–L4 / Pivot from prior period (day/month/quarter per TF)      |
| 5 | **Bull / Bear Trap**       | False breakouts (high taken out but closed back below)                 |
| 6 | **CRT + TBS**              | ICT-style liquidity sweeps + Turtle Soup 20-bar reversals              |
| 7 | **Breakout / Breakdown**   | 20-bar range tightness + distance to edge                              |
| 8 | **RSI Divergence**         | Price vs RSI(14) swing comparison + OB/OS context                      |
| 9 | **EMA Trend Stack**        | 20 > 50 > 200 bullish stack (bonus trend-confirmation filter)          |

**Additional features:**
- 🕐 **Multi-timeframe**: 1H / 1D / 1W toggle (all indicators recompute)
- ⚡ Parallel scanning — full F&O universe in ~60–120 seconds
- 🔍 Filter by verdict, sector, score range, or symbol search
- 🖱 **Click any stat card** (Strong Buy / Buy / Sell / Strong Sell) to filter by that verdict
- ↕ Sortable columns
- 📊 Inline 30-bar sparkline per stock
- 🔎 Click any row → full indicator breakdown + Camarilla levels + suggested trade plan (entry / SL / targets / ATR)
- 📥 Export results to CSV
- 🎯 Suggested stop-loss & targets based on ATR(14)

---

## 🚀 Deploy to GitHub Pages (5 minutes)

### Option A: Web UI (no terminal needed)

1. Go to **github.com** → click **+** → **New repository**
2. Name it (e.g., `nse-fno-scanner`) → set **Public** → **Create**
3. Click **uploading an existing file**
4. Drag all the files from this folder (`index.html`, `app.js`, `engine.js`, `stocks.js`, `styles.css`, `README.md`)
5. **Commit changes**
6. Go to **Settings** → **Pages** (left sidebar)
7. Under **Source**, pick **Deploy from a branch** → Branch: `main` → Folder: `/ (root)` → **Save**
8. Wait ~30 seconds. Your site will be live at:
   ```
   https://YOUR-USERNAME.github.io/nse-fno-scanner/
   ```

### Option B: Git CLI

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/nse-fno-scanner.git
git push -u origin main
```
Then enable Pages in Settings as above.

---

## 🖥 Local Testing

Because the scanner uses CORS proxies to call Yahoo Finance, simply open `index.html` directly OR run any static server:

```bash
# Python (any version)
python -m http.server 8000

# Node
npx serve

# Or just double-click index.html
```

Then open http://localhost:8000

---

## 📊 How the Composite Score Works

Each indicator outputs a score from **−10 (most bearish) to +10 (most bullish)**. These are combined with these weights (tuned for Indian F&O swing setups):

| Indicator    | Weight |
|--------------|--------|
| VCP          | 1.5    |
| Smart Money  | 1.5    |
| Breakout     | 1.3    |
| Traps        | 1.2    |
| BB           | 1.0    |
| Camarilla    | 1.0    |
| CRT/TBS      | 1.0    |
| RSI Div      | 1.0    |
| EMA Stack    | 1.0    |

The weighted sum is normalized to **−100…+100**:

| Score       | Verdict      |
|-------------|--------------|
| ≥ +50       | STRONG BUY   |
| +20 to +49  | BUY          |
| −19 to +19  | NEUTRAL      |
| −20 to −49  | SELL         |
| ≤ −50       | STRONG SELL  |

You can tune weights in `engine.js` → `WEIGHTS` object.

---

## 🛠 Customization

**Add/remove stocks:** Edit the `FNO_STOCKS` array in `stocks.js`. The list is updated periodically by NSE — check the [official F&O list](https://www.nseindia.com/products-services/equity-derivatives-list-underlyings) and sync as needed.

**Tweak indicator logic:** Each scoring function lives in `engine.js` as `scoreBB`, `scoreVCP`, etc. They take an array of OHLCV bars and return `{ score, label, detail }`.

**Adjust scan concurrency:** In `app.js`, the `runWithConcurrency(..., 6, ...)` call sets parallel fetches. Increase to 10 for speed, decrease to 3 if you hit rate limits.

**Change time frame:** In `engine.js`, `fetchYahooEOD(symbol, "1y", "1d")` — change `"1y"` to `"6mo"`, `"2y"`, etc.

---

## ⚠️ Important Notes

1. **Yahoo Finance is unofficial.** They occasionally rate-limit or change endpoints. The scanner falls back through 3 CORS proxies — if all fail for a stock, it's silently skipped.
2. **EOD data only.** No intraday. Best used for swing/positional trading, not scalping.
3. **F&O list drifts.** SEBI/NSE adds/removes stocks from the derivatives segment periodically. Check and update `stocks.js` quarterly.
4. **This is technical analysis only.** It doesn't know about:
   - Open Interest, FII/DII flows, options skew
   - Earnings, corporate actions, news
   - Macro events, RBI policy, global cues
   - Fundamental valuation
   
   Use it as **one input** to your decision — not the only input.

5. **Not investment advice.** Algorithms can and do fail. Backtest before risking capital. Position-size for the worst case. Never trade more than you can afford to lose.

---

## 🧪 Methodology Sources

The scoring methods are based on widely-used setups:

- **VCP**: Mark Minervini — *Trade Like a Stock Market Wizard*
- **Camarilla Equation**: Nick Stott / classical floor-trader pivots
- **Smart Money (A/D + OBV)**: Marc Chaikin / Joseph Granville
- **CRT / Liquidity Sweeps**: ICT (Inner Circle Trader) concepts
- **Turtle Soup**: Linda Bradford Raschke — *Street Smarts*
- **RSI Divergence**: Cardwell, Andrew Cardwell's RSI work
- **Bull/Bear Traps**: Classic price-action reversal pattern (Wyckoff)

---

## 📝 License

MIT — fork it, improve it, ship it.

---

## 🤝 Contributing

PRs welcome! Particularly:
- Add **Open Interest** data (if NSE bhavcopy can be fetched browser-side)
- **Sector rotation heat-map**
- **Backtest mode** — replay historical scans
- **Mobile-optimized** view
- More indicators (Supertrend, Heikin-Ashi trend, McGinley Dynamic, etc.)

---

Built for Indian retail F&O traders who think in scores, not gut-feel.  
**Trade smart. Risk-manage. Compound. 📊**
