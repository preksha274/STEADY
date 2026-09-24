import os
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
backend_dir = os.path.dirname(os.path.abspath(__file__))

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    print("PASSED: GET /health")

def test_imu_tremor_demo():
    file_path = os.path.join(backend_dir, "demo_imu_tremor.csv")
    with open(file_path, "rb") as f:
        response = client.post("/analyze/imu", files={"file": ("demo_imu_tremor.csv", f, "text/csv")})

    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    metrics = data["metrics"]
    quality = data["quality"]

    freq = metrics["tremor_frequency_hz"]
    print(f"IMU Tremor Demo -> Detected Frequency: {freq} Hz, Amplitude: {metrics['tremor_amplitude']}, Intensity: {metrics['intensity']}")
    print(f"IMU Tremor Quality -> Duration: {quality['duration_s']}s, Confidence: {data['confidence']}")

    # Requirement check: Tremor demo file should report dominant frequency near 4.8 Hz (e.g. 4.6 to 5.0 Hz)
    assert 4.5 <= freq <= 5.1, f"Expected frequency near 4.8 Hz, got {freq} Hz"
    assert data["confidence"] == "high"
    print("PASSED: POST /analyze/imu demo_imu_tremor.csv (4.8 Hz verified)")

def test_imu_short_demo():
    file_path = os.path.join(backend_dir, "demo_imu_short.csv")
    with open(file_path, "rb") as f:
        response = client.post("/analyze/imu", files={"file": ("demo_imu_short.csv", f, "text/csv")})

    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    quality = data["quality"]

    print(f"IMU Short Demo -> Duration: {quality['duration_s']}s, Short flag: {quality['is_short']}, Confidence: {data['confidence']}")
    assert quality["is_short"] is True
    assert data["confidence"] in ["medium", "low"]
    print("PASSED: POST /analyze/imu demo_imu_short.csv (Short duration verified)")

def test_eeg_demo():
    file_path = os.path.join(backend_dir, "demo_eeg.csv")
    with open(file_path, "rb") as f:
        response = client.post("/analyze/eeg", files={"file": ("demo_eeg.csv", f, "text/csv")})

    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    powers = data["band_powers"]

    print(f"EEG Demo -> Channel count: {data['channel_count']}")
    print(f"EEG Band Powers -> Alpha Rel: {powers['alpha']['relative']}, Beta Rel: {powers['beta']['relative']}")
    print(f"EEG Quality -> Duration: {data['quality']['duration_s']}s, Confidence: {data['confidence']}")

    assert data["channel_count"] == 4
    assert powers["alpha"]["relative"] > 0.1
    assert powers["beta"]["relative"] > 0.1
    assert data["confidence"] == "high"
    print("PASSED: POST /analyze/eeg demo_eeg.csv (Alpha & Beta powers verified)")

if __name__ == "__main__":
    test_health()
    test_imu_tremor_demo()
    test_imu_short_demo()
    test_eeg_demo()
    print("\n==========================================")
    print("ALL BACKEND ENDPOINTS AND DEMO FILES PASSED!")
    print("==========================================")
