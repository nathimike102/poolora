# Sanchari ML Engine — README
# ═══════════════════════════════════════════════════

## Overview

The **Sanchari ML Engine** is a Python/FastAPI microservice that powers the AI features of the Sanchari mobility platform:

| Endpoint | Purpose |
|---|---|
| `POST /api/match` | Smart ride matching with 5-factor weighted scoring |
| `POST /api/predict-demand` | Hourly/geographic demand forecasting |
| `POST /api/fraud-check` | Multi-signal fraud detection |
| `POST /api/optimize-route` | TSP/VRP route optimization |
| `GET /health` | Health check |
| `GET /metrics` | Prometheus metrics |

## Quick Start

```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Docker

```bash
docker build -t sanchari-ml .
docker run -p 8000:8000 sanchari-ml
```

## Architecture

The ML engine implements the scoring algorithm from the README:

```
Match Score = (Distance × 0.40) + (TimeMatch × 0.30) + (Rating × 0.15)
            + (AcceptanceRate × 0.10) + (SafetyScore × 0.05)
```

### Fraud Detection Signals
- Cancellation pattern analysis
- Payment anomaly detection
- IP risk analysis
- Booking velocity checks
- Location spoofing detection

### Demand Prediction Features
- Hour-of-day peak detection
- Day-of-week patterns
- Weather impact modeling
- Holiday adjustments
- Surge multiplier calculation
