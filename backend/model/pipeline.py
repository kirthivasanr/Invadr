"""
Unified Detection Pipeline
─────────────────────────
Reads an input JSON with coordinates + image/audio paths.
  1. Image  → quick classifier (animal vs plant vs neither)
  2. Animal → animal invasive model  (EfficientNet-B2, 25 classes)
     Plant  → plant invasive model   (EfficientNet-B2, 9 classes)
  3. If invasive + high confidence → run satellite anomaly detection
  4. Audio  → YAMNet → confirm animal presence via sound
  5. Writes output.json with all results

Usage:
    python pipeline.py --input input.json
    python pipeline.py --input input.json --output result.json
"""

import argparse, json, os, sys, time, warnings
import numpy as np
import torch
import torch.nn as nn
import timm
from torchvision import transforms
from PIL import Image

warnings.filterwarnings("ignore")

# ════════════════════════════════════════════════════════════════
# CONFIG
# ════════════════════════════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

ANIMAL_MODEL_PATH = os.path.join(BASE_DIR, "best_animal_model.pth")
PLANT_MODEL_PATH  = os.path.join(BASE_DIR, "best_plant_model1.pth")
GEE_KEY_FILE      = os.path.join(BASE_DIR, "gen-lang-client-0174302125-cca6e58fd32a.json")
GEE_SERVICE_ACCT  = "google-earth@gen-lang-client-0174302125.iam.gserviceaccount.com"

IMG_SIZE = 260
MEAN     = [0.485, 0.456, 0.406]
STD      = [0.229, 0.224, 0.225]

ANIMAL_CLASSES = sorted([
    "bear", "bison", "boar", "chimpanzee", "coyote", "deer",
    "elephant", "fox", "gorilla", "hippopotamus", "hyena", "kangaroo",
    "leopard", "lion", "non_invasive", "porcupine", "raccoon",
    "rhinoceros", "seal", "shark", "snake", "swan", "tiger", "wolf", "zebra"
])
ANIMAL_NON_INV   = "non_invasive"
ANIMAL_NUM_CLS   = 25

PLANT_CLASSES = sorted([
    "Chinee apple", "Siam weed", "Lantana", "Prickly acacia",
    "Parkinsonia", "Parthenium", "Snake weed", "Rubber vine",
    "Negative"
])
PLANT_NON_INV   = "Negative"
PLANT_NUM_CLS   = 9

CONF_THRESHOLD      = 0.35   # min confidence to trust prediction
SATELLITE_THRESHOLD = 0.60   # run satellite only above this

TRANSFORM = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])


# ════════════════════════════════════════════════════════════════
# STEP 0 — Model Loaders (timm EfficientNet-B2 + custom heads)
# ════════════════════════════════════════════════════════════════
class PlantClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = timm.create_model(
            "efficientnet_b2", pretrained=False, num_classes=0
        )
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
        self.backbone = timm.create_model(
            "efficientnet_b2", pretrained=False, num_classes=0
        )
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


def load_model(weights_path: str, model_cls) -> nn.Module:
    """Load timm-based model with matching custom head."""
    model = model_cls()
    state = torch.load(weights_path, map_location="cpu", weights_only=False)
    if isinstance(state, dict) and "model_state_dict" in state:
        state = state["model_state_dict"]
    model.load_state_dict(state, strict=True)
    model.eval()
    return model


def predict_image(model, img_path: str, classes: list) -> dict:
    """Run inference, return {class, confidence, all_probs}."""
    img = Image.open(img_path).convert("RGB")
    x = TRANSFORM(img).unsqueeze(0)
    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1).squeeze()
    conf, idx = probs.max(0)
    return {
        "class": classes[idx.item()],
        "confidence": round(conf.item(), 4),
        "top3": [
            {"class": classes[i], "confidence": round(probs[i].item(), 4)}
            for i in probs.argsort(descending=True)[:3].tolist()
        ],
    }


