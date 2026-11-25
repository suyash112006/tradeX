import json
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

BINANCE_TF = {"M1": "1m", "M3": "3m", "M5": "5m", "M15": "15m", "M30": "30m", "H1": "1h", "H4": "4h", "D1": "1d", "W1": "1w", "MN": "1M"}
BYBIT_TF = {"M1": "1", "M3": "3", "M5": "5", "M15": "15", "M30": "30", "H1": "60", "H4": "240", "D1": "D", "W1": "W", "MN": "M"}


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "TradeX/1.0"})
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read().decode("utf-8"))


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        source = (qs.get("source") or ["binance"])[0].lower()
        symbol = (qs.get("symbol") or ["BTCUSDT"])[0]
        tf = (qs.get("tf") or ["M5"])[0].upper()
        limit = min(1000, max(1, int((qs.get("limit") or ["500"])[0])))
        to_ms = qs.get("to", [None])[0]

        try:
            if source == "bybit":
                iv = BYBIT_TF.get(tf, "5")
                u = f"https://api.bybit.com/v5/market/kline?category=linear&symbol={urllib.parse.quote(symbol)}&interval={iv}&limit={limit}"
                if to_ms:
                    u += f"&end={int(to_ms)}"
                data = fetch_json(u)
                rows = (data.get("result") or {}).get("list") or []
                bars = [
                    {
                        "time": int(r[0]) // 1000,
                        "open": float(r[1]),
                        "high": float(r[2]),
                        "low": float(r[3]),
                        "close": float(r[4]),
                        "volume": float(r[5]),
                    }
                    for r in reversed(rows)
                ]
                return self._send(200, bars)

            # Default / Binance public REST API
            iv = BINANCE_TF.get(tf, "5m")
            sym = symbol.replace("frx", "").replace("USD", "USDT") if symbol.startswith("frx") else symbol
            u = f"https://api.binance.com/api/v3/klines?symbol={urllib.parse.quote(sym)}&interval={iv}&limit={limit}"
            if to_ms:
                u += f"&endTime={int(to_ms)}"
            rows = fetch_json(u)
            bars = [
                {
                    "time": int(r[0]) // 1000,
                    "open": float(r[1]),
                    "high": float(r[2]),
                    "low": float(r[3]),
                    "close": float(r[4]),
                    "volume": float(r[5]),
                }
                for r in rows
            ]
            return self._send(200, bars)
        except Exception as e:
            return self._send(500, {"error": str(e)})
