import json
from http.server import BaseHTTPRequestHandler

DEFAULT_INSTRUMENTS = [
    {"key": "XAUUSD", "name": "Gold / USD", "brokers": {"deriv": "frxXAUUSD"}},
    {"key": "EURUSD", "name": "EUR / USD", "brokers": {"deriv": "frxEURUSD"}},
    {"key": "GBPUSD", "name": "GBP / USD", "brokers": {"deriv": "frxGBPUSD"}},
    {"key": "USDJPY", "name": "USD / JPY", "brokers": {"deriv": "frxUSDJPY"}},
    {"key": "BTCUSDT", "name": "Bitcoin / USDT", "brokers": {"binance": "BTCUSDT", "bybit": "BTCUSDT"}},
    {"key": "ETHUSDT", "name": "Ethereum / USDT", "brokers": {"binance": "ETHUSDT", "bybit": "ETHUSDT"}},
    {"key": "SOLUSDT", "name": "Solana / USDT", "brokers": {"binance": "SOLUSDT", "bybit": "SOLUSDT"}},
]


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"instruments": DEFAULT_INSTRUMENTS}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "public, max-age=60")
        self.end_headers()
        self.wfile.write(body)
