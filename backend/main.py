"""
Invadr – FastAPI Backend with Real Auth & ML Prediction Pipeline
Run with: uvicorn main:app --reload --port 8000

Endpoints:
  POST /auth/register  → create a new user account
  POST /auth/login     → authenticate and return JWT token
  POST /predict        → run ML model on uploaded image
  POST /reports        → accept an uploaded field report
"""

import hashlib
import hmac
import json
import os
import secrets
import subprocess
import time
import uuid
from io import BytesIO
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from PIL import Image
from pydantic import BaseModel

# ── PyTorch model setup ────────────────────────────────────────────────────────
import torch
import torch.nn as nn

animal_model = None
plant_model = None

# Class labels for pipeline models
ANIMAL_CLASSES = sorted([
    "bear", "bison", "boar", "chimpanzee", "coyote", "deer",
    "elephant", "fox", "gorilla", "hippopotamus", "hyena", "kangaroo",
    "leopard", "lion", "non_invasive", "porcupine", "raccoon",
    "rhinoceros", "seal", "shark", "snake", "swan", "tiger", "wolf", "zebra"
])
PLANT_CLASSES = sorted([
    "Chinee apple", "Siam weed", "Lantana", "Prickly acacia",
    "Parkinsonia", "Parthenium", "Snake weed", "Rubber vine",
    "Negative"
])
ANIMAL_NON_INV = "non_invasive"
PLANT_NON_INV  = "Negative"

# Risk level per species
ANIMAL_RISK = {
    "boar": "high", "raccoon": "high", "snake": "high", "fox": "high",
    "coyote": "medium", "deer": "medium", "swan": "medium", "wolf": "medium",
    "hyena": "medium", "kangaroo": "medium", "hippopotamus": "medium",
}
PLANT_RISK = {
    "Chinee apple": "high", "Siam weed": "high", "Lantana": "high",
    "Prickly acacia": "high", "Rubber vine": "high", "Parthenium": "high",
    "Parkinsonia": "medium", "Snake weed": "medium",
}

def species_risk_level(species: str, kingdom: str) -> str:
    if kingdom == "plant":
        return PLANT_RISK.get(species, "medium")
    return ANIMAL_RISK.get(species.lower(), "medium")


class PlantClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        import timm
        self.backbone = timm.create_model("efficientnet_b2", pretrained=False, num_classes=0)
        self.head = nn.Sequential(
            nn.BatchNorm1d(1408), nn.Dropout(0.35),
            nn.Linear(1408, 512), nn.SiLU(),
            nn.BatchNorm1d(512),  nn.Dropout(0.175),
            nn.Linear(512, 9),
        )
    def forward(self, x):
        return self.head(self.backbone(x))


class AnimalClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        import timm
        self.backbone = timm.create_model("efficientnet_b2", pretrained=False, num_classes=0)
        self.head = nn.Sequential(
            nn.BatchNorm1d(1408), nn.Dropout(0.45),
            nn.Linear(1408, 768), nn.SiLU(),
            nn.BatchNorm1d(768),  nn.Dropout(0.225),
            nn.Linear(768, 256),  nn.SiLU(),
            nn.BatchNorm1d(256),  nn.Dropout(0.1125),
            nn.Linear(256, 25),
        )
    def forward(self, x):
        return self.head(self.backbone(x))


def load_ml_models():
    """Load both PyTorch EfficientNet-B2 models at startup."""
    global animal_model, plant_model
    try:
        ANIMAL_PATH = Path(__file__).parent / "model" / "best_animal_model.pth"
        PLANT_PATH  = Path(__file__).parent / "model" / "best_plant_model1.pth"

        if not ANIMAL_PATH.exists():
            print(f"[ML] WARNING: Animal model not found at {ANIMAL_PATH}")
            return
        if not PLANT_PATH.exists():
            print(f"[ML] WARNING: Plant model not found at {PLANT_PATH}")
            return

        # Load animal model
        a_model = AnimalClassifier()
        a_state = torch.load(str(ANIMAL_PATH), map_location="cpu", weights_only=False)
        if isinstance(a_state, dict) and "model_state_dict" in a_state:
            a_state = a_state["model_state_dict"]
        a_model.load_state_dict(a_state, strict=True)
        a_model.eval()
        animal_model = a_model
        print(f"[ML] Animal model loaded: {ANIMAL_PATH.name}")

        # Load plant model (saved as directory)
        p_model = PlantClassifier()
        p_state = torch.load(str(PLANT_PATH), map_location="cpu", weights_only=False)
        if isinstance(p_state, dict) and "model_state_dict" in p_state:
            p_state = p_state["model_state_dict"]
        p_model.load_state_dict(p_state, strict=True)
        p_model.eval()
        plant_model = p_model
        print(f"[ML] Plant model loaded: {PLANT_PATH.name}")

    except Exception as e:
        print(f"[ML] WARNING: Failed to load models: {e}")
        import traceback
        traceback.print_exc()

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Invadr API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    load_ml_models()

