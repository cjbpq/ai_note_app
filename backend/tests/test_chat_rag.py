import uuid
from datetime import datetime, timezone
import json
import time

import pytest

from app.database import SessionLocal
from app.models.note import Note
from app.services.chat_service import ChatService, classify_chat_intent
from app.services.nexoradb_service import NexoraDBClient, NexoraDBError
from app.services.note_index_service import NoteIndexService
from app.services.note_service import NoteService


class FakeVectorClient:
    is_configured = True

    def __init__(self):
        self.upserts = []
        self.queries = []
        self.deleted_notes = []

    def upsert_texts(self, *, user_id, items, library="notes"):
        materialized = list(items)
        self.upserts.append((user_id, materialized, library))
        return [f"vec-{item['chunk_id']}" for item in materialized]

    def query_text(self, *, user_id, text, top_k, where=None, library="notes"):
        self.queries.append({"user_id": user_id, "text": text, "top_k": top_k, "where": where, "library": library})
        return []

    def delete_note(self, *, user_id, note_id):
        self.deleted_notes.append((user_id, note_id))
        return True


class FakeChatModel:
    def __init__(self):
        self.stream_calls = []

    def generate_title(self, first_message):
        return "测试对话"

    def stream_chat(self, messages, **kwargs):
        self.stream_calls.append({"messages": messages, "kwargs": kwargs})
        yield "这是"
        yield "回答"


class ToolCallingChatModel(FakeChatModel):
    def stream_chat(self, messages, **kwargs):
        self.stream_calls.append({"messages": messages, "kwargs": kwargs})
        yield "这是模型回答。"
        yield {
            "type": "tool_calls",
            "tool_calls": [
                {
                    "index": 0,
                    "id": "call_propose_note",
                    "type": "function",
                    "function": {
                        "name": "propose_note",
                        "arguments": json.dumps(
                            {
                                "title": "费曼学习法",
                                "content": "费曼学习法要求先用自己的话解释概念，再找出卡住的部分。",
                                "reason": "这是可复习的方法论结论。",
                                "tags": ["学习法"],
                            },
                            ensure_ascii=False,
                        ),
                    },
                }
            ],
        }


class UsageChatModel(FakeChatModel):
    def stream_chat(self, messages, **kwargs):
        self.stream_calls.append({"messages": messages, "kwargs": kwargs})
        yield "answer"
        yield {
            "type": "usage",
            "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 20,
                "total_tokens": 120,
                "cached_tokens": 60,
                "cache_hit": True,
                "cache_hit_ratio": 0.6,
            },
        }


class ReasoningChatModel(FakeChatModel):
    def stream_chat(self, messages, **kwargs):
        self.stream_calls.append({"messages": messages, "kwargs": kwargs})
        yield {"type": "reasoning_delta", "delta": "先分析引用资料。"}
        yield "final answer"


class FailingQueryVectorClient(FakeVectorClient):
    def query_text(self, *, user_id, text, top_k, where=None, library="notes"):
        raise NexoraDBError("vector backend unavailable")


def _make_note(user_id: str, **overrides) -> Note:
    defaults = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "device_id": user_id,
        "title": "函数极限",
        "category": "数学",
        "tags": ["math"],
        "image_urls": [],
        "image_filenames": [],
        "image_sizes": [],
        "original_text": "极限描述函数在某点附近的变化趋势。",
        "structured_data": {
            "summary": "极限基础",
            "sections": [
                {"heading": "定义", "content": "当 x 趋近 a 时，函数值趋近 L。"},
                {"heading": "计算", "content": "可使用等价无穷小、洛必达法则等方法。"},
            ],
        },
        "is_archived": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    return Note(**defaults)


@pytest.mark.unit
def test_intent_classifier_distinguishes_chat_question_and_note_suggestion():
    assert classify_chat_intent("你好") == "chat"
    assert classify_chat_intent("你好，根据我的笔记总结极限") == "note_question"
    assert classify_chat_intent("根据我的笔记总结一下极限怎么求？") == "note_question"
    assert classify_chat_intent("帮我记录：链式法则用于复合函数求导") == "out_of_scope_note_worthy"


@pytest.mark.unit
def test_note_tool_policy_keeps_explicit_note_add_requests_with_references():
    from app.services.chat_service import should_enable_note_suggestion_tool

    refs = [{"note_id": "note-1", "chunk_id": "section-1"}]

    assert should_enable_note_suggestion_tool(intent="chat", references=refs) is False
    assert should_enable_note_suggestion_tool(intent="note_question", references=refs) is False
    assert should_enable_note_suggestion_tool(intent="out_of_scope_note_worthy", references=refs) is True
    assert should_enable_note_suggestion_tool(intent="chat", references=[]) is True


