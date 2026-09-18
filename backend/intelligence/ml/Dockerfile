FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

EXPOSE 8091
EXPOSE 5000

# Start FastAPI server (ML API)
CMD ["uvicorn", "service.main:app", "--host", "0.0.0.0", "--port", "8091"]