# ── In-memory user store (replace with DB in production) ───────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", "invadr_secret_key_change_in_production")
TOKEN_EXPIRY_HOURS = 72

# password hashing helpers
def hash_password(password: str, salt: str = "") -> str:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}${hashed.hex()}"

def verify_password(password: str, stored: str) -> bool:
    salt, hashed_hex = stored.split("$", 1)
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return hmac.compare_digest(check.hex(), hashed_hex)

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + TOKEN_EXPIRY_HOURS * 3600,
        "jti": secrets.token_hex(16),
    }
    # Simple HMAC-based token (no external JWT lib needed)
    payload_b64 = secrets.token_urlsafe(0)  # not used, we serialize JSON
    payload_json = json.dumps(payload)
    import base64
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode()
    sig = hmac.new(JWT_SECRET.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{sig}"

def decode_token(token: str) -> Optional[dict]:
    try:
        parts = token.rsplit(".", 1)
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        expected_sig = hmac.new(JWT_SECRET.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        import base64
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

# In-memory user database
USERS_DB: dict[str, dict] = {}

def _seed_default_users():
    """Add default admin and test-user accounts only if their emails don't already exist.
    Called AFTER _load_users() so persisted accounts are never duplicated.
    """
    existing_emails = {u["email"] for u in USERS_DB.values()}
    changed = False
    if "admin@invadr.io" not in existing_emails:
        aid = str(uuid.uuid4())
        USERS_DB[aid] = {
            "id": aid,
            "email": "admin@invadr.io",
            "name": "Admin",
            "role": "admin",
            "password_hash": hash_password("admin123"),
        }
        changed = True
        print("[DB] Seeded default admin account")
    if "user@invadr.io" not in existing_emails:
        uid = str(uuid.uuid4())
        USERS_DB[uid] = {
            "id": uid,
            "email": "user@invadr.io",
            "name": "Field Worker",
            "role": "user",
            "password_hash": hash_password("user123"),
        }
        changed = True
        print("[DB] Seeded default field-worker account")
    if changed:
        _save_users()

security = HTTPBearer(auto_error=False)

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        return None
    payload = decode_token(creds.credentials)
    if not payload:
        return None
    return USERS_DB.get(payload.get("sub"))


# ── Auth Endpoints ─────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "user"  # "user" or "admin"
    phone: Optional[str] = None
    home_location: Optional[str] = None
    home_latitude: Optional[float] = None
    home_longitude: Optional[float] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    token: str
    phone: Optional[str] = None
    home_location: Optional[str] = None
    home_latitude: Optional[float] = None
    home_longitude: Optional[float] = None

@app.post("/auth/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    # Check if email already exists
    for u in USERS_DB.values():
        if u["email"].lower() == body.email.lower():
            raise HTTPException(status_code=409, detail="Email already registered.")

    if body.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'.")

    user_id = str(uuid.uuid4())
    USERS_DB[user_id] = {
        "id": user_id,
        "email": body.email.lower(),
        "name": body.name,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "phone": body.phone,
        "home_location": body.home_location,
        "home_latitude": body.home_latitude,
        "home_longitude": body.home_longitude,
    }
    _save_users()
    token = create_token(user_id, body.role)
    return AuthResponse(
        id=user_id,
        email=body.email.lower(),
        name=body.name,
        role=body.role,
        token=token,
        phone=body.phone,
        home_location=body.home_location,
        home_latitude=body.home_latitude,
        home_longitude=body.home_longitude,
    )


@app.post("/auth/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    # Find user by email
    user = None
    for u in USERS_DB.values():
        if u["email"].lower() == body.email.lower():
            user = u
            break

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_token(user["id"], user["role"])
    return AuthResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        token=token,
        phone=user.get("phone"),
        home_location=user.get("home_location"),
        home_latitude=user.get("home_latitude"),
        home_longitude=user.get("home_longitude"),
    )


# ── ML Prediction ─────────────────────────────────────────────────────────────

IMG_SIZE = 260
IMG_MEAN = [0.485, 0.456, 0.406]
IMG_STD  = [0.229, 0.224, 0.225]

CONF_THRESHOLD = 0.35  # minimum confidence to trust prediction


def preprocess_for_pipeline(image_bytes: bytes):
    """Preprocess image bytes into a PyTorch tensor for EfficientNet-B2."""
    from torchvision import transforms
    transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(IMG_MEAN, IMG_STD),
    ])
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    return transform(img).unsqueeze(0)


def run_model_on_tensor(pt_model, tensor, classes: list) -> list:
    """Run a PyTorch model and return sorted top predictions."""
    with torch.no_grad():
        logits = pt_model(tensor)
        probs = torch.softmax(logits, dim=1).squeeze()
    top_indices = probs.argsort(descending=True)[:5].tolist()
    return [
        {"species_name": classes[i], "confidence": round(probs[i].item(), 4)}
        for i in top_indices
    ]


class PredictResponse(BaseModel):
    species_name: str
    confidence_score: float
    invasive_risk_level: str
    top_predictions: list[dict] = []


@app.post("/predict", response_model=PredictResponse)
async def predict(image: UploadFile = File(...)):
    image_bytes = await image.read()

    if animal_model is not None and plant_model is not None:
        # ── Real ML prediction using PyTorch pipeline ──
        try:
            tensor = preprocess_for_pipeline(image_bytes)

            # Run both models
            animal_preds = run_model_on_tensor(animal_model, tensor, ANIMAL_CLASSES)
            plant_preds  = run_model_on_tensor(plant_model, tensor, PLANT_CLASSES)

            a_best_conf = animal_preds[0]["confidence"]
            p_best_conf = plant_preds[0]["confidence"]

            # Pick whichever model is more confident
            if a_best_conf >= p_best_conf and a_best_conf >= CONF_THRESHOLD:
                kingdom = "animal"
                best_preds = animal_preds
            elif p_best_conf >= CONF_THRESHOLD:
                kingdom = "plant"
                best_preds = plant_preds
            else:
                # Neither model confident — use whichever is higher
                kingdom = "animal" if a_best_conf >= p_best_conf else "plant"
                best_preds = animal_preds if kingdom == "animal" else plant_preds

            best = best_preds[0]
            species = best["species_name"]
            conf    = best["confidence"]

            # Determine invasive status
            non_inv = ANIMAL_NON_INV if kingdom == "animal" else PLANT_NON_INV
            is_invasive = species.lower() != non_inv.lower()
            risk = species_risk_level(species, kingdom) if is_invasive else "low"

            # Build top_predictions list for the app
            top_preds = [
                {
                    "species_name": p["species_name"].replace("_", " ").title(),
                    "confidence": p["confidence"],
                    "risk_level": species_risk_level(p["species_name"], kingdom)
                    if p["species_name"].lower() not in (ANIMAL_NON_INV.lower(), PLANT_NON_INV.lower())
                    else "low",
                }
                for p in best_preds
            ]

            return PredictResponse(
                species_name=species.replace("_", " ").title(),
                confidence_score=conf,
                invasive_risk_level=risk,
                top_predictions=top_preds,
            )

        except Exception as e:
            print(f"[ML] Prediction error: {e}")
            import traceback; traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"ML prediction failed: {str(e)}")
    else:
        # ── Fallback: mock prediction ──
        import random
        SPECIES_DB = [
            ("Giant Hogweed", "high"),
            ("Himalayan Balsam", "high"),
            ("Floating Pennywort", "high"),
            ("Boar", "high"),
            ("Raccoon", "high"),
            ("Snake", "high"),
            ("Non Invasive", "low"),
            ("Coyote", "medium"),
        ]
        species_name, risk_level = random.choice(SPECIES_DB)
        confidence = round(random.uniform(0.55, 0.95), 2)
        return PredictResponse(
            species_name=species_name,
            confidence_score=confidence,
            invasive_risk_level=risk_level,
            top_predictions=[{
                "species_name": species_name,
                "confidence": confidence,
                "risk_level": risk_level,
            }],
        )


