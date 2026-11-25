"""Order-flow numbers for any chart symbol: one engine for the TradeX, agents and scripts.

Step 1 (2026-11-12): delta per candle with its intrabar high and low (TradingView's Volume Delta / CVD candle rules).

Two sources, chosen per symbol (2026-11-12):
  real       Binance USD-M futures 1-minute klines. Field 9 = taker buy volume = buyers who crossed the spread.
             Exchange truth, not a guess. Only for symbols Binance futures lists (crypto, gold, silver, platinum,
             palladium, copper, natural gas). Units: the coin or ounces.
  estimated  The chart's own candles at a lower timeframe. A lower bar that closes above its open counts as buying,
             below as selling; a flat bar copies the previous close direction (TradingView's default method).
             Units: the feed's volume (MT5 = tick count, not lots).

Use from Python (agents):
    import orderflow_api as ofa
    rows = ofa.delta("RMT_XAUUSD", "M5", start_s, end_s, source="auto", history=<fn>)   # history only for estimated
or over HTTP while the hub server runs:  GET http://localhost:8770/api/orderflow/delta?symbol=RMT_XAUUSD&tf=M5&from=<s>&to=<s>&source=auto
Each row: t (bar open, UTC seconds), buy, sell, delta, hi, lo (running delta extremes inside the bar, 0 = bar open), n (lower bars used).
"""
import json, threading, time, urllib.request

TF_SEC = {"M1": 60, "M3": 180, "M5": 300, "M15": 900, "M30": 1800, "H1": 3600, "H4": 14400, "D1": 86400}
# Lower timeframe used inside each chart bar (like TradingView's automatic intrabar timeframe).
INTRABAR = {"M1": "M1", "M3": "M1", "M5": "M1", "M15": "M1", "M30": "M5", "H1": "M5", "H4": "M15", "D1": "H1"}
BINANCE_TF = {"M1": "1m", "M3": "3m", "M5": "5m", "M15": "15m", "M30": "30m", "H1": "1h", "H4": "4h", "D1": "1d"}
MAX_ROWS = 20000                      # lower bars per request; older chart bars beyond this get no delta
FAPI = "https://fapi.binance.com/fapi/v1"
RENAME = {"XCU": "COPPER", "XNG": "NATGAS"}  # MT5 name -> Binance futures base

_futures = {"set": set(), "at": 0.0}
_cache = {}          # (source, symbol, itf) -> {t: (buy, sell, close_sign)}
_lock = threading.Lock()


def futures_symbols():
    """Binance USD-M futures symbols that are trading (refreshed every 6 h)."""
    if time.time() - _futures["at"] > 6 * 3600:
        try:
            d = json.loads(urllib.request.urlopen(FAPI + "/exchangeInfo", timeout=20).read())
            _futures["set"] = {s["symbol"] for s in d["symbols"] if s.get("status") == "TRADING"}
            _futures["at"] = time.time()
        except Exception:
            _futures["at"] = time.time() - 6 * 3600 + 300  # retry in 5 min
    return _futures["set"]


def real_symbol(ticker):
    """Chart ticker -> Binance futures symbol with real buyer/seller data, or None.
    RMT_XAUUSD -> XAUUSDT, RMT_BTCUSD -> BTCUSDT, BYBIT_BTCUSDT -> BTCUSDT, BTCUSD (binance feed) -> BTCUSDT."""
    t = ticker.upper().split(":")[-1]
    # Deriv names: frxXAUUSD (forex/metals), cryETHUSD (crypto). Same Binance market as the other feeds; the price
    # shift lines Binance up with Deriv's own price (2026-11-15: cryETHUSD was missed and showed an all-zero estimate).
    for p in ("RMT_", "BYBIT_S_", "BYBIT_I_", "BYBIT_", "FRX", "CRY"):
        if t.startswith(p):
            t = t[len(p):]
            break
    if t.endswith((".MARK", ".INDEX")):
        return None
    if t.endswith("USD247"):
        t = t[:-3]
    if t.endswith("USDT"):
        base = t[:-4]
    elif t.endswith("USD"):
        base = t[:-3]
    else:
        return None
    base = RENAME.get(base, base)
    s = base + "USDT"
    return s if s in futures_symbols() else None


