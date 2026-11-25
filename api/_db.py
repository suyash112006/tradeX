import json
import os
import urllib.request
from pathlib import Path

KV_URL = os.environ.get("KV_REST_API_URL", "").rstrip("/")
KV_TOKEN = os.environ.get("KV_REST_API_TOKEN", "")
PG_URL = os.environ.get("POSTGRES_URL", "")


def _kv_req(cmd_args):
    req = urllib.request.Request(
        KV_URL,
        data=json.dumps(cmd_args).encode("utf-8"),
        headers={"Authorization": f"Bearer {KV_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8")).get("result")


def db_get(key: str, default=None):
    if KV_URL and KV_TOKEN:
        try:
            raw = _kv_req(["GET", key])
            return json.loads(raw) if raw else default
        except Exception:
            pass
    if PG_URL:
        try:
            import psycopg2
            with psycopg2.connect(PG_URL) as conn, conn.cursor() as cur:
                cur.execute("CREATE TABLE IF NOT EXISTS tradex_kv (k TEXT PRIMARY KEY, v JSONB)")
                cur.execute("SELECT v FROM tradex_kv WHERE k = %s", (key,))
                row = cur.fetchone()
                return row[0] if row else default
        except Exception:
            pass
    p = Path("/tmp") / f"tradex_{key.replace('/', '_')}.json"
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return default


def db_set(key: str, value):
    if KV_URL and KV_TOKEN:
        try:
            _kv_req(["SET", key, json.dumps(value)])
            return True
        except Exception:
            pass
    if PG_URL:
        try:
            import psycopg2
            with psycopg2.connect(PG_URL) as conn, conn.cursor() as cur:
                cur.execute("CREATE TABLE IF NOT EXISTS tradex_kv (k TEXT PRIMARY KEY, v JSONB)")
                cur.execute(
                    "INSERT INTO tradex_kv (k, v) VALUES (%s, %s::jsonb) "
                    "ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v",
                    (key, json.dumps(value)),
                )
                conn.commit()
                return True
        except Exception:
            pass
    p = Path("/tmp") / f"tradex_{key.replace('/', '_')}.json"
    p.write_text(json.dumps(value), encoding="utf-8")
    return True
