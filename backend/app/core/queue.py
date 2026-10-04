"""Celery app. Broker dari REDIS_URL. Worker: celery -A app.core.queue:celery_app worker."""
import os
from celery import Celery

celery_app = Celery("academic", broker=os.getenv("REDIS_URL", "redis://redis:6379/0"))
celery_app.conf.update(task_track_started=True, result_backend=os.getenv("REDIS_URL", "redis://redis:6379/0"))

# Registrasi task agar worker mengenalinya (import di akhir hindari circular).
try:  # pragma: no cover
    import app.tasks  # noqa: F401
except Exception:
    pass