# ── Reports ───────────────────────────────────────────────────────────────────

REPORTS_STORE: list[dict] = []
REPORTS_FILE = Path(__file__).parent / "reports_store.json"
USERS_FILE  = Path(__file__).parent / "users_store.json"

def _load_reports():
    """Load persisted reports from disk, deduplicating by id."""
    global REPORTS_STORE
    if REPORTS_FILE.exists():
        try:
            with open(REPORTS_FILE, "r") as f:
                raw = json.load(f)
            seen: set[str] = set()
            deduped = []
            for r in raw:
                if r.get("id") not in seen:
                    seen.add(r["id"])
                    deduped.append(r)
            REPORTS_STORE = deduped
            print(f"[DB] Loaded {len(REPORTS_STORE)} reports from disk")
        except Exception as e:
            print(f"[DB] Could not load reports: {e}")
            REPORTS_STORE = []

def _save_reports():
    """Persist reports to disk."""
    try:
        with open(REPORTS_FILE, "w") as f:
            json.dump(REPORTS_STORE, f, default=str)
    except Exception as e:
        print(f"[DB] Could not save reports: {e}")

def _load_users():
    """Load persisted registered users from disk."""
    global USERS_DB
    if USERS_FILE.exists():
        try:
            with open(USERS_FILE, "r") as f:
                saved = json.load(f)
            # Merge saved users in, preserving seed accounts
            for uid, udata in saved.items():
                if uid not in USERS_DB:
                    USERS_DB[uid] = udata
            print(f"[DB] Loaded {len(saved)} users from disk")
        except Exception as e:
            print(f"[DB] Could not load users: {e}")

