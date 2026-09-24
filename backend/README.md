# MovePilot Backend API

FastAPI backend providing signal processing for Parkinson's IMU accelerometer tremor frequency estimation and EEG spectral band power analysis.

## Run Commands

```bash
# Activate venv
.\venv\Scripts\activate

# Generate demo CSV files
python generate_demo_data.py

# Run API test suite
python test_api.py

# Start backend server on port 8000
uvicorn main:app --reload --port 8000
```

## `curl` Examples

### IMU Tremor Analysis:
```bash
curl -X POST "http://localhost:8000/analyze/imu" -F "file=@demo_imu_tremor.csv"
```

### EEG Band Analysis:
```bash
curl -X POST "http://localhost:8000/analyze/eeg" -F "file=@demo_eeg.csv"
```
