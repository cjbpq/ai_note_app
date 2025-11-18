# -*- coding: utf-8 -*-
import json
import urllib.request
import urllib.error
import socket

BASE = 'http://127.0.0.1:8000'

def http_request(method, path, data=None, headers=None):
    url = BASE + path
    req_data = None
    if data is not None:
        req_data = json.dumps(data, ensure_ascii=False).encode('utf-8')
        headers = headers or {}
        headers.setdefault('Content-Type', 'application/json; charset=utf-8')
    req = urllib.request.Request(url, data=req_data, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode('utf-8', errors='ignore')
            try:
                body_json = json.loads(body)
            except json.JSONDecodeError:
                body_json = body
            return resp.status, body_json
    except (urllib.error.HTTPError, urllib.error.URLError, socket.timeout) as e:
        return None, str(e)

steps = []

status, body = http_request('GET', '/health')
steps.append({'step': 'GET /health', 'status': status, 'body': body})

status, body = http_request('GET', '/api/v1/library/notes?device_id=test-device')
steps.append({'step': 'GET /library/notes', 'status': status, 'body': body})

note_id = None
if isinstance(body, dict) and body.get('notes'):
    note_id = body['notes'][0]['id']

if note_id:
    status, body_detail = http_request('GET', f'/api/v1/library/notes/{note_id}?device_id=test-device')
    steps.append({'step': f'GET /library/notes/{note_id}', 'status': status, 'body': body_detail})

    status, body_fav = http_request('POST', f'/api/v1/library/notes/{note_id}/favorite?device_id=test-device')
    steps.append({'step': f'POST /library/notes/{note_id}/favorite', 'status': status, 'body': body_fav})

    status, export_body = http_request('POST', f'/api/v1/library/notes/{note_id}/export?device_id=test-device', data={'format': 'txt'})
    steps.append({'step': f'POST /library/notes/{note_id}/export', 'status': status, 'body': str(export_body)[:200] + ('...' if isinstance(export_body, str) and len(export_body) > 200 else '')})

print(json.dumps(steps, ensure_ascii=False, indent=2))
