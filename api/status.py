import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({
            "deriv": {"ok": True, "msg": "public feed"},
            "bybit": {"ok": True, "msg": "public feed"},
            "binance": {"ok": True, "msg": "public feed"},
        }).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
