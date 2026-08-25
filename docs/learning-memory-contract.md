# 统一学习记忆数据体系

当前版本为 `schema_version: 1`。所有学习记忆数据按 `user_id` 隔离，暂时以一个用户状态文档保存，后续可以拆分存储而不改变业务接口。

## 顶层状态

```json
{
  "schema_version": 1,
  "user_id": "u_001",
  "conversations": [],
  "messages": [],
  "learning_events": [],
  "concepts": [],
  "concept_relations": [],
  "user_thoughts": [],
  "misconceptions": [],
  "user_concept_states": [],
  "learning_notes": [],
  "weaknesses": [],
  "updated_at": "2026-07-31T00:00:00Z"
}
```

## 已开放接口

```http
GET  /api/learning-memory/{userId}
GET  /api/learning-memory/{userId}/conversations
POST /api/learning-memory/{userId}/conversations
GET  /api/learning-memory/{userId}/conversations/{conversationId}
POST /api/learning-memory/{userId}/conversations/{conversationId}/messages
POST /api/learning-memory/{userId}/events
```

创建会话的请求示例：

```json
{
  "title": "固定铰支座的约束反力",
  "metadata": {"source": "ai_qa"}
}
```

写入消息的请求示例：

```json
{
  "role": "user",
  "content": "为什么固定铰支座通常有两个反力？",
  "content_type": "text",
  "metadata": {}
}
```

写入学习事件时必须提供 `event_type`、`evidence_type` 和 `evidence_id`。如果提供 `message_id`，服务端会校验该消息确实属于当前用户。

## 设计约束

- `user_thoughts` 只允许 `explicit` 或 `inferred`，禁止把 AI 输出直接标为用户想法。
- 错误诊断、能力状态和薄弱点必须通过 `message_id`、`evidence_id` 或事件记录追溯到原始证据。
- `learning_events` 是跨 AI 对话、受力图、动画和练习的统一行为入口。
- 当前后端仍沿用工程现有的用户体系；真正的服务端会话鉴权仍需后续补充。
