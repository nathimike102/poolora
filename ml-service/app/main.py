"""
Sanchari ML Engine — AI-Powered Optimization Microservice

Provides:
  - Smart Ride Matching (5-Factor Weighted Score)
  - Demand Prediction (hourly/geographic forecasting)
  - Fraud Detection (cancellation, payment, IP risk analysis)
  - Route Optimization (VRP/TSP pickup sequencing)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import math
import logging
import time
import numpy as np
from collections import defaultdict

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sanchari-ml")

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Sanchari ML Engine",
    description="AI-Powered Ride Matching, Demand Prediction, Fraud Detection & Route Optimization",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Metrics (simple in-memory for Prometheus) ───────────────────────────────
request_count = defaultdict(int)
request_latency = defaultdict(list)


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS (Pydantic Schemas)
# ═══════════════════════════════════════════════════════════════════════════════


class Location(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class DriverCandidate(BaseModel):
    ride_id: str
    driver_id: str
    pickup_location: Location
    drop_location: Location
    departure_time: str  # ISO format
    price_per_seat: float
    available_seats: int
    driver_rating: float = Field(default=3.0, ge=0, le=5)
    acceptance_rate: float = Field(default=0.5, ge=0, le=1)
    cancellation_rate: float = Field(default=0.0, ge=0, le=1)
    total_rides: int = Field(default=0, ge=0)
    is_verified: bool = False
    gender: Optional[str] = None


class RideSearchParams(BaseModel):
    pickup_lat: float
    pickup_lng: float
    drop_lat: float
    drop_lng: float
    departure_time: str  # ISO format
    radius_km: float = Field(default=5.0, ge=0.5, le=50)
    time_deviation_mins: int = Field(default=120, ge=15, le=480)
    prefer_women_only: bool = False


class MatchRequest(BaseModel):
    candidates: List[DriverCandidate]
    search_params: RideSearchParams


class MatchScore(BaseModel):
    ride_id: str
    overall_score: float
    proximity_score: float
    time_score: float
    rating_score: float
    acceptance_score: float
    safety_score: float
    estimated_fare: float
    estimated_eta: int  # minutes
    distance_km: float


class DemandPredictionRequest(BaseModel):
    lat: float
    lng: float
    hour: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)  # 0=Mon, 6=Sun
    historical_rides: int = Field(default=0, ge=0)
    is_holiday: bool = False
    weather: str = "clear"  # clear, rain, storm


class DemandPrediction(BaseModel):
    predicted_demand: float
    confidence: float
    surge_multiplier: float
    demand_level: str  # low, medium, high, surge
    recommended_drivers: int


class FraudCheckRequest(BaseModel):
    user_id: str
    cancellation_count_7d: int = 0
    cancellation_count_30d: int = 0
    total_bookings: int = 0
    avg_payment_amount: float = 0
    current_payment_amount: float = 0
    unique_ips_7d: int = 1
    bookings_last_hour: int = 0
    account_age_days: int = 0
    is_verified: bool = False
    location_change_km: float = 0  # sudden location jump


class FraudResult(BaseModel):
    user_id: str
    risk_score: float  # 0-100
    risk_level: str  # low, medium, high, critical
    flags: List[str]
    should_block: bool
    recommended_action: str


class RoutePoint(BaseModel):
    id: str
    lat: float
    lng: float


class RouteOptRequest(BaseModel):
    origin: Location
    destination: Location
    waypoints: List[RoutePoint]


class OptimizedRoute(BaseModel):
    optimized_order: List[str]
    total_distance_km: float
    estimated_savings_km: float
    segments: List[dict]


# ═══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate great-circle distance between two points on Earth."""
    R = 6371.0
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def minutes_between(dt1_str: str, dt2_str: str) -> float:
    """Calculate absolute minutes between two ISO datetime strings."""
    try:
        dt1 = datetime.fromisoformat(dt1_str.replace("Z", "+00:00"))
        dt2 = datetime.fromisoformat(dt2_str.replace("Z", "+00:00"))
        return abs((dt1 - dt2).total_seconds()) / 60
    except Exception:
        return 9999


# ═══════════════════════════════════════════════════════════════════════════════
# 1. SMART RIDE MATCHING ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

# Match Score = (Distance × 0.40) + (TimeMatch × 0.30) + (Rating × 0.15)
#             + (AcceptanceRate × 0.10) + (SafetyScore × 0.05)

WEIGHTS = {
    "proximity": 0.40,
    "time": 0.30,
    "rating": 0.15,
    "acceptance": 0.10,
    "safety": 0.05,
}


