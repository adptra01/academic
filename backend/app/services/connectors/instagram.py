"""Instagram comments scraper."""
from __future__ import annotations

import asyncio

from .browser_base import BaseBrowserScraper, BrowserScraperError


class InstagramCommentsScraper(BaseBrowserScraper):
    """Scrape comments from Instagram posts/reels."""

    kind = "scraper"
    provider = "instagram_comments"

    async def _scrape(self, config: dict) -> list[dict]:
        post_url = config.get("url") or config.get("post_url") or ""
        if not post_url:
            raise BrowserScraperError("url/post_url wajib diisi")

        limit = int(config.get("limit", 300))
        scroll_delay_ms = int(config.get("scroll_delay_ms", 1000))
        headless = bool(config.get("headless", True))
        storage_state = config.get("storage_state") or config.get("storage_state_json")

        await self._launch(headless=headless, storage_state=storage_state)

        records: list[dict] = []
        try:
            await self.page.goto(post_url, wait_until="domcontentloaded", timeout=90000)

            try:
                await self.page.wait_for_selector('div[role="button"]', timeout=15000)
            except Exception:
                await asyncio.sleep(3)

            collected = 0
            last_count = 0
            stable = 0
            passes = 0

            while collected < limit and stable < 5:
                comments = await self.page.evaluate(
                    """
                    () => {
                        const results = [];
                        // Generic selectors for IG comments
                        const nodes = Array.from(document.querySelectorAll('ul li, article'));
                        const seen = new Set();
                        for (const n of nodes) {
                            const txt = (n.innerText || '').split('\\n')[0];
                            if (txt.length < 5 || seen.has(txt)) continue;
                            seen.add(txt);
                            const author = (n.querySelector('a')?.innerText || '').trim();
                            results.push({
                                text: txt,
                                author_username: author,
                                comment_id: txt.slice(0, 20),
                                likes: 0,
                            });
                        }
                        return results;
                    }
                    """
                )
                passes += 1

                if passes == 1 and not comments:
                    raise BrowserScraperError(await self._detect_blockers("Instagram"))


                for c in comments:
                    if c.get("text"):
                        records.append(
                            {
                                "platform": "instagram",
                                "post_url": post_url,
                                "author_username": c.get("author_username") or "",
                                "author_url": "",
                                "text": c.get("text") or "",
                                "likes": c.get("likes") or 0,
                                "replies_count": 0,
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
        except BrowserScraperError:
            raise
        except Exception as e:
            raise BrowserScraperError(f"Gagal scrape Instagram: {e}")
        finally:
            await self._close()

        return records


from .base import register

register(InstagramCommentsScraper)
