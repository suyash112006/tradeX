import json
from http.server import BaseHTTPRequestHandler
from api._db import db_get, db_set


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        data = db_get("templates:all", {})
        self._send(200, data)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            payload = json.loads(raw)
        except Exception:
            return self._send(400, {"error": "invalid json"})
        db_set("templates:all", payload)
        self._send(200, {"ok": True})