def compute_match_score(candidate: DriverCandidate, params: RideSearchParams) -> MatchScore:
    """Compute the 5-factor weighted match score for a ride candidate."""

    # ── Proximity Score (40%) ──
    pickup_dist_km = haversine_km(
        params.pickup_lat, params.pickup_lng,
        candidate.pickup_location.lat, candidate.pickup_location.lng,
    )
    proximity_score = max(0, 1 - pickup_dist_km / params.radius_km) * 100

    # ── Time Score (30%) ──
    time_diff_mins = minutes_between(params.departure_time, candidate.departure_time)
    time_score = max(0, 1 - time_diff_mins / params.time_deviation_mins) * 100

    # ── Rating Score (15%) ──
    rating_score = (candidate.driver_rating / 5) * 100

    # ── Acceptance Score (10%) ──
    acceptance_score = candidate.acceptance_rate * 100

    # ── Safety Score (5%) ──
    verification_bonus = 20 if candidate.is_verified else 0
    experience_bonus = min(20, candidate.total_rides / 5) if candidate.total_rides > 0 else 0
    cancellation_penalty = candidate.cancellation_rate * 100
    safety_score = min(100, (1 - candidate.cancellation_rate) * 60 + verification_bonus + experience_bonus)

    # ── Weighted Overall ──
    overall = (
        WEIGHTS["proximity"] * proximity_score
        + WEIGHTS["time"] * time_score
        + WEIGHTS["rating"] * rating_score
        + WEIGHTS["acceptance"] * acceptance_score
        + WEIGHTS["safety"] * safety_score
    )

    # ── ETA estimate (40 km/h avg city speed) ──
    estimated_eta = max(1, round((pickup_dist_km / 40) * 60))

    return MatchScore(
        ride_id=candidate.ride_id,
        overall_score=round(overall, 2),
        proximity_score=round(proximity_score, 2),
        time_score=round(time_score, 2),
        rating_score=round(rating_score, 2),
        acceptance_score=round(acceptance_score, 2),
        safety_score=round(safety_score, 2),
        estimated_fare=candidate.price_per_seat,
        estimated_eta=estimated_eta,
        distance_km=round(pickup_dist_km, 2),
    )


@app.post("/api/match", response_model=List[MatchScore])
async def match_rides(request: MatchRequest):
    """Score and rank candidate rides using ML-weighted matching."""
    start = time.time()
    request_count["match"] += 1

    if not request.candidates:
        raise HTTPException(status_code=400, detail="No candidates provided")

    scores = []
    for candidate in request.candidates:
        try:
            score = compute_match_score(candidate, request.search_params)
            # Filter by women-only preference
            if request.search_params.prefer_women_only and candidate.gender != "female":
                continue
            scores.append(score)
        except Exception as e:
            logger.warning(f"Failed to score ride {candidate.ride_id}: {e}")

    # Sort by overall score descending
    scores.sort(key=lambda s: s.overall_score, reverse=True)

    elapsed = time.time() - start
    request_latency["match"].append(elapsed)
    logger.info(f"Matched {len(scores)} rides in {elapsed:.3f}s")

    return scores


# ═══════════════════════════════════════════════════════════════════════════════
# 2. DEMAND PREDICTION ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

# Demand model weights
DEMAND_FEATURES = {
    "hour_weight": 1.0,
    "day_weight": 0.5,
    "historical_weight": 0.3,
    "weather_weight": 0.2,
}

# Peak hours: morning rush (7-10), evening rush (17-20)
PEAK_HOURS = {7: 1.5, 8: 2.0, 9: 1.8, 10: 1.3, 17: 1.6, 18: 2.0, 19: 1.8, 20: 1.4}
WEEKEND_MULTIPLIER = 0.7
WEATHER_IMPACT = {"clear": 1.0, "rain": 1.3, "storm": 0.4}


