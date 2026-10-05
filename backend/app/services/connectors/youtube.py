"""YouTube Data API connector (pustaka resmi google-api-python-client).
Dua mode auth: api_key (config) ATAU token OAuth user (use_oauth + koneksi tersimpan).
Quota: search.list mahal (±100 unit) — batasi max_pages & dokumentasikan.
Contoh config:
{"query": "literasi digital", "max_results": 25, "order": "relevance",
 "mapping": {"video_id": "video_id", "judul": "title"}, "max_pages": 2}
Dengan api_key: {"api_key": "..."} atau flag use_oauth (router menyuntik token).
"""
from __future__ import annotations
from .base import DataConnector, FetchResult, raw_hash, register, utcnow


def _build(api_key: str | None = None, token: str | None = None):
    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials

    if token:
        return build("youtube", "v3", credentials=Credentials(token=token))
    if api_key:
        return build("youtube", "v3", developerKey=api_key)
    raise ValueError("Butuh api_key atau token OAuth (use_oauth)")


@register
class YouTubeConnector(DataConnector):
    kind = "api"
    provider = "youtube"

    def authenticate(self, config: dict) -> dict:
        if not config.get("api_key") and not config.get("use_oauth"):
            raise ValueError("YouTube butuh 'api_key' atau use_oauth:true")
        return {"mode": "oauth" if config.get("use_oauth") else "api_key"}

    def fetch(self, config: dict) -> FetchResult:
        query = (config.get("query") or "").strip()
        if not query:
            raise ValueError("YouTube butuh 'query'")
        max_results = min(int(config.get("max_results", 25)), 50)
        max_pages = min(int(config.get("max_pages", 1)), 5)
        order = config.get("order", "relevance")
        if order not in ("relevance", "date", "rating", "viewCount"):
            raise ValueError("order harus relevance|date|rating|viewCount")
        headers = config.get("headers") or {}
        token = None
        auth = headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[len("Bearer "):]
        svc = _build(api_key=config.get("api_key"), token=token)
        ids: list[str] = []
        page_token = None
        raw_parts: list[bytes] = []
        import json as _json

        for _ in range(max_pages):
            req = svc.search().list(q=query, part="id", type="video", maxResults=max_results, order=order, pageToken=page_token) if page_token else svc.search().list(q=query, part="id", type="video", maxResults=max_results, order=order)
            try:
                res = req.execute()
            except Exception as e:
                raise ValueError(f"YouTube API error: {e}")
            raw_parts.append(_json.dumps(res, sort_keys=True).encode())
            ids.extend(it["id"]["videoId"] for it in res.get("items", []) if it.get("id", {}).get("videoId"))
            page_token = res.get("nextPageToken")
            if not page_token:
                break
        records = []
        for i in range(0, len(ids), 50):
            try:
                res = svc.videos().list(part="snippet,statistics", id=",".join(ids[i:i + 50])).execute()
            except Exception as e:
                raise ValueError(f"YouTube API error: {e}")
            raw_parts.append(_json.dumps(res, sort_keys=True).encode())
            for it in res.get("items", []):
                sn, st = it.get("snippet", {}), it.get("statistics", {})
                records.append({"video_id": it.get("id"), "title": sn.get("title"), "channel": sn.get("channelTitle"), "channel_id": sn.get("channelId"), "published_at": sn.get("publishedAt"), "description": (sn.get("description") or "")[:500], "views": int(st.get("viewCount", 0) or 0), "likes": int(st.get("likeCount", 0) or 0), "comments": int(st.get("commentCount", 0) or 0)})
        mapped = self.normalize(records, config.get("mapping"))
        return FetchResult(
            records=mapped,
            provenance={"source": "api:youtube", "retrieved_at": utcnow(), "query": {"q": query, "order": order, "max_results": max_results}, "raw_hash": raw_hash(b"".join(raw_parts)), "record_count": len(mapped), "quota_note": "search.list ±100 unit/panggil"},
        )
