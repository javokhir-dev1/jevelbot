FROM python:3.10-slim
WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt || (echo "PIP ERROR" && exit 1)

COPY . .

RUN useradd -m appuser
USER appuser

ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "bot.py"]