@app.post("/api/predict-demand", response_model=DemandPrediction)
async def predict_demand(request: DemandPredictionRequest):
    """Predict ride demand for a location and time using ML features."""
    start = time.time()
    request_count["demand"] += 1

    # Base demand from historical data
    base_demand = max(1, request.historical_rides / 30)  # avg daily

    # Hour-of-day factor
    hour_factor = PEAK_HOURS.get(request.hour, 1.0)

    # Day-of-week factor (weekends lower)
    day_factor = WEEKEND_MULTIPLIER if request.day_of_week >= 5 else 1.0

    # Weather factor
    weather_factor = WEATHER_IMPACT.get(request.weather, 1.0)

    # Holiday factor
    holiday_factor = 0.6 if request.is_holiday else 1.0

    # Predicted demand with noise for realism
    raw_demand = base_demand * hour_factor * day_factor * weather_factor * holiday_factor
    noise = np.random.normal(0, raw_demand * 0.05)  # 5% noise
    predicted_demand = max(0, round(raw_demand + noise, 1))

    # Surge multiplier
    if predicted_demand > base_demand * 2:
        surge = round(1.0 + (predicted_demand - base_demand * 2) / (base_demand * 3) * 0.5, 2)
        surge = min(surge, 2.5)
    else:
        surge = 1.0

    # Demand level classification
    if predicted_demand < base_demand * 0.5:
        level = "low"
    elif predicted_demand < base_demand * 1.5:
        level = "medium"
    elif predicted_demand < base_demand * 2.5:
        level = "high"
    else:
        level = "surge"

    # Confidence based on data availability
    confidence = min(0.95, 0.5 + (request.historical_rides / 1000) * 0.45)

    # Recommended drivers to deploy
    recommended_drivers = max(1, round(predicted_demand * 0.4))

    elapsed = time.time() - start
    request_latency["demand"].append(elapsed)

    return DemandPrediction(
        predicted_demand=predicted_demand,
        confidence=round(confidence, 2),
        surge_multiplier=surge,
        demand_level=level,
        recommended_drivers=recommended_drivers,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. FRAUD DETECTION ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

FRAUD_THRESHOLDS = {
    "cancellation_7d_high": 5,
    "cancellation_30d_high": 15,
    "payment_deviation_pct": 300,  # 3x avg payment
    "unique_ips_suspicious": 10,
    "booking_velocity_high": 5,  # bookings per hour
    "account_age_risky": 7,  # days
    "location_jump_km": 500,  # suspicious jump
}


@app.post("/api/fraud-check", response_model=FraudResult)
async def check_fraud(request: FraudCheckRequest):
    """Analyze user behavior for fraud signals."""
    start = time.time()
    request_count["fraud"] += 1

    risk_score = 0.0
    flags = []

    # ── Cancellation Pattern Analysis ──
    if request.cancellation_count_7d >= FRAUD_THRESHOLDS["cancellation_7d_high"]:
        risk_score += 25
        flags.append(f"High cancellation rate: {request.cancellation_count_7d} in 7 days")

    if request.cancellation_count_30d >= FRAUD_THRESHOLDS["cancellation_30d_high"]:
        risk_score += 15
        flags.append(f"Elevated monthly cancellations: {request.cancellation_count_30d}")

    cancellation_ratio = (
        request.cancellation_count_30d / max(1, request.total_bookings)
    )
    if cancellation_ratio > 0.4:
        risk_score += 20
        flags.append(f"Cancellation ratio {cancellation_ratio:.0%} exceeds 40%")

    # ── Payment Anomaly Detection ──
    if request.avg_payment_amount > 0 and request.current_payment_amount > 0:
        deviation_pct = (request.current_payment_amount / request.avg_payment_amount) * 100
        if deviation_pct > FRAUD_THRESHOLDS["payment_deviation_pct"]:
            risk_score += 20
            flags.append(f"Payment {deviation_pct:.0f}% above average")

    # ── IP Risk Analysis ──
    if request.unique_ips_7d >= FRAUD_THRESHOLDS["unique_ips_suspicious"]:
        risk_score += 15
        flags.append(f"Suspicious IP diversity: {request.unique_ips_7d} unique IPs in 7 days")

    # ── Booking Velocity Check ──
    if request.bookings_last_hour >= FRAUD_THRESHOLDS["booking_velocity_high"]:
        risk_score += 20
        flags.append(f"Rapid booking velocity: {request.bookings_last_hour}/hour")

    # ── Account Age Risk ──
    if request.account_age_days < FRAUD_THRESHOLDS["account_age_risky"] and not request.is_verified:
        risk_score += 10
        flags.append(f"New unverified account: {request.account_age_days} days old")

    # ── Location Spoofing Detection ──
    if request.location_change_km > FRAUD_THRESHOLDS["location_jump_km"]:
        risk_score += 25
        flags.append(f"Suspicious location jump: {request.location_change_km:.0f} km")

    # ── Verification Bonus ──
    if request.is_verified:
        risk_score = max(0, risk_score - 10)

    # Clamp to 0-100
    risk_score = min(100, max(0, risk_score))

    # Risk classification
    if risk_score < 20:
        risk_level = "low"
        action = "allow"
    elif risk_score < 45:
        risk_level = "medium"
        action = "flag_for_review"
    elif risk_score < 70:
        risk_level = "high"
        action = "require_verification"
    else:
        risk_level = "critical"
        action = "block_and_escalate"

    should_block = risk_score >= 70

    elapsed = time.time() - start
    request_latency["fraud"].append(elapsed)
    logger.info(f"Fraud check for {request.user_id}: score={risk_score}, level={risk_level}")

    return FraudResult(
        user_id=request.user_id,
        risk_score=round(risk_score, 1),
        risk_level=risk_level,
        flags=flags,
        should_block=should_block,
        recommended_action=action,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 4. ROUTE OPTIMIZATION (TSP/VRP)
# ═══════════════════════════════════════════════════════════════════════════════


def solve_tsp_nearest_neighbor(distances: np.ndarray) -> List[int]:
    """Solve TSP using Nearest Neighbor heuristic — O(n²)."""
    n = len(distances)
    visited = [False] * n
    tour = [0]  # start from origin
    visited[0] = True

    for _ in range(n - 1):
        current = tour[-1]
        nearest = -1
        nearest_dist = float("inf")
        for j in range(n):
            if not visited[j] and distances[current][j] < nearest_dist:
                nearest = j
                nearest_dist = distances[current][j]
        if nearest >= 0:
            tour.append(nearest)
            visited[nearest] = True

    return tour


@app.post("/api/optimize-route", response_model=OptimizedRoute)
async def optimize_route(request: RouteOptRequest):
    """Optimize multi-stop pickup route using TSP/VRP algorithms."""
    start = time.time()
    request_count["route"] += 1

    if not request.waypoints:
        raise HTTPException(status_code=400, detail="At least one waypoint required")

    # Build all points: [origin, ...waypoints, destination]
    all_points = [
        {"id": "origin", "lat": request.origin.lat, "lng": request.origin.lng},
    ]
    for wp in request.waypoints:
        all_points.append({"id": wp.id, "lat": wp.lat, "lng": wp.lng})
    all_points.append(
        {"id": "destination", "lat": request.destination.lat, "lng": request.destination.lng}
    )

    n = len(all_points)

    # Build distance matrix
    dist_matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            if i != j:
                dist_matrix[i][j] = haversine_km(
                    all_points[i]["lat"], all_points[i]["lng"],
                    all_points[j]["lat"], all_points[j]["lng"],
                )

    # Solve TSP
    optimized_tour = solve_tsp_nearest_neighbor(dist_matrix)

    # Ensure destination is last
    dest_idx = n - 1
    if optimized_tour[-1] != dest_idx:
        optimized_tour.remove(dest_idx)
        optimized_tour.append(dest_idx)

    # Calculate optimized total distance
    optimized_dist = sum(
        dist_matrix[optimized_tour[i]][optimized_tour[i + 1]]
        for i in range(len(optimized_tour) - 1)
    )

    # Calculate naive (original order) distance
    naive_dist = sum(dist_matrix[i][i + 1] for i in range(n - 1))

    # Build segments
    segments = []
    for i in range(len(optimized_tour) - 1):
        from_idx = optimized_tour[i]
        to_idx = optimized_tour[i + 1]
        segments.append({
            "from": all_points[from_idx]["id"],
            "to": all_points[to_idx]["id"],
            "distance_km": round(dist_matrix[from_idx][to_idx], 2),
            "estimated_mins": max(1, round((dist_matrix[from_idx][to_idx] / 40) * 60)),
        })

    # Extract optimized waypoint order (excluding origin and destination)
    optimized_order = [all_points[idx]["id"] for idx in optimized_tour if idx not in (0, dest_idx)]

    elapsed = time.time() - start
    request_latency["route"].append(elapsed)

    return OptimizedRoute(
        optimized_order=optimized_order,
        total_distance_km=round(optimized_dist, 2),
        estimated_savings_km=round(max(0, naive_dist - optimized_dist), 2),
        segments=segments,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH & METRICS
# ═══════════════════════════════════════════════════════════════════════════════


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "sanchari-ml",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/metrics")
async def metrics():
    """Prometheus-compatible metrics endpoint."""
    lines = []
    for endpoint, count in request_count.items():
        lines.append(f'sanchari_ml_requests_total{{endpoint="{endpoint}"}} {count}')
    for endpoint, latencies in request_latency.items():
        if latencies:
            avg = sum(latencies[-100:]) / len(latencies[-100:])
            lines.append(f'sanchari_ml_request_duration_seconds{{endpoint="{endpoint}"}} {avg:.4f}')
    return "\n".join(lines)


@app.get("/")
async def root():
    return {
        "service": "Sanchari ML Engine",
        "version": "1.0.0",
        "endpoints": [
            "POST /api/match — Smart ride matching",
            "POST /api/predict-demand — Demand forecasting",
            "POST /api/fraud-check — Fraud detection",
            "POST /api/optimize-route — Route optimization (TSP/VRP)",
            "GET /health — Health check",
            "GET /metrics — Prometheus metrics",
        ],
    }
