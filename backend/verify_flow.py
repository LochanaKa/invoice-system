import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import main
from fastapi.testclient import TestClient

client = TestClient(main.app)

resp = client.post('/api/auth/login', data={'username': 'admin', 'password': 'admin'})
print('LOGIN_STATUS', resp.status_code)
print(resp.text[:500])