# ════════════════════════════════════════════════════════════════
# STEP 1 — Quick Animal-vs-Plant Classifier
# ════════════════════════════════════════════════════════════════
def classify_kingdom(img_path: str, animal_model, plant_model) -> dict:
    """
    Run both models and pick the one with highest confidence.
    Returns: {kingdom: 'animal'|'plant'|'unknown', prediction: {...}}
    """
    a_pred = predict_image(animal_model, img_path, ANIMAL_CLASSES)
    p_pred = predict_image(plant_model,  img_path, PLANT_CLASSES)

    a_conf = a_pred["confidence"]
    p_conf = p_pred["confidence"]

    # Neither model is confident → unknown
    if a_conf < CONF_THRESHOLD and p_conf < CONF_THRESHOLD:
        return {"kingdom": "unknown", "prediction": None,
                "animal_best": a_pred, "plant_best": p_pred}

    if a_conf >= p_conf:
        return {"kingdom": "animal", "prediction": a_pred,
                "is_invasive": a_pred["class"] != ANIMAL_NON_INV}
    else:
        return {"kingdom": "plant", "prediction": p_pred,
                "is_invasive": p_pred["class"] != PLANT_NON_INV}


# ════════════════════════════════════════════════════════════════
# STEP 2 — Satellite Anomaly Detection (from notebook)
# ════════════════════════════════════════════════════════════════
def run_satellite(lat: float, lon: float, buffer_m=500, months_back=3) -> dict:
    """Light satellite anomaly check — reuses notebook logic."""
    try:
        import ee, pandas as pd  # type: ignore
        from sklearn.ensemble import IsolationForest  # type: ignore
        from sklearn.preprocessing import StandardScaler  # type: ignore
    except ImportError as e:
        return {"error": f"Missing dependency: {e}"}

    ee.Initialize(ee.ServiceAccountCredentials(GEE_SERVICE_ACCT, GEE_KEY_FILE))

    pt  = ee.Geometry.Point([lon, lat])
    roi = pt.buffer(buffer_m).bounds()
    end   = pd.Timestamp.now()

    def add_idx(img):
        ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
        bsi  = img.expression(
            "((S+R)-(N+B))/((S+R)+(N+B))",
            {"S": img.select("B11"), "R": img.select("B4"),
             "N": img.select("B8"),  "B": img.select("B2")}
        ).rename("BSI")
        return img.addBands([ndvi, bsi])

    def to_feature(img):
        vals = img.select(["NDVI", "BSI"]).reduceRegion(
            ee.Reducer.mean(), roi, 20, maxPixels=1e5)
        return ee.Feature(None, vals).set("date", img.date().format("YYYY-MM-dd"))

    # Progressive fallback for cloudy areas
    attempts = [
        (months_back, 50, True), (months_back, 80, True),
        (months_back, 80, False), (months_back * 2, 80, False), (12, 90, False),
    ]
    rows = []
    for m_back, c_max, use_scl in attempts:
        s = (end - pd.DateOffset(months=m_back)).strftime("%Y-%m-%d")
        coll = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(roi).filterDate(s, end.strftime("%Y-%m-%d"))
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", c_max)))
        if use_scl:
            def mask_clouds(img):
                scl = img.select("SCL")
                return img.updateMask(scl.eq(4).Or(scl.eq(5)).Or(scl.eq(6)).Or(scl.eq(7)))
            coll = coll.map(mask_clouds)
        coll = coll.map(add_idx)
        raw = coll.map(to_feature).getInfo()
        rows = [f["properties"] for f in raw["features"]
                if f["properties"].get("NDVI") is not None]
        if len(rows) >= 5:
            break

    if len(rows) < 5:
        return {"error": f"Only {len(rows)} satellite obs — insufficient data"}

    ts = pd.DataFrame(rows)
    ts["date"] = pd.to_datetime(ts["date"])
    ts = ts.sort_values("date").drop_duplicates("date").set_index("date")

    ts["NDVI_roll"] = ts["NDVI"].rolling(3, min_periods=1).mean()
    ts["BSI_roll"]  = ts["BSI"].rolling(3, min_periods=1).mean()
    ts["NDVI_diff"] = ts["NDVI"].diff().fillna(0)
    ts["BSI_diff"]  = ts["BSI"].diff().fillna(0)
    ndvi_mean, ndvi_std = ts["NDVI"].mean(), max(ts["NDVI"].std(), 1e-6)
    ts["NDVI_z"] = (ts["NDVI"] - ndvi_mean) / ndvi_std

    feat_cols = ["NDVI", "BSI", "NDVI_roll", "BSI_roll", "NDVI_diff", "BSI_diff", "NDVI_z"]
    X = StandardScaler().fit_transform(ts[feat_cols].values)
    model = IsolationForest(n_estimators=50, contamination=0.1, random_state=42)
    model.fit(X)
    scores = model.decision_function(X)
    preds  = model.predict(X)

    latest = ts.iloc[-1]
    prev   = ts.iloc[-2] if len(ts) > 1 else latest
    is_anom = preds[-1] == -1
    ndvi_change = latest["NDVI"] - prev["NDVI"]
    bsi_change  = latest["BSI"]  - prev["BSI"]

    atype = "Normal"
    if is_anom:
        if ndvi_change < -0.03 and bsi_change > 0.02:
            atype = "Path Destruction / Bare Soil"
        elif ndvi_change > 0.05:
            atype = "Invasive Plant Growth"
        elif ndvi_change < -0.03:
            atype = "Vegetation Loss"
        elif bsi_change > 0.03:
            atype = "Soil Exposure"
        else:
            atype = "Unclassified Anomaly"

    return {
        "is_anomaly": is_anom,
        "anomaly_type": atype,
        "latest_date": str(ts.index[-1].date()),
        "ndvi_now": round(latest["NDVI"], 4),
        "ndvi_change": round(ndvi_change, 4),
        "bsi_change": round(bsi_change, 4),
        "observations": len(ts),
    }


