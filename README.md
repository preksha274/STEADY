# MovePilot - Parkinson's Movement Companion

A responsive web app and digital movement companion designed to empower Parkinson's patients through real-time IMU tremor analysis, EEG spectral band processing, personalized Move Coach sessions, and daily mobility forecasting.

---

## 🚀 Quick Start Guide

### 1. Backend Setup & Server Execution (Python FastAPI)

Navigate to the `backend/` directory:

```bash
cd backend

# Create & activate virtual environment (Windows)
python -m venv venv
.\venv\Scripts\activate

# Install backend dependencies
pip install -r requirements.txt

# Generate demo datasets (demo_imu_tremor.csv, demo_imu_short.csv, demo_eeg.csv)
python generate_demo_data.py

# Run unit tests to verify algorithms & endpoints
python test_api.py

# Start FastAPI server on port 8000
uvicorn main:app --reload --port 8000
```

The backend server will run at `http://localhost:8000`.  
Swagger API Docs available at: `http://localhost:8000/docs`

---

### 2. Frontend Setup (Next.js + TypeScript + Tailwind)

In a separate terminal, navigate to the `frontend/` directory:

```bash
cd frontend

# Install Node.js dependencies
npm install

# Start Next.js development server on port 3000
npm run dev
```

The web application will open at `http://localhost:3000`.

---

## 📡 API Endpoints & `curl` Examples

### Health Check
```bash
curl -X GET http://localhost:8000/health
```

### 1. Analyze IMU Accelerometer & Gyroscope CSV (`POST /analyze/imu`)
```bash
curl -X POST "http://localhost:8000/analyze/imu" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@backend/demo_imu_tremor.csv"
```
*Expected Output:*
- `metrics.tremor_frequency_hz`: ~4.75–4.8 Hz dominant resting tremor
- `metrics.intensity`: `high` / `moderate` / `mild`
- `quality`: `{ duration_s: 30.0, is_short: false, is_noisy: false }`
- `confidence`: `high`

### 2. Analyze EEG Spectral Band Powers (`POST /analyze/eeg`)
```bash
curl -X POST "http://localhost:8000/analyze/eeg" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@backend/demo_eeg.csv"
```
*Expected Output:*
- `band_powers`: Absolute & relative Delta (0.5–4Hz), Theta (4–8Hz), Alpha (8–13Hz), Beta (13–30Hz)
- `quality`: `{ flat_channels: [], artifact_channels: [], line_noise_present: false }`
- `confidence`: `high`

---

## 📊 Demo Datasets Located at:
- `frontend/public/demo/demo_imu_tremor.csv` (30s at 100 Hz, 4.8 Hz tremor)
- `frontend/public/demo/demo_imu_short.csv` (5s at 100 Hz, short duration quality trigger)
- `frontend/public/demo/demo_eeg.csv` (60s at 250 Hz, 4 channels with alpha & beta power)
