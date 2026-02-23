# Invadr 🌿

> Offline-first invasive species reporting for farmers, hikers, and field workers.

---

## Architecture

```
Capture → Compress → Predict → Store (Offline) → Sync → Cluster → Alert
```

---

## Project Structure

```
invadr/
├── app/                        # Expo Router file-based navigation
│   ├── _layout.tsx             # Root layout (providers + auth guard)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   └── (tabs)/
│       ├── _layout.tsx         # Bottom tab navigator
│       ├── index.tsx           # Dashboard tab
│       ├── report.tsx          # Report capture tab
│       └── map.tsx             # Interactive map tab
│
├── src/
│   ├── types/                  # TypeScript interfaces
│   ├── constants/              # Colors, API config, storage keys
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Auth state (login/logout/persist)
│   │   └── ReportsContext.tsx  # Reports state + sync orchestration
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── ReportScreen.tsx    # Camera · GPS · ML · Offline save
│   │   ├── MapScreen.tsx       # Markers · Outbreak circles
│   │   └── DashboardScreen.tsx # Stats · Timeline · Species dist.
│   ├── services/
│   │   ├── apiService.ts       # Axios – /predict, /reports, /auth
│   │   ├── authService.ts      # SecureStore token management
│   │   ├── imageService.ts     # Camera capture + 512×512 compression
│   │   ├── storageService.ts   # AsyncStorage CRUD for reports
│   │   ├── syncManager.ts      # Background sync + NetInfo listener
│   │   └── outbreakService.ts  # Haversine clustering algorithm
│   └── utils/
│       └── geo.ts              # Haversine, date helpers, UUID
│
└── backend/
    ├── main.py                 # FastAPI mock server
    └── requirements.txt
```

---

## Quick Start

### Prerequisites
- **Node.js 18+** and **npm**
- **Python 3.10+**
- **Expo Go (SDK 54)** installed on your phone
- Phone and PC on the **same WiFi network**

### 1. Install dependencies

```bash
npm install
```

> A `.npmrc` file with `legacy-peer-deps=true` is included to avoid peer dependency conflicts.

### 2. Start the mock backend

```bash
cd backend
```

First time only — create a virtual environment and install packages:
```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

Start the server (host `0.0.0.0` makes it reachable from your phone):
```bash
.venv\Scripts\uvicorn.exe main:app --port 8000 --host 0.0.0.0 --reload
```

### 3. Set your machine's local IP

Find your WiFi IP on Windows:
```powershell
ipconfig  # look for "IPv4 Address" under your WiFi adapter
```

Edit `src/constants/index.ts`:
```ts
export const API_BASE_URL = 'http://YOUR_WIFI_IP:8000';
```

### 4. Open firewall for Metro and backend

Run in PowerShell (Administrator):
```powershell
netsh advfirewall firewall add rule name="Expo Metro" dir=in action=allow protocol=TCP localport=8081
netsh advfirewall firewall add rule name="FastAPI" dir=in action=allow protocol=TCP localport=8000
```

### 5. Start the app

```bash
npx expo start --lan --clear
```

Scan the QR code with **Expo Go** on your phone.

### Login credentials

The mock backend accepts **any** email and password combination. For example:

```
Email:    test@invadr.com
Password: password123
```

---

## Key Features

### Offline-First
- All reports are saved to **AsyncStorage** immediately
- Network reconnection triggers automatic background sync via **NetInfo**
- Each report carries a sync status: 🟡 Pending · 🔵 Syncing · 🟢 Uploaded

### Image Optimization
- Camera capture only (no gallery selection)
- Auto-resize to **512×512** px
- JPEG compression at **0.65** quality → target < 300 KB

### ML Prediction
- Sends compressed image to `POST /predict`
- Returns `species_name`, `confidence_score`, `invasive_risk_level`
- If offline, prediction runs during the next sync cycle

### Outbreak Detection (Haversine Clustering)
Triggers a **High Risk Zone** when:
- ≥ 5 high-confidence invasive reports
- Within a **5 km** radius
- Within the last **7 days**

Zones are rendered as red overlay circles on the map.

### Map Screen
- **React Native Maps** with `hybrid` tile layer
- Marker colours: green (low) · orange (medium) · red (high)
- Tap a marker to view species details
- Outbreak circles labelled "⚠️ High Risk Zone"

---

## Configuration

All tunable values are centralised in `src/constants/index.ts`:

| Constant | Default | Purpose |
|---|---|---|
| `API_BASE_URL` | `http://YOUR_WIFI_IP:8000` | Backend URL — set to your machine's local IP |
| `IMAGE_CONFIG.WIDTH/HEIGHT` | `512` | Resize dimensions |
| `IMAGE_CONFIG.COMPRESS` | `0.65` | JPEG quality |
| `OUTBREAK_CONFIG.MIN_REPORTS` | `5` | Cluster threshold |
| `OUTBREAK_CONFIG.RADIUS_KM` | `5` | Cluster radius |
| `OUTBREAK_CONFIG.TIME_WINDOW_DAYS` | `7` | Lookback window |
| `OUTBREAK_CONFIG.MIN_CONFIDENCE` | `0.75` | ML confidence gate |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript |
| Navigation | Expo Router v6 (file-based) |
| Offline Storage | AsyncStorage |
| Network Detection | @react-native-community/netinfo |
| Secure Token Storage | expo-secure-store |
| Camera + Compression | expo-image-picker + expo-image-manipulator |
| GPS | expo-location |
| HTTP Client | Axios |
| Map | react-native-maps |
| Backend | FastAPI (Python) |