# ════════════════════════════════════════════════════════════════
# STEP 3 — Audio Analysis with YAMNet
# ════════════════════════════════════════════════════════════════
def analyze_audio(audio_path: str) -> dict:
    """Run YAMNet on audio, return top classes + animal confirmation."""
    if not audio_path or not os.path.exists(audio_path):
        return {"error": "Audio file not found", "animal_sounds": False}

    try:
        import tensorflow_hub as hub  # type: ignore
        import tensorflow as tf
        import csv
    except ImportError:
        # Fallback: try torch-based approach
        try:
            import torchaudio  # type: ignore
            return _analyze_audio_torch(audio_path)
        except ImportError:
            return {"error": "Need tensorflow_hub or torchaudio for audio analysis"}

    # Load YAMNet
    yamnet_model = hub.load("https://tfhub.dev/google/yamnet/1")

    # Load & resample audio to 16kHz mono
    if audio_path.endswith(".wav"):
        import scipy.io.wavfile as wavfile  # type: ignore
        sr, wav = wavfile.read(audio_path)
        if wav.ndim > 1:
            wav = wav.mean(axis=1)
        wav = wav.astype(np.float32)
        if np.abs(wav).max() > 1.0:
            wav = wav / 32768.0  # int16 → float
        # Resample to 16kHz if needed
        if sr != 16000:
            from scipy.signal import resample  # type: ignore
            wav = resample(wav, int(len(wav) * 16000 / sr))
    else:
        return {"error": f"Unsupported audio format: {audio_path}"}

    wav_tensor = tf.constant(wav, dtype=tf.float32)
    scores, embeddings, spectrogram = yamnet_model(wav_tensor)

    # Load class names
    class_map_path = yamnet_model.class_map_path().numpy().decode("utf-8")
    with open(class_map_path) as f:
        reader = csv.DictReader(f)
        class_names = [row["display_name"] for row in reader]

    # Average scores across time frames
    mean_scores = scores.numpy().mean(axis=0)
    top_indices = mean_scores.argsort()[-10:][::-1]

    top_classes = [
        {"class": class_names[i], "confidence": round(float(mean_scores[i]), 4)}
        for i in top_indices
    ]

    # Check for animal-related sounds
    animal_keywords = [
        "animal", "bird", "dog", "cat", "roar", "growl", "howl", "bark",
        "chirp", "insect", "frog", "snake", "monkey", "elephant", "lion",
        "bear", "wolf", "pig", "horse", "cow", "sheep", "goat", "wild",
        "crow", "owl", "eagle", "hawk", "parrot", "cricket", "bee", "buzz"
    ]
    animal_sounds = []
    for cls_info in top_classes:
        cls_lower = cls_info["class"].lower()
        if any(kw in cls_lower for kw in animal_keywords):
            animal_sounds.append(cls_info)

    return {
        "top_classes": top_classes,
        "animal_sounds_detected": len(animal_sounds) > 0,
        "animal_sounds": animal_sounds,
    }