def _binance_rows(sym, itf, a, b):
    """Lower bars [a, b] (seconds) from Binance futures: {t: (buy, sell, sign, high, low, close)}."""
    out, start, step = {}, a * 1000, TF_SEC[itf] * 1000
    while start <= b * 1000:
        url = f"{FAPI}/klines?symbol={sym}&interval={BINANCE_TF[itf]}&startTime={start}&endTime={b * 1000}&limit=1500"
        rows = _ot.WEIGHT.get(url, 10)
        if not rows:
            break
        for k in rows:
            vol, tb = float(k[5]), float(k[9])
            out[k[0] // 1000] = (tb, vol - tb, 0, float(k[2]), float(k[3]), float(k[4]))
        start = rows[-1][0] + step
        if len(rows) < 1500:
            break
    return out


def _estimated_rows(history, ticker, itf, a, b):
    """Lower bars [a, b] from the chart's own feed, signed by candle direction: {t: (buy, sell, sign, high, low, close)}."""
    bars, to_ms = [], (b + TF_SEC[itf]) * 1000
    # Ask only for the bars needed (+1 before, for the direction of a flat first bar). A live refresh needs 2-3 bars;
    # asking 5000 every few seconds loaded the remote MT5 bridge and its link timed out (2026-11-12).
    need = int((b - a) // TF_SEC[itf]) + 3
    while True:
        chunk = history(ticker, itf, max(3, min(5000, need - len(bars))), to_ms)
        if not chunk:
            break
        bars = chunk + bars
        if chunk[0]["time"] <= a or len(chunk) < 50:
            break
        to_ms = (chunk[0]["time"] - TF_SEC[itf]) * 1000
        if len(bars) > MAX_ROWS:
            break
    seen, out, prev_close, sign = set(), {}, None, 0
    for x in sorted(bars, key=lambda x: x["time"]):
        if x["time"] in seen:
            continue
        seen.add(x["time"])
        o, c, v = x["open"], x["close"], float(x.get("volume") or 0)
        if c > o: sign = 1
        elif c < o: sign = -1
        elif prev_close is not None and c != prev_close: sign = 1 if c > prev_close else -1
        prev_close = c
        if a <= x["time"] <= b:
            buy, sell = (v, 0.0) if sign > 0 else (0.0, v) if sign < 0 else (0.0, 0.0)
            out[x["time"]] = (buy, sell, sign, x["high"], x["low"], c)
    return out


def _rows(source, ticker, itf, a, b, history):
    """Cached lower bars. Closed lower bars are kept; the last one is always re-read (it may still be forming)."""
    key = (source, ticker, itf)
    with _lock:
        have = _cache.setdefault(key, {})
        ts = sorted(have)
    sec = TF_SEC[itf]
    need = []
    if not ts or a < ts[0]:
        need.append((a, (ts[0] - sec) if ts and ts[0] - sec < b else b))
    if ts and b > ts[-1] - sec:
        need.append((max(a, ts[-1]), b))
    for lo, hi in need:
        if hi < lo:
            continue
        sym = real_symbol(ticker) if source == "real" else None
        got = _binance_rows(sym, itf, lo, hi) if source == "real" else _estimated_rows(history, ticker, itf, lo, hi)
        with _lock:
            have.update(got)
    with _lock:
        return {t: v for t, v in have.items() if a <= t <= b}


def _need_volume(rows):
    """An estimate is built from the feed's own volume; a feed with none (Deriv) would draw zeros everywhere."""
    if rows and not any(v[0] or v[1] for v in rows.values()):
        raise ValueError("this feed sends no volume and has no Binance match, so there is no order flow to show")
    return rows


def _shift(lower, chart, sec, isec):
    """Gap (chart price - Binance price) for every lower bar: median of the last 30 chart candles that had closed
    by then (past only). chart: the chart's own candles at the chart timeframe. Bars before the first known gap use it."""
    import bisect
    pts = []
    for t in sorted(chart):
        k = t + sec - isec                  # the lower bar that closes this chart candle
        if k in lower:
            pts.append((k, chart[t][5] - lower[k][5]))
    if not pts:
        return {t: 0.0 for t in lower}
    keys, meds, win = [p[0] for p in pts], [], []
    for _, g in pts:
        win.append(g); win = win[-30:]; meds.append(sorted(win)[len(win) // 2])
    out = {}
    for t in lower:
        i = bisect.bisect_right(keys, t) - 1
        out[t] = meds[max(i, 0)]
    return out


def pick_source(ticker, source="auto"):
    if source == "real":
        return "real" if real_symbol(ticker) else None
    if source == "estimated":
        return "estimated"
    return "real" if real_symbol(ticker) else "estimated"


def delta(ticker, tf, start_s, end_s, source="auto", history=None):
    """Delta per chart bar between start_s and end_s (bar open times, UTC seconds). Returns (rows, info)."""
    src = pick_source(ticker, source)
    if src is None:
        raise ValueError(f"no real buyer/seller data for {ticker}")
    if src == "estimated" and history is None:
        raise ValueError("estimated source needs the chart feed's history function")
    sec, itf = TF_SEC[tf], INTRABAR[tf]
    isec = TF_SEC[itf]
    start_s = max(int(start_s), int(end_s) - MAX_ROWS * isec)  # keep the newest bars when the range is too long
    if start_s % sec and tf != "D1":
        start_s += sec - start_s % sec  # whole bars only: a half-read first bar would show a wrong delta
    lower = _rows(src, ticker, itf, start_s, int(end_s) + sec - isec, history)
    if src == "estimated":
        _need_volume(lower)
    out, cur = [], None
    for t in sorted(lower):
        bt = t - t % sec if tf != "D1" else t - t % 86400
        buy, sell = lower[t][0], lower[t][1]
        if cur is None or cur["t"] != bt:
            cur = {"t": bt, "buy": 0.0, "sell": 0.0, "delta": 0.0, "hi": 0.0, "lo": 0.0, "n": 0}
            out.append(cur)
        cur["buy"] += buy
        cur["sell"] += sell
        cur["delta"] += buy - sell
        cur["hi"], cur["lo"], cur["n"] = max(cur["hi"], cur["delta"]), min(cur["lo"], cur["delta"]), cur["n"] + 1
    for r in out:
        for k in ("buy", "sell", "delta", "hi", "lo"):
            r[k] = round(r[k], 6)
    unit = "base volume (coin / oz)" if src == "real" else "feed volume (MT5 = ticks)"
    info = {"source": src, "real_symbol": real_symbol(ticker), "intrabar": itf, "unit": unit,
            "method": "Binance taker buy volume" if src == "real" else "lower-bar direction (TradingView default)"}
    return out, info


# ---------------- Step 2: session volume profile (2026-11-12) ----------------
# Sessions in UTC, cut so they never overlap (gold/forex day rolls over at 22:00 UTC):
#   Asia 22:00-07:00, London 07:00-13:00, New York 13:00-22:00.  "day" = one profile per UTC day.
SESSIONS = (("Asia", 22, 7), ("London", 7, 13), ("New York", 13, 22))


def session_of(t, mode="sessions"):
    """(session start in UTC seconds, name) for a time in UTC seconds."""
    day = t - t % 86400
    if mode == "day":
        return day, "Day"
    if mode == "week":  # weeks start Monday 00:00 UTC (1970-01-01 was a Thursday)
        return day - ((day // 86400 + 3) % 7) * 86400, "Week"
    h = (t % 86400) // 3600
    if h >= 22:
        return day + 22 * 3600, "Asia"
    if h < 7:
        return day - 2 * 3600, "Asia"
    if h < 13:
        return day + 7 * 3600, "London"
    return day + 13 * 3600, "New York"


def _value_area(tot, poc, pct):
    """Value area: start at the POC row, add the bigger neighbour row until pct of the volume is inside."""
    total, lo, hi = sum(tot), poc, poc
    inside = tot[poc]
    while total and inside < pct * total and (lo > 0 or hi < len(tot) - 1):
        up = tot[hi + 1] if hi < len(tot) - 1 else -1
        dn = tot[lo - 1] if lo > 0 else -1
        if up >= dn:
            hi += 1; inside += up
        else:
            lo -= 1; inside += dn
    return lo, hi


def _histogram(bars, n_rows, row_size):
    """Spread each lower bar's buy and sell volume evenly over the rows its high-low range covers
    (TradingView's way for profiles built from bars). bars: [(buy, sell, high, low)]."""
    lo = min(b[3] for b in bars); hi = max(b[2] for b in bars)
    step = row_size if row_size > 0 else max((hi - lo) / n_rows, 1e-12)
    if row_size > 0:
        lo = lo - lo % step
    n = max(1, int((hi - lo) / step) + 1) if row_size > 0 else n_rows
    buy, sell = [0.0] * n, [0.0] * n
    for b_, s_, h, l in bars:
        i0 = min(n - 1, max(0, int((l - lo) / step))); i1 = min(n - 1, max(0, int((h - lo) / step)))
        if i1 == i0 or h <= l:
            buy[i0] += b_; sell[i0] += s_; continue
        for i in range(i0, i1 + 1):
            r_lo, r_hi = lo + i * step, lo + (i + 1) * step
            w = (min(h, r_hi) - max(l, r_lo)) / (h - l)
            if w > 0:
                buy[i] += b_ * w; sell[i] += s_ * w
    return lo, step, buy, sell


def _levels(lo, step, buy, sell, va_pct):
    tot = [x + y for x, y in zip(buy, sell)]
    poc = max(range(len(tot)), key=tot.__getitem__)
    a, b = _value_area(tot, poc, va_pct)
    return poc, lo + (poc + 0.5) * step, lo + (b + 1) * step, lo + a * step  # index, poc price, vah, val


def profile(ticker, tf, start_s, end_s, source="auto", history=None, mode="sessions", rows=24, row_size=0.0,
            va_pct=0.70, developing=True):
    """Volume profile per session between start_s and end_s, drawn on the CHART's prices.
    Real data (Binance) is shifted onto the chart's price minute by minute: shift = chart close - Binance close
    (median of the last 30 lower bars, past only), so the profile sits where price really traded on this chart."""
    src = pick_source(ticker, source)
    if src is None:
        raise ValueError(f"no real buyer/seller data for {ticker}")
    # A session must hold several candles: on H4 sessions become days, on D1 days become weeks.
    if tf == "H4" and mode == "sessions":
        mode = "day"
    elif tf == "D1" and mode in ("sessions", "day"):
        mode = "week"
    if history is None:
        raise ValueError("profile needs the chart feed's history function (for the chart's own prices)")
    sec, itf = TF_SEC[tf], INTRABAR[tf]
    isec = TF_SEC[itf]
    start_s = max(int(start_s), int(end_s) - MAX_ROWS * isec)
    s0 = session_of(start_s, mode)[0]
    if s0 < start_s:  # whole sessions only: a half-read first session would show a wrong profile
        t = start_s - start_s % 3600
        while session_of(t, mode)[0] == s0:
            t += 3600
        start_s = t
    end_i = int(end_s) + sec - isec
    shift_note = None
    if src == "estimated":
        lower = _need_volume(_rows("estimated", ticker, itf, start_s, end_i, history))
    else:
        # The chart's own candles (chart timeframe: one short request) only line Binance prices up with the broker.
        # Asking the feed for 20,000 one-minute candles took ~25 s over the remote MT5 link (2026-11-15).
        lower = _rows("real", ticker, itf, start_s, end_i, history)
        g_at = _shift(lower, _rows("estimated", ticker, tf, start_s - 30 * sec, int(end_s), history), sec, isec)
        lower = {t: (v[0], v[1], v[2], v[3] + g_at[t], v[4] + g_at[t], v[5] + g_at[t]) for t, v in lower.items() if t in g_at}
        shift_note = "Binance prices shifted onto the chart price (median gap of the last 30 chart candles)"
    groups = {}
    for t in sorted(lower):
        groups.setdefault(session_of(t, mode), []).append(t)
    out = []
    for (s0, name), ts in sorted(groups.items()):
        bars = [(lower[t][0], lower[t][1], lower[t][3], lower[t][4]) for t in ts]
        lo, step, buy, sell = _histogram(bars, rows, row_size)
        poc_i, poc, vah, val = _levels(lo, step, buy, sell, va_pct)
        dev = []
        if developing:  # recomputed at each chart bar from that bar's data only (no look-ahead)
            j = 0
            for k, t in enumerate(ts):
                if k == len(ts) - 1 or (ts[k + 1] - ts[k + 1] % sec) != (t - t % sec):
                    sub = bars[:k + 1]
                    l2, st2, b2, s2 = _histogram(sub, rows, row_size)
                    _, p2, h2, v2 = _levels(l2, st2, b2, s2, va_pct)
                    dev.append([t - t % sec if tf != "D1" else t - t % 86400, round(p2, 6), round(h2, 6), round(v2, 6)])
        out.append({"start": s0, "name": name, "first": ts[0], "last": ts[-1] + isec, "lo": lo, "step": step,
                    "buy": [round(x, 4) for x in buy], "sell": [round(x, 4) for x in sell],
                    "poc_i": poc_i, "poc": poc, "vah": vah, "val": val,
                    "total": round(sum(buy) + sum(sell), 4), "delta": round(sum(buy) - sum(sell), 4), "dev": dev})
    unit = "base volume (coin / oz)" if src == "real" else "feed volume (MT5 = ticks)"
    info = {"source": src, "real_symbol": real_symbol(ticker), "intrabar": itf, "unit": unit, "mode": mode, "va_pct": va_pct,
            "method": ("Binance taker buy volume" if src == "real" else "lower-bar direction (TradingView default)") +
                      "; each lower bar's volume spread evenly over its high-low range", "shift": shift_note}
    return out, info


# ---------------- Step 3: footprint from every trade (2026-11-12, loader rebuilt 2026-11-15) ----------------
# Real symbols: every Binance futures aggregated trade (exact aggressor side), loaded by orderflow_trades.py
# (daily files for past days, REST for recent hours, newest first, saved to disk by the hour).
# A minute whose trades are not all loaded yet is filled from Binance's 1-minute candle (its real taker buy and sell
# totals, spread evenly over that minute's high-low) and the candle is flagged "est"; the chart dims it and swaps in
# the real trades as they arrive. Estimated symbols: the chart's own 1-minute candles (coarse; labelled).
import sys as _sys, os as _os
import orderflow_trades as _ot
MAX_PAST_DAYS = _ot.MAX_PAST_DAYS


def nice_step(x):
    """Round a row size to 1, 2, 2.5 or 5 x 10^k."""
    import math
    if x <= 0:
        return 1.0
    e = 10 ** math.floor(math.log10(x))
    for m in (1, 2, 2.5, 5, 10):
        if x <= m * e:
            return m * e
    return 10 * e


def footprint(ticker, tf, start_s, end_s, source="auto", history=None, row_size=0.0, chart_bars=None, fill=True):
    """Buy and sell volume at each price row inside every chart candle in [start_s, end_s], on the CHART's prices.
    chart_bars: [(t_s, high, low)] of those candles (auto row size). fill: estimate minutes not loaded yet.
    Each candle: t (open, UTC s), r0 (lowest row number; row price = r * row_size), buy[], sell[] from low to high,
    est (true when some of its minutes are estimated)."""
    import numpy as np
    src = pick_source(ticker, source)
    if src is None:
        raise ValueError(f"no real buyer/seller data for {ticker}")
    if history is None:
        raise ValueError("footprint needs the chart feed's history function")
    sec = TF_SEC[tf]
    start_s, end_s = int(start_s), int(end_s)
    if row_size <= 0:  # auto: about 7 rows in a typical candle (TradingView's auto uses a share of ATR, similar size)
        rng = sorted(h - l for _, h, l in (chart_bars or []) if h > l)
        row_size = nice_step(rng[len(rng) // 2] / 7) if rng else 1.0
    bucket = (lambda x: x - x % sec) if tf != "D1" else (lambda x: x - x % 86400)
    candles, est, pending, cov = {}, set(), False, []

    def spread(bt, lo, hi, buy, sell):
        r0, r1 = int(np.floor(lo / row_size + 1e-9)), int(np.floor(hi / row_size + 1e-9))
        n = r1 - r0 + 1
        c = candles.setdefault(bt, {})
        for r in range(r0, r1 + 1):
            x = c.setdefault(r, [0.0, 0.0]); x[0] += buy / n; x[1] += sell / n

    if src == "real":
        real1m = _rows("real", ticker, "M1", start_s, end_s + sec - 60, history)
        g_at = _shift(real1m, _rows("estimated", ticker, tf, start_s - 30 * sec, end_s, history), sec, 60)
        (t, p, q, s), cov, pending = _ot.store(real_symbol(ticker)).trades(start_s * 1000, (end_s + sec) * 1000 - 1)
        live = time.time() * 1000 - 3 * _ot.POLL_S * 1000      # loaded up to "now": the forming minute counts as whole
        full = {m for m in real1m if any(a <= m * 1000 and (b >= m * 1000 + 59_999 or b >= live) for a, b in cov)}
        if len(t):
            mins = (t // 60000) * 60
            k = np.isin(mins, np.fromiter(full, "int64", len(full)))     # only minutes holding every trade
            t, p, q, s, mins = t[k], p[k], q[k], s[k], mins[k]
        if len(t):
            gk = np.array(sorted(g_at), "int64")
            gv = np.array([g_at[x] for x in gk]) if len(gk) else np.zeros(1)
            g = gv[np.clip(np.searchsorted(gk, mins, side="right") - 1, 0, len(gv) - 1)] if len(gk) else np.zeros(len(t))
            row = np.floor((p + g) / row_size + 1e-9).astype("int64")
            bt = bucket((t // 1000).astype("int64"))
            base = int(row.min())
            for side, col in ((1, 0), (-1, 1)):
                kk = s == side
                key = bt[kk] * 100_000_000 + (row[kk] - base)
                u, inv = np.unique(key, return_inverse=True)
                vol = np.bincount(inv, weights=q[kk])
                for kx, v in zip(u.tolist(), vol.tolist()):
                    c = candles.setdefault(kx // 100_000_000, {})
                    c.setdefault(kx % 100_000_000 + base, [0.0, 0.0])[col] += v
        if fill:
            for m, v in real1m.items():
                if m in full or not start_s <= bucket(m) <= end_s:
                    continue
                gg = g_at.get(m, 0.0)
                spread(bucket(m), v[4] + gg, v[3] + gg, v[0], v[1])
                est.add(bucket(m))
    else:
        chart = _need_volume(_rows("estimated", ticker, "M1", start_s, end_s + sec - 60, history))
        for m, v in chart.items():
            if start_s <= bucket(m) <= end_s:
                spread(bucket(m), v[4], v[3], v[0], v[1])
    out = []
    for bt in sorted(candles):
        rows = candles[bt]
        lo, hi = min(rows), max(rows)
        out.append({"t": int(bt), "r0": lo, "buy": [round(rows.get(r, (0, 0))[0], 4) for r in range(lo, hi + 1)],
                    "sell": [round(rows.get(r, (0, 0))[1], 4) for r in range(lo, hi + 1)], "est": bt in est})
    first_cov = min((a for a, b in cov if b >= start_s * 1000), default=(end_s + sec) * 1000)
    info = {"source": src, "real_symbol": real_symbol(ticker), "row_size": row_size,
            "unit": "base volume (coin / oz)" if src == "real" else "feed volume (MT5 = ticks)",
            "covered_from": int(max(first_cov, start_s * 1000) // 1000), "pending": bool(pending and est),
            "est_candles": len(est),
            "method": "every Binance futures trade, shifted onto the chart price" +
                      ("; candles marked est use Binance 1-minute buy/sell totals until their trades load" if est else "")
                      if src == "real" else "chart 1-minute candles spread over their range (coarse estimate)"}
    return out, info