def _save_users():
    """Persist all users to disk (excluding password hashes for safety is optional; keep them for login to work)."""
    try:
        with open(USERS_FILE, "w") as f:
            json.dump(USERS_DB, f, default=str)
    except Exception as e:
        print(f"[DB] Could not save users: {e}")

_load_users()
_seed_default_users()
_load_reports()

@app.post("/reports", status_code=201)
async def create_report(
    id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    timestamp: str = Form(...),
    notes: str = Form(default=""),
    userId: str = Form(...),
    prediction: str = Form(default=""),
    image: UploadFile = File(...),
    audio: Optional[UploadFile] = File(default=None),
):
    """Accepts a report upload including optional audio."""
    # Resolve user name
    user_info = USERS_DB.get(userId)
    user_name = user_info["name"] if user_info else "Unknown"
    user_email = user_info["email"] if user_info else ""

    report_data = {
        "id": id,
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": timestamp,
        "notes": notes,
        "userId": userId,
        "userName": user_name,
        "userEmail": user_email,
        "prediction": json.loads(prediction) if prediction else None,
        "has_image": True,
        "has_audio": audio is not None,
        "created_at": time.time(),
    }

    # Save image
    uploads_dir = Path(__file__).parent / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    img_path = uploads_dir / f"{id}_image.jpg"
    with open(img_path, "wb") as f:
        f.write(await image.read())

    # Save audio if present
    if audio:
        audio_path = uploads_dir / f"{id}_audio.m4a"
        with open(audio_path, "wb") as f:
            f.write(await audio.read())

    # Deduplicate: replace existing report with same ID, or append new
    existing_idx = next((i for i, r in enumerate(REPORTS_STORE) if r["id"] == id), None)
    if existing_idx is not None:
        REPORTS_STORE[existing_idx] = report_data
        print(f"[Report] UPDATED id={id} (duplicate submission)")
    else:
        REPORTS_STORE.append(report_data)
        print(f"[Report] NEW id={id} user={userId} lat={latitude} lon={longitude} audio={audio is not None}")
    _save_reports()
    return {"status": "ok", "id": id}


