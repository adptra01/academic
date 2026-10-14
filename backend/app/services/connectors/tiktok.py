"""TikTok comments scraper."""
from __future__ import annotations

import asyncio
from typing import Any

from .browser_base import BaseBrowserScraper, BrowserScraperError


class TikTokCommentsScraper(BaseBrowserScraper):
    """Scrape comments from TikTok videos."""

    kind = "scraper"
    provider = "tiktok_comments"

    async def _scrape(self, config: dict) -> list[dict]:
        post_url = config.get("url") or config.get("post_url") or ""
        if not post_url:
            raise BrowserScraperError("url/post_url wajib diisi")

        limit = int(config.get("limit", 500))
        include_replies = bool(config.get("include_replies", True))
        scroll_delay_ms = int(config.get("scroll_delay_ms", 800))
        headless = bool(config.get("headless", True))
        storage_state = config.get("storage_state") or config.get("storage_state_json")

        await self._launch(headless=headless, storage_state=storage_state)

        records: list[dict] = []
        try:
            await self.page.goto(post_url, wait_until="domcontentloaded", timeout=60000)

            # Wait for comments section to load
            try:
                await self.page.wait_for_selector(
                    '[data-e2e="comment-item"], .tiktok-comment-item, [class*="comment"], [class*="Comment"]',
                    timeout=15000,
                )
            except Exception:
                # Try generic
                await asyncio.sleep(2)

            collected = 0
            last_height = 0
            stable_count = 0
            max_stable = 5

            while collected < limit:
                # Extract comments
                comments = await self.page.evaluate(
                    """
                    () => {
                        const results = [];
                        // Try common selectors
                        const selectors = [
                            '[data-e2e="comment-item"]',
                            '.tiktok-comment-item',
                            '[class*="comment"]',
                            'div[data-testid*="comment"]',
                        ];
                        let nodes = [];
                        for (const s of selectors) {
                            nodes = nodes.concat(Array.from(document.querySelectorAll(s)));
                        }
                        // Dedup by text+author
                        const seen = new Set();
                        for (const n of nodes) {
                            const txt = (n.innerText || '').trim();
                            if (!txt || seen.has(txt)) continue;
                            seen.add(txt);
                            // Try to extract author
                            const authorEl = n.querySelector('[data-e2e="comment-username"], [class*="author"], [class*="username"], a[href*="@"]');
                            const author = authorEl ? (authorEl.innerText || authorEl.textContent || '').trim() : '';
                            const authorUrl = authorEl?.getAttribute('href') || '';
                            // Likes
                            const likeEl = n.querySelector('[data-e2e="comment-like-count"], [class*="like"], svg + span');
                            const likes = likeEl ? parseInt((likeEl.innerText||'0').replace(/\D/g,'')) || 0 : 0;
                            // Reply count
                            const repEl = n.querySelector('[class*="reply"], [data-e2e="comment-reply-count"]');
                            const replies = repEl ? parseInt((repEl.innerText||'0').replace(/\D/g,'')) || 0 : 0;
                            // Comment ID rough
                            const cid = n.getAttribute('data-comment-id') || n.getAttribute('id') || '';
                            results.push({
                                text: txt,
                                author_username: author,
                                author_url: authorUrl,
                                likes,
                                replies_count: replies,
                                comment_id: cid,
                                is_reply: txt.includes('Reply') || txt.length < 5 ? false : false, // heuristic improved later
                            });
                        }
                        return results;
                    }
                    """
                )

                if comments:
                    for c in comments:
                        records.append(
                            {
                                "platform": "tiktok",
                                "post_url": post_url,
                                "author_username": c.get("author_username") or "",
                                "author_url": c.get("author_url") or "",
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

                # Scroll
                await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(scroll_delay_ms / 1000)

                # Check height
                height = await self.page.evaluate("document.body.scrollHeight")
                if height == last_height:
                    stable_count += 1
                    if stable_count >= max_stable:
                        break  # no more content
                else:
                    stable_count = 0
                    last_height = height

                if collected >= limit:
                    break

            # Trim if over limit
            records = records[:limit]

        except Exception as e:
            raise BrowserScraperError(f"Gagal scrape TikTok: {e}")
        finally:
            await self._close()

        return records


from .base import register

register(TikTokCommentsScraper)
