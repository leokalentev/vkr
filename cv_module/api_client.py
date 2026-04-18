import requests


class BackendApiClient:
    def __init__(self, base_url: str, token: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _headers(self) -> dict:
        headers = {
            "Content-Type": "application/json",
        }

        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        return headers

    def send_engagement_metrics(self, payload: dict) -> dict:
        url = f"{self.base_url}/engagement-metrics/"
        response = requests.post(url, json=payload, headers=self._headers(), timeout=60)

        if response.status_code >= 400:
            raise RuntimeError(
                f"Ошибка отправки engagement metrics: "
                f"{response.status_code} {response.text}"
            )

        return response.json()