@app.get("/reports")
async def list_reports():
    """Return all reports with image/audio paths so every user can see them."""
    enriched = []
    for r in REPORTS_STORE:
        report = {**r}
        report["image_path"] = f"/uploads/{r['id']}_image.jpg"
        if r.get("has_audio"):
            report["audio_path"] = f"/uploads/{r['id']}_audio.m4a"
        enriched.append(report)
    enriched.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    return enriched

# ── Serve uploaded images ──────────────────────────────────────────────────

@app.get("/uploads/{filename}")
async def serve_upload(filename: str):
    uploads_dir = Path(__file__).parent / "uploads"
    file_path = uploads_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    # Determine media type
    if filename.endswith(".jpg") or filename.endswith(".jpeg"):
        media = "image/jpeg"
    elif filename.endswith(".png"):
        media = "image/png"
    elif filename.endswith(".m4a"):
        media = "audio/mp4"
    else:
        media = "application/octet-stream"
    return FileResponse(str(file_path), media_type=media)


# ── Admin Endpoints ────────────────────────────────────────────────────────

async def require_admin(creds: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency that requires a valid admin token."""
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = USERS_DB.get(payload.get("sub"))
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@app.get("/admin/reports")
async def admin_list_reports(admin=Depends(require_admin)):
    """Return all reports. image_path is a relative /uploads/... path;
    the frontend prepends API_BASE_URL to form the full image URL."""
    enriched = []
    for r in REPORTS_STORE:
        report = {**r}
        # Relative paths — frontend builds full URL using its API_BASE_URL
        report["image_path"] = f"/uploads/{r['id']}_image.jpg"
        if r.get("has_audio"):
            report["audio_path"] = f"/uploads/{r['id']}_audio.m4a"
        enriched.append(report)
    # Most recent first
    enriched.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    return enriched


@app.get("/admin/stats")
async def admin_stats(admin=Depends(require_admin)):
    """Dashboard statistics for admin."""
    total_reports = len(REPORTS_STORE)
    total_users = len([u for u in USERS_DB.values() if u["role"] == "user"])
    total_admins = len([u for u in USERS_DB.values() if u["role"] == "admin"])

    # Species distribution
    species_counts: dict[str, int] = {}
    high_risk_count = 0
    for r in REPORTS_STORE:
        pred = r.get("prediction")
        if pred:
            name = pred.get("species_name", "Unknown")
            species_counts[name] = species_counts.get(name, 0) + 1
            if pred.get("invasive_risk_level") == "high":
                high_risk_count += 1

    # Users list (excluding passwords)
    users_list = [
        {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"]}
        for u in USERS_DB.values()
    ]

    return {
        "total_reports": total_reports,
        "total_users": total_users,
        "total_admins": total_admins,
        "high_risk_reports": high_risk_count,
        "species_distribution": species_counts,
        "users": users_list,
    }


@app.get("/admin/users")
async def admin_list_users(admin=Depends(require_admin)):
    """List all registered users (no password hashes)."""
    return [
        {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"]}
        for u in USERS_DB.values()
    ]

# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "ml_model_loaded": animal_model is not None and plant_model is not None,
        "animal_model_loaded": animal_model is not None,
        "plant_model_loaded": plant_model is not None,
        "users_count": len(USERS_DB),
        "reports_count": len(REPORTS_STORE),
    }

# ── Alert Locals (Twilio) ─────────────────────────────────────────────────────

class AlertLocalsRequest(BaseModel):
    species: str = "Unknown species"
    location: str = "Unknown location"

@app.post("/alert-locals")
async def alert_locals(req: AlertLocalsRequest):
    """
    Trigger a Twilio voice call to alert local contacts about an invasive species.
    Runs the call.js script in the project root.
    """
    call_js = Path(__file__).parent.parent / "call.js"
    if not call_js.exists():
        raise HTTPException(status_code=500, detail="call.js not found")

    try:
        result = subprocess.run(
            ["node", str(call_js), req.species, req.location],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            return {"status": "ok", "message": "Alert call initiated", "output": result.stdout.strip()}
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Twilio call failed: {result.stderr.strip() or result.stdout.strip()}",
            )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Call script timed out")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Node.js not found. Please install Node.js.")
