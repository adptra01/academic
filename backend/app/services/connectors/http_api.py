"""Generic REST connector: GET/POST JSON API milik user (kunci, survei, open data).
Contoh config:
{
  "url": "https://api.example.com/v1/records",
  "method": "GET",
  "headers": {"Authorization": "Bearer ..."},   # disanitasi, tak pernah dilog
  "params": {"limit": 100},
  "records_path": "data.items",                  # path ke list dalam respons
  "mapping": {"usia": "age", "jk": "gender"},    # kolom_tujuan: path_sumber
  "pagination": {"param": "page", "from": 1, "max_pages": 5, "stop_when_empty": true},
  "timeout": 15, "max_retries": 2
}
"""
from __future__ import annotations
import json
import time
import urllib.request
import urllib.parse
from .base import DataConnector, FetchResult, raw_hash, register, sanitize_config, utcnow


class ConnectorError(Exception):
    pass


def _get_path(obj: dict, path: str):
    cur: object = obj
    for part in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        elif isinstance(cur, list) and part.isdigit():
            cur = cur[int(part)]
        else:
            return None
        if cur is None:
            return None
    return cur


@register
class GenericRESTConnector(DataConnector):
    kind = "api"
    provider = "generic_rest"

    def authenticate(self, config: dict) -> dict:
        url = config.get("url", "")
        if not url.startswith(("https://", "http://localhost", "http://127.0.0.1")):
            raise ConnectorError("URL harus https (http hanya localhost dev)")
        return {"url": url}

    def _request(self, url: str, method: str, headers: dict, body: dict | None, timeout: int, retries: int) -> dict:
        data = json.dumps(body).encode() if body is not None else None
        last: Exception | None = None
        for attempt in range(retries + 1):
            try:
                req = urllib.request.Request(url, data=data, method=method.upper())
                for k, v in headers.items():
                    req.add_header(k, str(v))
                if data:
                    req.add_header("Content-Type", "application/json")
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    if resp.status >= 400:
                        raise ConnectorError(f"API HTTP {resp.status}")
                    return json.loads(resp.read())
            except ConnectorError:
                raise
            except Exception as e:  # timeout/DNS/reset → retry
                last = e
                time.sleep(min(2 ** attempt, 5))
        raise ConnectorError(f"Gagal setelah {retries + 1} percobaan: {last}")

    def fetch(self, config: dict) -> FetchResult:
        url = config.get("url", "")
        self.authenticate(config)
        method = str(config.get("method", "GET")).upper()
        if method not in ("GET", "POST"):
            raise ConnectorError("method harus GET|POST")
        headers = dict(config.get("headers") or {})
        params = dict(config.get("params") or {})
        body = config.get("body")
        records_path = config.get("records_path", "")
        mapping = config.get("mapping")
        timeout = int(config.get("timeout", 15))
        retries = int(config.get("max_retries", 2))
        if not 1 <= timeout <= 120 or not 0 <= retries <= 5:
            raise ConnectorError("timeout 1..120, max_retries 0..5")
        paging = config.get("pagination") or {}
        all_records: list = []
        raw_parts: list[bytes] = []
        pages = 0
        max_pages = int(paging.get("max_pages", 1)) if paging else 1
        page_param = paging.get("param", "page")
        page = int(paging.get("from", 1))
        while True:
            p = dict(params)
            if paging:
                p[page_param] = page
            full = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(p) if (p and method == "GET") else url
            payload = self._request(full, method, headers, body, timeout, retries)
            raw_parts.append(json.dumps(payload, sort_keys=True).encode())
            batch = _get_path(payload, records_path) if records_path else payload
            if isinstance(batch, dict):
                batch = [batch]
            if not isinstance(batch, list):
                raise ConnectorError(f"records_path '{records_path}' bukan list")
            all_records.extend(batch)
            pages += 1
            if not paging or pages >= max(1, max_pages):
                break
            if paging.get("stop_when_empty", True) and not batch:
                break
            page += 1
            time.sleep(float(paging.get("delay", 0.5)))
        records = self.normalize(all_records, mapping)
        return FetchResult(
            records=records,
            provenance={
                "source": f"api:{self.provider}", "retrieved_at": utcnow(),
                "query": sanitize_config({"url": url, "method": method, "params": params, "records_path": records_path, "pages": pages}),
                "raw_hash": raw_hash(b"".join(raw_parts)), "record_count": len(records),
            },
        )
