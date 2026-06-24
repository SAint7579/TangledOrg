FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
COPY src/ src/

RUN pip install --no-cache-dir . --index-url https://pypi.org/simple/

RUN mkdir -p /app/data

EXPOSE 8080

CMD ["uvicorn", "src.appview.app:app", "--host", "0.0.0.0", "--port", "8080"]
