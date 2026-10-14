FROM python:3.11-slim-bookworm
WORKDIR /code
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright
RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Install Playwright browsers + dependencies
RUN playwright install --with-deps chromium
COPY app ./app
COPY methods ./methods
COPY tests ./tests
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
