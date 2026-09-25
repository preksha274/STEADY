import asyncio
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_clinical_scores():
    print("\n--- TESTING CLINICAL SCORES API ---")
    
    # 1. Post a valid MDS-UPDRS Part III score
    payload = {
        "patient_id": "test_patient_01",
        "author_user_id": "test_patient_01",
        "author_role": "patient",
        "scale": "MDS-UPDRS",
        "part": "III",
        "score": 30.0,
        "max_score": 132.0,
        "clinician_name": "Dr. Thorne",
        "date_recorded": "2026-09-25",
        "notes": "Follow-up clinic visit. Good response to morning dose."
    }
    res = client.post("/api/v1/clinical-scores", json=payload)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["part"] == "III"
    assert data["score"] == 30.0
    print("[PASSED] POST /api/v1/clinical-scores created score successfully")

    # 2. Test invalid part validation
    bad_part_payload = {**payload, "part": "V"}
    res_bad = client.post("/api/v1/clinical-scores", json=bad_part_payload)
    assert res_bad.status_code == 400
    print("[PASSED] Invalid MDS-UPDRS part rejected with 400")

    # 3. Test score exceeding max_score
    bad_score_payload = {**payload, "score": 150.0}
    res_bad_score = client.post("/api/v1/clinical-scores", json=bad_score_payload)
    assert res_bad_score.status_code == 400
    print("[PASSED] Score exceeding maximum rejected with 400")

    # 4. List scores
    res_list = client.get("/api/v1/clinical-scores?patient_id=test_patient_01")
    assert res_list.status_code == 200
    scores = res_list.json()
    assert len(scores) >= 1
    assert scores[0]["score"] == 30.0
    print(f"[PASSED] GET /api/v1/clinical-scores returned {len(scores)} record(s)")

    print("\nALL CLINICAL SCORES API TESTS PASSED!\n")

if __name__ == "__main__":
    test_clinical_scores()
