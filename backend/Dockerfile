FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir . --index-url https://pypi.org/simple/

COPY src/ src/

RUN mkdir -p /app/data

ENV TANGLED_ORG_DB_PATH=/app/data/tangledorg.db
EXPOSE 8080

CMD ["uvicorn", "src.appview.app:app", "--host", "0.0.0.0", "--port", "8080"]