@pytest.mark.unit
def test_doubao_stream_chat_sends_tools_and_accumulates_streaming_tool_calls():
    from app.services.doubao_chat_service import DoubaoChatService

    class FakeCompletions:
        def __init__(self):
            self.kwargs = None

        def create(self, **kwargs):
            self.kwargs = kwargs
            return iter(
                [
                    {"choices": [{"delta": {"content": "先回答。"}}]},
                    {
                        "choices": [
                            {
                                "delta": {
                                    "tool_calls": [
                                        {
                                            "index": 0,
                                            "id": "call_1",
                                            "type": "function",
                                            "function": {
                                                "name": "propose_note",
                                                "arguments": '{"title":"费曼',
                                            },
                                        }
                                    ]
            }
        }
                        ]
                    },
                    {
                        "choices": [
                            {
                                "delta": {
                                    "tool_calls": [
                                        {
                                            "index": 0,
                                            "function": {
                                                "arguments": '学习法","content":"用自己的话解释概念","reason":null,"tags":["学习法"]}',
                                            },
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                ]
            )

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    class FakeVisionService:
        def __init__(self):
            self.client = FakeClient()

        def _ensure_client(self):
            return self.client

    service = DoubaoChatService()
    service._vision_service = FakeVisionService()
    tools = ChatService.build_note_suggestion_tools()

    events = list(service.stream_chat([{"role": "user", "content": "说说费曼学习法"}], tools=tools))

    assert events[0] == "先回答。"
    assert events[1]["type"] == "tool_calls"
    tool_call = events[1]["tool_calls"][0]
    assert tool_call["id"] == "call_1"
    assert tool_call["function"]["name"] == "propose_note"
    assert json.loads(tool_call["function"]["arguments"])["title"] == "费曼学习法"
    request_kwargs = service._vision_service.client.chat.completions.kwargs
    assert request_kwargs["tools"] == tools
    assert request_kwargs["tool_choice"] == "auto"
    assert request_kwargs["stream_options"] == {"include_usage": True}


@pytest.mark.unit
def test_doubao_stream_chat_emits_normalized_cached_usage():
    from app.services.doubao_chat_service import DoubaoChatService

    class FakeCompletions:
        def __init__(self):
            self.kwargs = None

        def create(self, **kwargs):
            self.kwargs = kwargs
            return iter(
                [
                    {"choices": [{"delta": {"content": "hello"}}]},
                    {
                        "choices": [],
                        "usage": {
                            "prompt_tokens": 100,
                            "completion_tokens": 10,
                            "total_tokens": 110,
                            "prompt_tokens_details": {"cached_tokens": 75},
                        },
                    },
                ]
            )

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    class FakeVisionService:
        def __init__(self):
            self.client = FakeClient()

        def _ensure_client(self):
            return self.client

    service = DoubaoChatService()
    service._vision_service = FakeVisionService()

    events = list(service.stream_chat([{"role": "user", "content": "hi"}], thinking_enabled=True))

    assert events[0] == "hello"
    assert events[1] == {
        "type": "usage",
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": 10,
            "total_tokens": 110,
            "cached_tokens": 75,
            "cache_hit": True,
            "cache_hit_ratio": 0.75,
        },
    }
    request_kwargs = service._vision_service.client.chat.completions.kwargs
    assert request_kwargs["thinking"] == {"type": "enabled"}
    assert request_kwargs["stream_options"] == {"include_usage": True}


@pytest.mark.unit
def test_doubao_usage_preserves_missing_cached_tokens_as_null():
    from app.services.doubao_chat_service import DoubaoChatService

    usage = DoubaoChatService._normalize_usage(
        {
            "prompt_tokens": 100,
            "completion_tokens": 10,
            "total_tokens": 110,
        }
    )

    assert usage == {
        "prompt_tokens": 100,
        "completion_tokens": 10,
        "total_tokens": 110,
        "cached_tokens": None,
        "cache_hit": None,
        "cache_hit_ratio": None,
    }


@pytest.mark.unit
def test_doubao_stream_chat_emits_reasoning_delta_separately():
    from app.services.doubao_chat_service import DoubaoChatService

    class FakeCompletions:
        def create(self, **kwargs):
            return iter(
                [
                    {"choices": [{"delta": {"reasoning_content": "thinking step"}}]},
                    {"choices": [{"delta": {"content": "answer"}}]},
                ]
            )

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    class FakeVisionService:
        def __init__(self):
            self.client = FakeClient()

        def _ensure_client(self):
            return self.client

    service = DoubaoChatService()
    service._vision_service = FakeVisionService()

    events = list(service.stream_chat([{"role": "user", "content": "hi"}], thinking_enabled=True))

    assert events == [
        {"type": "reasoning_delta", "delta": "thinking step"},
        "answer",
    ]


@pytest.mark.unit
def test_extract_chunks_prefers_structured_sections(db_session, test_user):
    note = _make_note(test_user.id)
    chunks = NoteIndexService(db_session, vector_client=FakeVectorClient()).extract_chunks(note)

    assert [chunk.chunk_id for chunk in chunks] == ["section-1", "section-2"]
    assert chunks[0].section_heading == "定义"
    assert "标题: 函数极限" in chunks[0].text
    assert chunks[0].content_hash == NoteIndexService._hash_text(chunks[0].text)


@pytest.mark.unit
def test_index_note_upserts_only_changed_chunks(db_session, test_user):
    fake_vector = FakeVectorClient()
    note = _make_note(test_user.id)
    db_session.add(note)
    db_session.commit()
    db_session.refresh(note)

    service = NoteIndexService(db_session, vector_client=fake_vector)
    assert service.index_note(note) == 2
    assert len(fake_vector.upserts) == 1
    assert len(fake_vector.upserts[0][1]) == 2

    assert service.index_note(note) == 2
    assert len(fake_vector.upserts) == 1

    note.structured_data = {
        "summary": "极限基础",
        "sections": [
            {"heading": "定义", "content": "当 x 趋近 a 时，函数值趋近 L，且该趋势唯一。"},
            {"heading": "计算", "content": "可使用等价无穷小、洛必达法则等方法。"},
        ],
    }
    db_session.commit()
    assert service.index_note(note) == 2
    assert len(fake_vector.upserts) == 2
    assert [item["chunk_id"] for item in fake_vector.upserts[1][1]] == ["section-1"]


@pytest.mark.unit
def test_referenced_notes_can_skip_vector_query(db_session, test_user):
    fake_vector = FakeVectorClient()
    note = _make_note(test_user.id)
    db_session.add(note)
    db_session.commit()

    service = ChatService(db_session, vector_client=fake_vector, model_service=FakeChatModel())
    refs = service.retrieve_references(
        user_id=test_user.id,
        message="你好",
        referenced_note_ids=[note.id],
        query_vector=False,
    )

    assert len(refs) == 2
    assert refs[0]["note_id"] == note.id
    assert fake_vector.queries == []


@pytest.mark.unit
def test_explicit_references_include_all_chunks_and_short_chat_context(db_session, test_user):
    fake_vector = FakeVectorClient()
    note = _make_note(test_user.id)
    db_session.add(note)
    db_session.commit()

    service = ChatService(db_session, vector_client=fake_vector, model_service=FakeChatModel())
    conversation = service.get_or_create_conversation(
        user_id=test_user.id,
        conversation_id=None,
        first_message="6",
    )
    service.add_message(user_id=test_user.id, conversation_id=conversation.id, role="user", content="6")

    refs = service.retrieve_references(
        user_id=test_user.id,
        message="6",
        referenced_note_ids=[note.id],
        query_vector=False,
    )
    messages = service.build_model_messages(
        user_id=test_user.id,
        conversation_id=conversation.id,
        intent="chat",
        references=refs,
    )
    combined_context = "\n".join(message["content"] for message in messages)

    assert len(refs) == 2
    assert [ref["chunk_id"] for ref in refs] == ["section-1", "section-2"]
    assert "6" in messages[-1]["content"]
    assert note.title in combined_context
    assert "定义" in combined_context
    assert "计算" in combined_context


@pytest.mark.unit
def test_nexoradb_client_parses_query_result():
    client = NexoraDBClient(base_url="http://example.test", api_key="test")
    hits = client._parse_query_result(
        {
            "ids": [["vec-1"]],
            "documents": [["标题: A\n内容"]],
            "metadatas": [[{"note_id": "note-1", "chunk_id": "section-1"}]],
            "distances": [[0.25]],
        }
    )

    assert len(hits) == 1
    assert hits[0].vector_id == "vec-1"
    assert hits[0].metadata["note_id"] == "note-1"
    assert hits[0].score == pytest.approx(0.8)


@pytest.mark.unit
def test_chat_service_fork_and_suggestion_accept_indexes_note(db_session, test_user, monkeypatch):
    from app.services import note_index_service

    fake_vector = FakeVectorClient()
    monkeypatch.setattr(note_index_service, "nexoradb_client", fake_vector)

    service = ChatService(db_session, vector_client=fake_vector, model_service=FakeChatModel())
    conversation = service.get_or_create_conversation(
        user_id=test_user.id,
        conversation_id=None,
        first_message="根据笔记解释极限",
    )
    first = service.add_message(user_id=test_user.id, conversation_id=conversation.id, role="user", content="问题")
    service.add_message(user_id=test_user.id, conversation_id=conversation.id, role="assistant", content="回答")

    fork = service.fork_conversation(
        user_id=test_user.id,
        conversation_id=conversation.id,
        from_message_id=first.id,
    )
    fork_messages = service.get_messages(user_id=test_user.id, conversation_id=fork.id)
    assert len(fork_messages) == 1
    assert fork.parent_conversation_id == conversation.id
    assert fork_messages[0].created_at >= fork.created_at

    suggestion = service.create_note_suggestion(
        user_id=test_user.id,
        conversation_id=conversation.id,
        message_id=first.id,
        source_message="帮我记录：复合函数求导使用链式法则",
    )
    accepted = service.accept_suggestion(user_id=test_user.id, suggestion_id=suggestion.id)
    assert accepted.status == "accepted"
    assert accepted.note_id
    assert fake_vector.upserts


@pytest.mark.unit
def test_accept_suggestion_commits_note_and_suggestion_once(db_session, test_user, monkeypatch):
    from app.services import note_index_service

    fake_vector = FakeVectorClient()
    monkeypatch.setattr(note_index_service, "nexoradb_client", fake_vector)

    service = ChatService(db_session, vector_client=fake_vector, model_service=FakeChatModel())
    conversation = service.get_or_create_conversation(
        user_id=test_user.id,
        conversation_id=None,
        first_message="帮我记录链式法则",
    )
    suggestion = service.create_note_suggestion(
        user_id=test_user.id,
        conversation_id=conversation.id,
        message_id=None,
        source_message="链式法则用于复合函数求导",
    )

    accepted = service.accept_suggestion(user_id=test_user.id, suggestion_id=suggestion.id)

    assert accepted.status == "accepted"
    assert accepted.note_id
    note = db_session.query(Note).filter(Note.id == accepted.note_id).first()
    assert note is not None
    assert note.title == accepted.title
    assert fake_vector.upserts


@pytest.mark.unit
def test_reference_dedupe_uses_configured_max_notes(db_session, test_user, monkeypatch):
    service = ChatService(db_session, vector_client=FakeVectorClient(), model_service=FakeChatModel())
    monkeypatch.setattr("app.services.chat_service.settings.CHAT_RAG_MAX_NOTES", 2)
    refs = [
        {
            "note_id": f"note-{idx}",
            "chunk_id": "section-1",
            "title": f"Note {idx}",
            "text": f"content {idx}",
            "snippet": f"content {idx}",
            "score": 1.0 - idx * 0.1,
        }
        for idx in range(4)
    ]

    capped = service._dedupe_and_cap_references(refs)

    assert {item["note_id"] for item in capped} == {"note-0", "note-1"}


@pytest.mark.unit
def test_compact_writes_summary_without_hiding_original_messages(db_session, test_user):
    service = ChatService(db_session, vector_client=FakeVectorClient(), model_service=FakeChatModel())
    conversation = service.get_or_create_conversation(
        user_id=test_user.id,
        conversation_id=None,
        first_message="start compact",
    )
    for idx in range(16):
        role = "user" if idx % 2 == 0 else "assistant"
        service.add_message(
            user_id=test_user.id,
            conversation_id=conversation.id,
            role=role,
            content=f"message {idx}",
        )

    compacted = service.compact_conversation(user_id=test_user.id, conversation_id=conversation.id, force=True)
    db_session.refresh(conversation)
    all_messages = service.get_messages(user_id=test_user.id, conversation_id=conversation.id)
    model_messages = service.build_model_messages(
        user_id=test_user.id,
        conversation_id=conversation.id,
        intent="chat",
        references=[],
    )

    assert compacted is True
    assert conversation.context_summary
    assert conversation.context_compacted_until_sequence == 4
    assert len(all_messages) == 16
    assert len([message for message in model_messages if message["role"] in {"user", "assistant"}]) == 12


@pytest.mark.unit
def test_search_conversations_returns_distinct_conversations(db_session, test_user):
    service = ChatService(db_session, vector_client=FakeVectorClient(), model_service=FakeChatModel())
    conversation = service.get_or_create_conversation(
        user_id=test_user.id,
        conversation_id=None,
        first_message="重复搜索",
    )
    conversation.title = "重复搜索"
    service.add_message(user_id=test_user.id, conversation_id=conversation.id, role="user", content="重复搜索")
    service.add_message(user_id=test_user.id, conversation_id=conversation.id, role="assistant", content="重复搜索")

    results = service.search_conversations(user_id=test_user.id, query_text="重复搜索")

    assert [item.id for item in results] == [conversation.id]


def _register_and_login(test_client):
    username = f"chat_{uuid.uuid4().hex[:8]}"
    password = "TestPassword123"
    register_resp = test_client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password, "email": f"{username}@example.com"},
    )
    assert register_resp.status_code in (200, 201)
    login_resp = test_client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    me_resp = test_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    return me_resp.json()["id"], token


def _extract_sse_payloads(body: str, event: str):
    payloads = []
    current_event = None
    for line in body.splitlines():
        if line.startswith("event: "):
            current_event = line.removeprefix("event: ").strip()
        elif line.startswith("data: ") and current_event == event:
            payloads.append(json.loads(line.removeprefix("data: ")))
    return payloads


@pytest.mark.integration
def test_chat_stream_persists_messages_and_emits_sse(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module
    from app.services import note_index_service

    fake_vector = FakeVectorClient()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", fake_vector)
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", FakeChatModel())
    monkeypatch.setattr(note_index_service, "nexoradb_client", fake_vector)

    user_id, token = _register_and_login(test_client)
    headers = {"Authorization": f"Bearer {token}"}
    note_data = {
        "title": "极限笔记",
        "category": "数学",
        "tags": ["limit"],
        "image_urls": [],
        "image_filenames": [],
        "image_sizes": [],
        "original_text": "极限是函数变化趋势。",
        "structured_data": {
            "summary": "极限",
            "sections": [{"heading": "定义", "content": "极限表示趋近过程。"}],
        },
    }
    with SessionLocal() as session:
        note = NoteService(session).create_note(note_data, user_id, device_id=user_id)
        note_id = note.id

    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers=headers,
        json={"message": "根据我的笔记解释极限是什么？", "referenced_note_ids": [note_id]},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    assert "event: conversation_id" in body
    assert "event: retrieval" in body
    assert "event: delta" in body
    assert "event: done" in body
    assert note_id in body


@pytest.mark.integration
def test_chat_stream_short_text_includes_five_explicit_references(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module
    from app.services import note_index_service

    fake_vector = FakeVectorClient()
    fake_model = FakeChatModel()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", fake_vector)
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", fake_model)
    monkeypatch.setattr(note_index_service, "nexoradb_client", fake_vector)

    user_id, token = _register_and_login(test_client)
    headers = {"Authorization": f"Bearer {token}"}
    note_ids = []
    with SessionLocal() as session:
        for idx in range(5):
            note = NoteService(session).create_note(
                {
                    "title": f"explicit-note-{idx}",
                    "category": "test",
                    "tags": [],
                    "image_urls": [],
                    "image_filenames": [],
                    "image_sizes": [],
                    "original_text": f"explicit content {idx}",
                    "structured_data": {
                        "summary": f"summary {idx}",
                        "sections": [{"heading": "main", "content": f"explicit section content {idx}"}],
                    },
                },
                user_id,
                device_id=user_id,
            )
            note_ids.append(note.id)

    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers=headers,
        json={"message": "6", "referenced_note_ids": note_ids},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    retrieval = _extract_sse_payloads(body, "retrieval")[0]
    model_context = "\n".join(message["content"] for message in fake_model.stream_calls[0]["messages"])

    assert retrieval["intent"] == "chat"
    assert retrieval["requested_note_ids"] == note_ids
    assert retrieval["effective_note_ids"] == note_ids
    assert retrieval["reference_count"] == 5
    assert "tools" not in fake_model.stream_calls[0]["kwargs"]
    for idx, note_id in enumerate(note_ids):
        assert note_id in model_context
        assert f"explicit section content {idx}" in model_context
    assert fake_vector.queries == []


@pytest.mark.integration
def test_chat_stream_explicit_note_add_keeps_tool_calling_with_references(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module
    from app.services import note_index_service

    fake_vector = FakeVectorClient()
    fake_model = FakeChatModel()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", fake_vector)
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", fake_model)
    monkeypatch.setattr(note_index_service, "nexoradb_client", fake_vector)

    user_id, token = _register_and_login(test_client)
    with SessionLocal() as session:
        note = NoteService(session).create_note(
            {
                "title": "source note",
                "category": "test",
                "tags": [],
                "image_urls": [],
                "image_filenames": [],
                "image_sizes": [],
                "original_text": "source content",
                "structured_data": {
                    "summary": "source summary",
                    "sections": [{"heading": "main", "content": "source section content"}],
                },
            },
            user_id,
            device_id=user_id,
        )
        note_id = note.id

    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "帮我记录：把这条引用资料整理成笔记", "referenced_note_ids": [note_id]},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    retrieval = _extract_sse_payloads(body, "retrieval")[0]
    suggestion_events = _extract_sse_payloads(body, "note_suggestion")
    assert retrieval["intent"] == "out_of_scope_note_worthy"
    assert fake_model.stream_calls[0]["kwargs"]["tools"][0]["function"]["name"] == "propose_note"
    assert len(suggestion_events) == 1


@pytest.mark.integration
def test_chat_stream_emits_usage_and_done_usage(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module

    fake_model = UsageChatModel()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", FakeVectorClient())
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", fake_model)

    _, token = _register_and_login(test_client)
    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "hello"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    usage_events = _extract_sse_payloads(body, "usage")
    done_events = _extract_sse_payloads(body, "done")
    assert usage_events == [
        {
            "prompt_tokens": 100,
            "completion_tokens": 20,
            "total_tokens": 120,
            "cached_tokens": 60,
            "cache_hit": True,
            "cache_hit_ratio": 0.6,
        }
    ]
    assert done_events[0]["usage"] == usage_events[0]


@pytest.mark.integration
def test_chat_stream_emits_reasoning_delta_and_done_reasoning(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module

    fake_model = ReasoningChatModel()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", FakeVectorClient())
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", fake_model)

    _, token = _register_and_login(test_client)
    headers = {"Authorization": f"Bearer {token}"}
    test_client.put(
        "/api/v1/auth/preferences",
        headers=headers,
        json={"chat_thinking_enabled": True},
    )

    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers=headers,
        json={"message": "分析一下"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    reasoning_events = _extract_sse_payloads(body, "reasoning_delta")
    delta_events = _extract_sse_payloads(body, "delta")
    done_events = _extract_sse_payloads(body, "done")

    assert reasoning_events == [{"delta": "先分析引用资料。"}]
    assert delta_events == [{"delta": "final answer"}]
    assert done_events[0]["reasoning_content"] == "先分析引用资料。"
    assert fake_model.stream_calls[0]["kwargs"]["thinking_enabled"] is True

    detail_resp = test_client.get(
        f"/api/v1/chat/conversations/{done_events[0]['conversation_id']}",
        headers=headers,
    )
    assistant_message = detail_resp.json()["messages"][-1]
    assert assistant_message["metadata"]["reasoning_content"] == "先分析引用资料。"


@pytest.mark.integration
def test_auth_preferences_control_chat_thinking(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module

    fake_model = FakeChatModel()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", FakeVectorClient())
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", fake_model)

    _, token = _register_and_login(test_client)
    headers = {"Authorization": f"Bearer {token}"}

    default_resp = test_client.get("/api/v1/auth/preferences", headers=headers)
    assert default_resp.status_code == 200
    assert default_resp.json() == {"chat_thinking_enabled": False}

    update_resp = test_client.put(
        "/api/v1/auth/preferences",
        headers=headers,
        json={"chat_thinking_enabled": True},
    )
    assert update_resp.status_code == 200
    assert update_resp.json() == {"chat_thinking_enabled": True}

    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers=headers,
        json={"message": "hello"},
    ) as response:
        assert response.status_code == 200
        "".join(response.iter_text())

    assert fake_model.stream_calls[0]["kwargs"]["thinking_enabled"] is True


@pytest.mark.integration
def test_chat_stream_context_length_error_compacts_and_retries(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module
    from app.services.doubao_service import DoubaoServiceError

    class ContextFailOnceModel(FakeChatModel):
        @staticmethod
        def is_context_length_error(exc):
            return "context length" in str(exc).lower()

        def stream_chat(self, messages, **kwargs):
            self.stream_calls.append({"messages": messages, "kwargs": kwargs})
            if len(self.stream_calls) == 1:
                raise DoubaoServiceError("context length exceeded")
            yield "retried answer"

    fake_model = ContextFailOnceModel()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", FakeVectorClient())
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", fake_model)

    user_id, token = _register_and_login(test_client)
    with SessionLocal() as session:
        service = ChatService(session, vector_client=FakeVectorClient(), model_service=FakeChatModel())
        conversation = service.get_or_create_conversation(
            user_id=user_id,
            conversation_id=None,
            first_message="old start",
        )
        conversation_id = conversation.id
        for idx in range(16):
            service.add_message(
                user_id=user_id,
                conversation_id=conversation_id,
                role="user" if idx % 2 == 0 else "assistant",
                content=f"old message {idx}",
            )

    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers={"Authorization": f"Bearer {token}"},
        json={"conversation_id": conversation_id, "message": "continue"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    assert "event: error" not in body
    assert "retried answer" in body
    assert len(fake_model.stream_calls) == 2
    with SessionLocal() as session:
        conversation = (
            session.query(chat_service_module.ChatConversation)
            .filter(chat_service_module.ChatConversation.id == conversation_id)
            .first()
        )
        assert conversation.context_summary
        assert conversation.context_compacted_until_sequence is not None


@pytest.mark.integration
def test_chat_stream_note_suggestion_event_for_note_worthy_message(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module

    fake_vector = FakeVectorClient()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", fake_vector)
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", FakeChatModel())

    _, token = _register_and_login(test_client)
    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "帮我记录：链式法则用于复合函数求导"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    suggestion_events = _extract_sse_payloads(body, "note_suggestion")
    done_events = _extract_sse_payloads(body, "done")
    assert len(suggestion_events) == 1
    assert suggestion_events[0]["status"] == "pending"
    assert suggestion_events[0]["title"].startswith("帮我记录")
    assert done_events[0]["suggestion_id"] == suggestion_events[0]["id"]


@pytest.mark.integration
def test_chat_stream_model_tool_call_creates_note_suggestion_for_unmatched_message(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module

    fake_vector = FakeVectorClient()
    fake_model = ToolCallingChatModel()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", fake_vector)
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", fake_model)

    _, token = _register_and_login(test_client)
    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "费曼学习法分四步：选择主题、讲给别人、发现漏洞、简化表达"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    retrieval_events = _extract_sse_payloads(body, "retrieval")
    suggestion_events = _extract_sse_payloads(body, "note_suggestion")
    done_events = _extract_sse_payloads(body, "done")
    assert retrieval_events[0]["intent"] == "chat"
    assert len(suggestion_events) == 1
    assert suggestion_events[0]["title"] == "费曼学习法"
    assert suggestion_events[0]["content"] == "费曼学习法要求先用自己的话解释概念，再找出卡住的部分。"
    assert suggestion_events[0]["tags"] == ["学习法"]
    assert suggestion_events[0]["metadata"]["source"] == "propose_note_tool_call"
    assert done_events[0]["suggestion_id"] == suggestion_events[0]["id"]
    assert fake_model.stream_calls[0]["kwargs"]["tools"][0]["function"]["name"] == "propose_note"


@pytest.mark.integration
def test_chat_stream_nexoradb_failure_emits_sse_error(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module

    monkeypatch.setattr(chat_service_module, "nexoradb_client", FailingQueryVectorClient())
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", FakeChatModel())

    _, token = _register_and_login(test_client)
    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "根据我的笔记总结极限是什么？"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    error_events = _extract_sse_payloads(body, "error")
    assert error_events == [
        {
            "error": "nexoradb_unavailable",
            "detail": "vector backend unavailable",
        }
    ]
    assert "event: delta" not in body


@pytest.mark.integration
def test_chat_stream_empty_message_is_ignored_without_persistence(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module

    fake_vector = FakeVectorClient()
    fake_model = FakeChatModel()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", fake_vector)
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", fake_model)

    user_id, token = _register_and_login(test_client)
    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "   "},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    done_events = _extract_sse_payloads(body, "done")
    assert done_events == [
        {
            "ignored": True,
            "reason": "empty_message",
            "conversation_id": None,
            "message_id": None,
            "suggestion_id": None,
        }
    ]
    assert "event: error" not in body

    with SessionLocal() as session:
        service = ChatService(session, vector_client=fake_vector, model_service=fake_model)
        conversations, total = service.list_conversations(user_id=user_id)
        assert total == 0
        assert conversations == []


@pytest.mark.integration
def test_same_user_stream_requests_create_independent_conversations(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module

    fake_vector = FakeVectorClient()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", fake_vector)
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", FakeChatModel())

    _, token = _register_and_login(test_client)
    conversation_ids = []
    for message in ("你好，第一次请求", "你好，第二次请求"):
        with test_client.stream(
            "POST",
            "/api/v1/chat/stream",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": message},
        ) as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())
        payloads = _extract_sse_payloads(body, "conversation_id")
        assert len(payloads) == 1
        conversation_ids.append(payloads[0]["conversation_id"])

    assert len(set(conversation_ids)) == 2


@pytest.mark.integration
def test_conversation_delete_and_batch_delete_endpoints(test_client):
    user_id, token = _register_and_login(test_client)
    headers = {"Authorization": f"Bearer {token}"}
    with SessionLocal() as session:
        service = ChatService(session, vector_client=FakeVectorClient(), model_service=FakeChatModel())
        first = service.get_or_create_conversation(
            user_id=user_id,
            conversation_id=None,
            first_message="删除测试 1",
        )
        second = service.get_or_create_conversation(
            user_id=user_id,
            conversation_id=None,
            first_message="删除测试 2",
        )
        third = service.get_or_create_conversation(
            user_id=user_id,
            conversation_id=None,
            first_message="删除测试 3",
        )
        first_id = first.id
        second_id = second.id
        third_id = third.id

    delete_resp = test_client.delete(f"/api/v1/chat/conversations/{first_id}", headers=headers)
    assert delete_resp.status_code == 204

    batch_resp = test_client.post(
        "/api/v1/chat/conversations/batch-delete",
        headers=headers,
        json={"conversation_ids": [second_id, third_id, str(uuid.uuid4())]},
    )
    assert batch_resp.status_code == 200
    payload = batch_resp.json()
    assert payload["deleted_count"] == 2
    assert len(payload["not_found_ids"]) == 1

    list_resp = test_client.get("/api/v1/chat/conversations", headers=headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0


@pytest.mark.integration
def test_suggestion_accept_and_dismiss_endpoints(test_client, monkeypatch):
    from app.services import note_index_service

    fake_vector = FakeVectorClient()
    monkeypatch.setattr(note_index_service, "nexoradb_client", fake_vector)

    user_id, token = _register_and_login(test_client)
    headers = {"Authorization": f"Bearer {token}"}
    with SessionLocal() as session:
        service = ChatService(session, vector_client=fake_vector, model_service=FakeChatModel())
        conversation = service.get_or_create_conversation(
            user_id=user_id,
            conversation_id=None,
            first_message="建议端点测试",
        )
        accept_target = service.create_note_suggestion(
            user_id=user_id,
            conversation_id=conversation.id,
            message_id=None,
            source_message="链式法则用于复合函数求导",
        )
        dismiss_target = service.create_note_suggestion(
            user_id=user_id,
            conversation_id=conversation.id,
            message_id=None,
            source_message="极限表示趋近趋势",
        )
        accept_id = accept_target.id
        dismiss_id = dismiss_target.id

    accept_resp = test_client.post(f"/api/v1/chat/suggestions/{accept_id}/accept", headers=headers)
    assert accept_resp.status_code == 200
    accept_payload = accept_resp.json()
    assert accept_payload["suggestion"]["status"] == "accepted"
    assert accept_payload["note_id"]

    dismiss_resp = test_client.post(f"/api/v1/chat/suggestions/{dismiss_id}/dismiss", headers=headers)
    assert dismiss_resp.status_code == 200
    assert dismiss_resp.json()["status"] == "dismissed"


@pytest.mark.integration
def test_index_rebuild_endpoint_indexes_current_user_notes(test_client, monkeypatch):
    from app.services import note_index_service

    fake_vector = FakeVectorClient()
    monkeypatch.setattr(note_index_service, "nexoradb_client", fake_vector)

    user_id, token = _register_and_login(test_client)
    note_data = {
        "title": "重建索引笔记",
        "category": "数学",
        "tags": ["rebuild"],
        "image_urls": [],
        "image_filenames": [],
        "image_sizes": [],
        "original_text": "极限描述函数变化趋势。",
        "structured_data": {
            "summary": "极限",
            "sections": [{"heading": "定义", "content": "极限表示趋近过程。"}],
        },
    }
    with SessionLocal() as session:
        NoteService(session).create_note(note_data, user_id, device_id=user_id, index=False)

    response = test_client.post(
        "/api/v1/chat/index/rebuild",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["indexed_notes"] == 1
    assert payload["indexed_chunks"] == 1
    assert payload["skipped_notes"] == 0
    assert fake_vector.upserts


@pytest.mark.integration
def test_forked_conversation_can_continue_on_new_branch(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module

    fake_vector = FakeVectorClient()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", fake_vector)
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", FakeChatModel())

    _, token = _register_and_login(test_client)
    headers = {"Authorization": f"Bearer {token}"}
    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers=headers,
        json={"message": "创建主分支"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())
    source_conversation_id = _extract_sse_payloads(body, "conversation_id")[0]["conversation_id"]

    detail_resp = test_client.get(f"/api/v1/chat/conversations/{source_conversation_id}", headers=headers)
    assert detail_resp.status_code == 200
    source_messages = detail_resp.json()["messages"]
    fork_resp = test_client.post(
        f"/api/v1/chat/conversations/{source_conversation_id}/fork",
        headers=headers,
        json={"from_message_id": source_messages[0]["id"]},
    )
    assert fork_resp.status_code == 200
    fork_id = fork_resp.json()["id"]

    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers=headers,
        json={"conversation_id": fork_id, "message": "继续新分支"},
    ) as response:
        assert response.status_code == 200
        fork_stream_body = "".join(response.iter_text())

    assert _extract_sse_payloads(fork_stream_body, "conversation_id")[0]["conversation_id"] == fork_id
    fork_detail = test_client.get(f"/api/v1/chat/conversations/{fork_id}", headers=headers)
    assert fork_detail.status_code == 200
    fork_messages = fork_detail.json()["messages"]
    assert [message["role"] for message in fork_messages] == ["user", "user", "assistant"]
    assert fork_messages[1]["content"] == "继续新分支"


@pytest.mark.integration
def test_chat_stream_emits_heartbeat_while_model_is_idle(test_client, monkeypatch):
    from app.api.v1.endpoints import chat as chat_endpoint
    from app.services import chat_service as chat_service_module

    class SlowChatModel(FakeChatModel):
        def stream_chat(self, messages, **kwargs):
            time.sleep(0.2)
            yield "慢回答"

    fake_vector = FakeVectorClient()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", fake_vector)
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", SlowChatModel())
    monkeypatch.setattr(chat_endpoint.settings, "CHAT_STREAM_HEARTBEAT_SECONDS", 0.05)

    _, token = _register_and_login(test_client)
    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "你好，慢一点"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    assert ": heartbeat" in body
    assert "event: delta" in body
    assert "event: done" in body


@pytest.mark.integration
def test_chat_stream_rejects_inaccessible_referenced_note(test_client, monkeypatch):
    from app.services import chat_service as chat_service_module
    from app.services import note_index_service

    fake_vector = FakeVectorClient()
    monkeypatch.setattr(chat_service_module, "nexoradb_client", fake_vector)
    monkeypatch.setattr(chat_service_module, "doubao_chat_service", FakeChatModel())
    monkeypatch.setattr(note_index_service, "nexoradb_client", fake_vector)

    _, token_a = _register_and_login(test_client)
    user_b, _ = _register_and_login(test_client)
    note_data = {
        "title": "私有笔记",
        "category": "数学",
        "tags": [],
        "image_urls": [],
        "image_filenames": [],
        "image_sizes": [],
        "original_text": "private",
        "structured_data": {"summary": "private"},
    }
    with SessionLocal() as session:
        note = NoteService(session).create_note(note_data, user_b, device_id=user_b)
        note_id = note.id

    with test_client.stream(
        "POST",
        "/api/v1/chat/stream",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"message": "根据我的笔记解释一下？", "referenced_note_ids": [note_id]},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    assert "event: error" in body
    assert "access_denied" in body