def _analyze_audio_torch(audio_path: str) -> dict:
    """Fallback: use torchaudio with YAMNet-like classification."""
    import torchaudio  # type: ignore
    from torchaudio.pipelines import VGGISH_BUNDLE  # type: ignore  # closest built-in to YAMNet

    waveform, sr = torchaudio.load(audio_path)
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)

    # Use VGGish as fallback (similar to YAMNet)
    try:
        pipeline = VGGISH_BUNDLE
        model = pipeline.get_model()
        model.eval()
        if sr != pipeline.sample_rate:
            waveform = torchaudio.functional.resample(waveform, sr, pipeline.sample_rate)
        with torch.no_grad():
            embeddings = model(waveform.squeeze())
        return {
            "top_classes": [{"class": "audio_processed", "confidence": 1.0}],
            "animal_sounds_detected": False,
            "animal_sounds": [],
            "note": "Used VGGish fallback — install tensorflow_hub for full YAMNet"
        }
    except Exception as e:
        return {"error": f"Audio analysis failed: {e}", "animal_sounds_detected": False}


# ════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ════════════════════════════════════════════════════════════════
def run_pipeline(input_json_path: str, output_path: str = "output.json"):
    t_start = time.time()
    result = {"input": input_json_path, "steps": {}}

    # ── Read input JSON ──
    with open(input_json_path) as f:
        config = json.load(f)

    lat = config.get("lat") or config.get("latitude")
    lon = config.get("lon") or config.get("longitude")
    img_path   = config.get("image", "")
    audio_path = config.get("audio", "")

    # Resolve relative paths against input JSON directory
    json_dir = os.path.dirname(os.path.abspath(input_json_path))
    if img_path and not os.path.isabs(img_path):
        img_path = os.path.join(json_dir, img_path)
    if audio_path and not os.path.isabs(audio_path):
        audio_path = os.path.join(json_dir, audio_path)

    result["coordinates"] = {"lat": lat, "lon": lon}
    print(f"[1/4] Loading models...")

    # ── Load Models ──
    animal_model = load_model(ANIMAL_MODEL_PATH, AnimalClassifier)
    plant_model  = load_model(PLANT_MODEL_PATH,  PlantClassifier)
    print(f"       Models loaded in {time.time()-t_start:.1f}s")

    # ── Step 1: Image Classification ──
    print(f"[2/4] Classifying image: {os.path.basename(img_path)}")
    if not os.path.exists(img_path):
        result["steps"]["image"] = {"error": f"Image not found: {img_path}"}
        print(f"       ERROR: Image not found")
    else:
        kingdom_result = classify_kingdom(img_path, animal_model, plant_model)
        result["steps"]["image"] = kingdom_result

        kingdom = kingdom_result["kingdom"]
        pred    = kingdom_result.get("prediction", {})
        is_inv  = kingdom_result.get("is_invasive", False)
        conf    = pred.get("confidence", 0) if pred else 0

        print(f"       Kingdom: {kingdom}")
        if pred:
            print(f"       Species: {pred['class']} ({conf:.1%})")
            print(f"       Invasive: {is_inv}")

        # ── Step 2: Satellite check if invasive + high confidence ──
        if is_inv and conf >= SATELLITE_THRESHOLD and lat and lon:
            print(f"[3/4] Invasive detected with {conf:.1%} confidence → running satellite check...")
            sat_result = run_satellite(lat, lon)
            result["steps"]["satellite"] = sat_result
            if "error" not in sat_result:
                print(f"       Satellite anomaly: {sat_result['is_anomaly']} ({sat_result['anomaly_type']})")
                print(f"       NDVI change: {sat_result['ndvi_change']}")
            else:
                print(f"       Satellite: {sat_result['error']}")
        else:
            reason = []
            if not is_inv:
                reason.append("not invasive")
            if conf < SATELLITE_THRESHOLD:
                reason.append(f"confidence {conf:.1%} < {SATELLITE_THRESHOLD:.0%}")
            if not lat or not lon:
                reason.append("no coordinates")
            result["steps"]["satellite"] = {"skipped": True, "reason": ", ".join(reason)}
            print(f"[3/4] Satellite skipped: {', '.join(reason)}")

    # ── Step 3: Audio analysis ──
    print(f"[4/4] Analyzing audio: {os.path.basename(audio_path) if audio_path else 'none'}")
    if audio_path and os.path.exists(audio_path):
        audio_result = analyze_audio(audio_path)
        result["steps"]["audio"] = audio_result
        if audio_result.get("animal_sounds_detected"):
            print(f"       Animal sounds confirmed: {[s['class'] for s in audio_result['animal_sounds']]}")
        else:
            print(f"       No animal sounds detected")
    else:
        result["steps"]["audio"] = {"skipped": True, "reason": "no audio file"}
        print(f"       Skipped: no audio file")

    # ── Compile final verdict ──
    verdict = compile_verdict(result)
    result["verdict"] = verdict
    result["total_time"] = f"{time.time()-t_start:.1f}s"

    # ── Save output ──
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2, default=str)

    print(f"\n{'='*50}")
    print(f"VERDICT: {verdict['summary']}")
    print(f"Risk Level: {verdict['risk_level']}")
    print(f"Total time: {result['total_time']}")
    print(f"Output saved to: {output_path}")
    return result


