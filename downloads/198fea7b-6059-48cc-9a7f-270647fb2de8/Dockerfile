FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd -m appuser
COPY . .
USER appuser
ENV PYTHONUNBUFFERED=1
CMD ["python", "-u", "python.py"]