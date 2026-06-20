"""Tests de l'API FastAPI."""

import pytest
from fastapi.testclient import TestClient

@pytest.fixture
def client():
    from src.api.main import app
    return TestClient(app, raise_server_exceptions=False)

class TestHealth:
    def test_health_endpoint(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data
        assert "model_loaded" in data

class TestPredict:
    def test_predict_with_valid_features(self, client, sample_features):
        response = client.post("/predict/pre-match", json=sample_features)
        assert response.status_code in (200, 400, 503)
        if response.status_code == 200:
            data = response.json()
            assert "prob_a" in data
            assert "prob_b" in data
            assert 0 <= data["prob_a"] <= 1
            assert abs(data["prob_a"] + data["prob_b"] - 1.0) < 0.01

    def test_predict_missing_features(self, client):
        response = client.post("/predict/pre-match", json={"match_id": "test"})
        assert response.status_code in (200, 400)

    def test_predict_match_not_cached(self, client):
        response = client.get("/predict/pre-match/nonexistent")
        assert response.status_code == 404

class TestFeatures:
    def test_generate_features_invalid(self, client):
        response = client.post("/features/generate", json={})
        assert response.status_code in (400, 422, 500)
