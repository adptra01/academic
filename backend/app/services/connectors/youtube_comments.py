"""YouTube comments scraper."""
from __future__ import annotations

import asyncio

from .browser_base import BaseBrowserScraper, BrowserScraperError


class YouTubeCommentsScraper(BaseBrowserScraper):
    """Scrape comments from YouTube videos."""

    kind = "scraper"
    provider = "youtube_comments"

    async def _scrape(self, config: dict) -> list[dict]:
        video_url = config.get("url") or config.get("video_url") or config.get("post_url") or ""
        if not video_url:
            raise BrowserScraperError("url/video_url wajib diisi")

        limit = int(config.get("limit", 500))
        scroll_delay_ms = int(config.get("scroll_delay_ms", 1200))
        headless = bool(config.get("headless", True))
        storage_state = config.get("storage_state") or config.get("storage_state_json")

        await self._launch(headless=headless, storage_state=storage_state)

        records: list[dict] = []
        try:
            await self.page.goto(video_url, wait_until="domcontentloaded", timeout=60000)

            # Scroll to comments section
            try:
                await self.page.wait_for_selector("#comments, #comment-item", timeout=15000)
            except Exception:
                await asyncio.sleep(2)

            collected = 0
            last_count = 0
            stable = 0

            while collected < limit and stable < 5:
                comments = await self.page.evaluate(
                    """
                    () => {
                        const results = [];
                        const nodes = Array.from(document.querySelectorAll('#comment-item, ytd-comment-thread-renderer'));
                        for (const n of nodes) {
                            const txtEl = n.querySelector('#content-text, yt-formatted-string');
                            const txt = txtEl ? (txtEl.innerText || '').trim() : '';
                            if (!txt) continue;
                            const authEl = n.querySelector('#author-text, .yt-simple-endpoint');
                            const author = authEl ? (authEl.innerText || '').trim() : '';
                            const likeEl = n.querySelector('#vote-count-middle, [aria-label*="like"]');
                            const likes = likeEl ? parseInt((likeEl.innerText||'0').replace(/\D/g,'')) || 0 : 0;
                            const repEl = n.querySelector('#replies-button');
                            const replies = repEl ? parseInt((repEl.innerText||'0').replace(/\D/g,'')) || 0 : 0;
                            results.push({
                                text: txt,
                                author_username: author,
                                likes,
                                replies_count: replies,
                                comment_id: txt.slice(0, 30),
                            });
                        }
                        return results;
                    }
                    """
                )

                for c in comments:
                    records.append(
                        {
                            "platform": "youtube",
                            "post_url": video_url,
                            "author_username": c.get("author_username") or "",
                            "author_url": "",
                            "text": c.get("text") or "",
                            "likes": c.get("likes") or 0,
                            "replies_count": c.get("replies_count") or 0,
                            "comment_id": c.get("comment_id") or "",
                            "parent_id": "",
                            "created_at": "",
                            "is_reply": False,
                        }
                    )

                collected = len(records)
                if collected == last_count:
                    stable += 1
                else:
                    stable = 0
                    last_count = collected

                await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(scroll_delay_ms / 1000)

            records = records[:limit]
        except Exception as e:
            raise BrowserScraperError(f"Gagal scrape YouTube: {e}")
        finally:
            await self._close()

        return records


from .base import register

register(YouTubeCommentsScraper)
