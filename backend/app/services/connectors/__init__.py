"""Connector registry initialization.

Import all connector implementations so they auto-register via @register decorator.
"""
from . import http_api  # noqa: F401
from . import scraper  # noqa: F401
from . import youtube  # noqa: F401 (YouTube Data API, kind=api provider=youtube)
from . import tiktok  # noqa: F401
from . import instagram  # noqa: F401
from . import youtube_comments  # noqa: F401 (browser scraper, kind=scraper)
from . import facebook  # noqa: F401
from . import x_twitter  # noqa: F401
