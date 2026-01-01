FROM python:3.11-slim AS runtime

WORKDIR /app

COPY . /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "code.py"]
