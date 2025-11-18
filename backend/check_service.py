import uuid
from app.database import SessionLocal
from app.services.note_service import NoteService

note_id = uuid.UUID('55efd1ed-5000-495a-b520-86f7f7b8b625')
with SessionLocal() as session:
    service = NoteService(session)
    note = service.get_note_by_id(note_id, 'test-device')
    print('note found?', bool(note))
    if note:
        print('title:', note.title)