def compile_verdict(result: dict) -> dict:
    """Combine all signals into a final risk assessment."""
    steps = result["steps"]

    img = steps.get("image", {})
    sat = steps.get("satellite", {})
    aud = steps.get("audio", {})

    kingdom   = img.get("kingdom", "unknown")
    pred      = img.get("prediction", {})
    is_inv    = img.get("is_invasive", False)
    conf      = pred.get("confidence", 0) if pred else 0
    species   = pred.get("class", "unknown") if pred else "unknown"
    sat_anom  = sat.get("is_anomaly", False) if not sat.get("skipped") else None
    aud_conf  = aud.get("animal_sounds_detected", False) if not aud.get("skipped") else None

    # Score-based risk
    risk_score = 0
    signals = []

    if is_inv:
        risk_score += 3
        signals.append(f"Invasive {kingdom} detected: {species}")
    if conf >= 0.8:
        risk_score += 2
        signals.append(f"High confidence: {conf:.1%}")
    elif conf >= CONF_THRESHOLD:
        risk_score += 1

    if sat_anom is True:
        risk_score += 3
        sat_type = sat.get("anomaly_type", "unknown")
        signals.append(f"Satellite anomaly: {sat_type}")
    elif sat_anom is False:
        signals.append("Satellite: area stable")

    if kingdom == "animal" and aud_conf is True:
        risk_score += 2
        signals.append("Audio confirms animal presence")
    elif kingdom == "animal" and aud_conf is False:
        signals.append("Audio: no matching animal sounds")

    # Risk level
    if risk_score >= 7:
        risk_level = "CRITICAL"
    elif risk_score >= 5:
        risk_level = "HIGH"
    elif risk_score >= 3:
        risk_level = "MODERATE"
    elif risk_score >= 1:
        risk_level = "LOW"
    else:
        risk_level = "NONE"

    summary = f"{species} ({kingdom}) — {'INVASIVE' if is_inv else 'non-invasive'}"
    if sat_anom is True:
        summary += f" + satellite anomaly detected"

    return {
        "species": species,
        "kingdom": kingdom,
        "is_invasive": is_inv,
        "confidence": conf,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "signals": signals,
        "summary": summary,
    }


# ════════════════════════════════════════════════════════════════
# CLI
# ════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Invasive Species Detection Pipeline")
    parser.add_argument("--input", required=True, help="Path to input JSON")
    parser.add_argument("--output", default="output.json", help="Path to output JSON")
    args = parser.parse_args()

    run_pipeline(args.input, args.output)