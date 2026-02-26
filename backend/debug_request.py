from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app=app, raise_server_exceptions=False)

with open('test_upload.png', 'rb') as f:
    files = {'file': ('test_upload.png', f, 'image/png')}
    response = client.post(
        '/api/v1/library/notes/from-image?device_id=test_device',
        files=files,
        data={'note_type': '学习笔记', 'tags': 'demo,测试'},
    )

print('Status:', response.status_code)
print('Body:', response.text)
