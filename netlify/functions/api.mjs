// Netlify Function: /api/* handler
// Uses Netlify Blobs for persistent storage
// Fallback: in-memory store (survives within a single function instance, reset on cold start)

import { getStore } from "@netlify/blobs";

// ── Helpers ──────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

function now() {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

async function parseBody(req) {
  try {
    return await req.json();
  } catch (e) {
    return {};
  }
}

// ── Blobs wrapper with fallback ──────────────────────────

// In-memory fallback stores (shared across invocations within same instance)
const memoryStores = {};

async function blobGet(storeName, key) {
  try {
    const store = getStore(storeName);
    const val = await store.get(key);
    if (val !== null && val !== undefined) return val;
  } catch (e) {
    console.error(`[blobs] get ${storeName}/${key} failed:`, e.message);
  }
  // Fallback to memory
  const mem = memoryStores[storeName];
  if (mem && mem[key] !== undefined) return mem[key];
  return null;
}

async function blobSet(storeName, key, value) {
  let blobOk = false;
  try {
    const store = getStore(storeName);
    await store.set(key, value);
    blobOk = true;
  } catch (e) {
    console.error(`[blobs] set ${storeName}/${key} failed:`, e.message);
  }
  // Always write to memory fallback
  if (!memoryStores[storeName]) memoryStores[storeName] = {};
  memoryStores[storeName][key] = value;
  return blobOk;
}

async function blobDelete(storeName, key) {
  try {
    const store = getStore(storeName);
    await store.delete(key);
  } catch (e) {
    console.error(`[blobs] delete ${storeName}/${key} failed:`, e.message);
  }
  // Also remove from memory
  if (memoryStores[storeName]) delete memoryStores[storeName][key];
}

async function blobGetJSON(storeName, key, fallback = null) {
  const raw = await blobGet(storeName, key);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  return fallback;
}

// ── Main handler ─────────────────────────────────────────

export default async function handler(req) {
  const url = new URL(req.url);
  // Robust path parsing: handles both /api/upload and /.netlify/functions/api/upload
  const path = url.pathname.replace(/.*\/api/, "");
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  try {
    // ============ QUESTIONS ============

    // GET /api/list — return all question index entries
    if (path === "/list" && method === "GET") {
      const storeName = "questions";
      const index = await blobGetJSON(storeName, "index") || { questions: [] };
      console.log(`[api] /list returning ${index.questions.length} questions`);
      return json({ ok: true, questions: index.questions || [] });
    }

    // GET /api/question/:id — return full question data
    if (path.startsWith("/question/") && method === "GET") {
      const qid = path.replace("/question/", "").trim();
      const raw = await blobGet("questions", `question_${qid}`);
      if (!raw) return json({ ok: false, message: "题目不存在" }, 404);
      try {
        return json(JSON.parse(raw));
      } catch (e) {
        return json({ ok: false, message: "题目数据损坏" }, 500);
      }
    }

    // GET /api/export — admin: export all data as JSON
    if (path === "/export" && method === "GET") {
      const questionsIndex = await blobGetJSON("questions", "index") || { questions: [] };
      const forumIndex = await blobGetJSON("forum", "index") || { posts: [] };
      const accounts = await blobGetJSON("accounts", "users") || [];

      // Strip passwords
      const safeAccounts = accounts.map(u => ({
        id: u.id, name: u.name, student_id: u.student_id, role: u.role, created: u.created
      }));

      return json({
        ok: true,
        data: {
          questions_count: questionsIndex.questions.length,
          forum_posts_count: forumIndex.posts.length,
          accounts_count: safeAccounts.length,
          questions: questionsIndex.questions,
          forum_posts: forumIndex.posts,
          accounts: safeAccounts
        }
      });
    }

    // POST /api/upload — upload a new question
    if (path === "/upload" && method === "POST") {
      const data = await parseBody(req);
      const required = ['module', 'difficulty', 'answer', 'explanation'];
      const missing = required.filter(k => !data[k] || !String(data[k]).trim());
      if (missing.length) {
        return json({ ok: false, message: `缺少必填字段: ${missing.join(", ")}` }, 400);
      }
      const content = (data.content || "").trim();
      if (!content) return json({ ok: false, message: "题目内容不能为空" }, 400);

      const storeName = "questions";
      let index = await blobGetJSON(storeName, "index") || { questions: [] };
      const questions = index.questions || [];

      // Generate next ID
      let maxN = 0;
      for (const q of questions) {
        const m = (q.id || "").match(/q_(\d{3})/);
        if (m) { const n = parseInt(m[1], 10); if (n > maxN) maxN = n; }
      }
      const newId = `q_${String(maxN + 1).padStart(3, "0")}`;

      // Auto-generate title
      const title = (content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()).substring(0, 30) + "…";

      // Build question object (keep base64 images as-is on Netlify)
      const question = {
        id: newId,
        title,
        content,
        figure: data._figureData || data.figure || "",
        knowledge_points: data.knowledge_points || [],
        answer: data.answer,
        explanation: data.explanation,
        difficulty: data.difficulty,
        module: data.module
      };

      // Store full question
      const blobOk = await blobSet(storeName, `question_${newId}`, JSON.stringify(question));

      // Update index
      const indexEntry = {
        id: newId,
        title,
        difficulty: data.difficulty,
        knowledge_points: data.knowledge_points || [],
        module: data.module
      };
      questions.push(indexEntry);
      index.questions = questions;
      await blobSet(storeName, "index", JSON.stringify(index));

      console.log(`[api] Question saved: ${newId} (blobs: ${blobOk ? "OK" : "memory-fallback"})`);
      return json({ ok: true, id: newId, title, storage: blobOk ? "blobs" : "memory" });
    }

    // DELETE /api/delete/:id
    if (path.startsWith("/delete/") && method === "DELETE") {
      const qid = path.replace("/delete/", "").trim();
      if (!qid) return json({ ok: false, message: "缺少题目ID" }, 400);

      const storeName = "questions";
      let index = await blobGetJSON(storeName, "index") || { questions: [] };
      index.questions = (index.questions || []).filter(q => q.id !== qid);
      await blobSet(storeName, "index", JSON.stringify(index));
      await blobDelete(storeName, `question_${qid}`);

      console.log(`[api] Question deleted: ${qid}`);
      return json({ ok: true, message: "已删除" });
    }

    // ============ FORUM ============

    if (path === "/forum/list" && method === "GET") {
      const index = await blobGetJSON("forum", "index") || { posts: [] };
      return json({ ok: true, posts: index.posts || [] });
    }

    if (path === "/forum/upload" && method === "POST") {
      const data = await parseBody(req);
      if (!data.category || !data.title || !data.content) {
        return json({ ok: false, message: "缺少必填字段" }, 400);
      }
      const storeName = "forum";
      let index = await blobGetJSON(storeName, "index") || { posts: [] };
      const posts = index.posts || [];
      let maxN = 0;
      for (const p of posts) {
        const m = (p.id || "").match(/f_(\d{3})/);
        if (m) { const n = parseInt(m[1], 10); if (n > maxN) maxN = n; }
      }
      const newId = `f_${String(maxN + 1).padStart(3, "0")}`;
      const post = {
        id: newId,
        category: data.category,
        title: data.title,
        content: data.content,
        author: (data.author || "").trim() || "匿名用户",
        time: now(),
        views: 0,
        replies: 0
      };
      posts.unshift(post);
      index.posts = posts;
      await blobSet(storeName, "index", JSON.stringify(index));

      console.log(`[api] Forum post: ${newId}`);
      return json({ ok: true, id: newId, post });
    }

    if (path.startsWith("/forum/delete/") && method === "DELETE") {
      const fid = path.replace("/forum/delete/", "").trim();
      const storeName = "forum";
      let index = await blobGetJSON(storeName, "index") || { posts: [] };
      index.posts = (index.posts || []).filter(p => p.id !== fid);
      await blobSet(storeName, "index", JSON.stringify(index));
      // Also delete associated comments
      await blobDelete(storeName, `comments_${fid}`);
      return json({ ok: true, message: "已删除" });
    }

    // ============ FORUM COMMENTS ============

    // GET /api/forum/comments/:postId — load comments for a post
    if (path.startsWith("/forum/comments/") && method === "GET") {
      const postId = path.replace("/forum/comments/", "").trim();
      const comments = await blobGetJSON("forum", `comments_${postId}`) || [];
      return json({ ok: true, comments });
    }

    // POST /api/forum/comment/:postId — add a comment
    if (path.startsWith("/forum/comment/") && method === "POST") {
      const postId = path.replace("/forum/comment/", "").trim();
      const data = await parseBody(req);
      if (!data.content) return json({ ok: false, message: "评论内容不能为空" }, 400);

      let comments = await blobGetJSON("forum", `comments_${postId}`) || [];
      const comment = {
        author: data.author || "匿名用户",
        time: now(),
        content: data.content,
        image: data.image || "",
        student_id: data.student_id || ""
      };
      comments.push(comment);
      await blobSet("forum", `comments_${postId}`, JSON.stringify(comments));

      // Update reply count on the post
      let index = await blobGetJSON("forum", "index") || { posts: [] };
      const post = (index.posts || []).find(p => p.id === postId);
      if (post) { post.replies = comments.length; await blobSet("forum", "index", JSON.stringify(index)); }

      console.log(`[api] Comment added to ${postId}, total: ${comments.length}`);
      return json({ ok: true, comment });
    }

    // DELETE /api/forum/comment/:postId/:index — delete comment by index
    var commentDeleteMatch = path.match(/^\/forum\/comment\/([^\/]+)\/(\d+)$/);
    if (commentDeleteMatch && method === "DELETE") {
      const postId = commentDeleteMatch[1];
      const idx = parseInt(commentDeleteMatch[2], 10);
      let comments = await blobGetJSON("forum", `comments_${postId}`) || [];
      if (idx < 0 || idx >= comments.length) return json({ ok: false, message: "评论不存在" }, 404);
      comments.splice(idx, 1);
      await blobSet("forum", `comments_${postId}`, JSON.stringify(comments));

      // Update reply count
      let index = await blobGetJSON("forum", "index") || { posts: [] };
      const post = (index.posts || []).find(p => p.id === postId);
      if (post) { post.replies = comments.length; await blobSet("forum", "index", JSON.stringify(index)); }

      console.log(`[api] Comment deleted from ${postId}, remaining: ${comments.length}`);
      return json({ ok: true, message: "已删除" });
    }

    // ============ ACCOUNT ============

    if (path === "/account/list" && method === "GET") {
      let users = await blobGetJSON("accounts", "users") || [];
      // Strip passwords
      users = users.map(u => ({
        id: u.id, name: u.name, student_id: u.student_id, role: u.role, created: u.created
      }));
      // Always include embedded admin
      if (!users.some(u => u.student_id === "202509020109")) {
        users.push({ id: "u_001", name: "刘丰源", student_id: "202509020109", role: "admin", created: "2026-07-01" });
      }
      return json({ ok: true, users });
    }

    if (path === "/account/register" && method === "POST") {
      const data = await parseBody(req);
      if (!data.name || !data.student_id || !data.password) {
        return json({ ok: false, message: "信息不完整" }, 400);
      }
      let users = await blobGetJSON("accounts", "users") || [];
      if (users.some(u => u.student_id === data.student_id)) {
        return json({ ok: false, message: "该学号已注册" }, 400);
      }
      let maxN = 100;
      for (const u of users) {
        const m = (u.id || "").match(/u_(\d{3})/);
        if (m) { const n = parseInt(m[1], 10); if (n > maxN) maxN = n; }
      }
      const newUser = {
        id: `u_${String(maxN + 1).padStart(3, "0")}`,
        name: data.name,
        student_id: data.student_id,
        password: data.password,
        role: "user",
        created: now().split(" ")[0]
      };
      users.push(newUser);
      await blobSet("accounts", "users", JSON.stringify(users));

      console.log(`[api] User registered: ${newUser.id}`);
      return json({ ok: true, user: { id: newUser.id, name: data.name, student_id: data.student_id, role: "user", created: newUser.created } });
    }

    if (path.startsWith("/account/delete/") && method === "DELETE") {
      const uid = path.replace("/account/delete/", "").trim();
      let users = await blobGetJSON("accounts", "users") || [];
      const target = users.find(u => u.id === uid);
      if (!target) return json({ ok: false, message: "用户不存在" }, 404);
      if (target.role === "admin") return json({ ok: false, message: "不能删除管理员账户" }, 403);
      users = users.filter(u => u.id !== uid);
      await blobSet("accounts", "users", JSON.stringify(users));
      return json({ ok: true, message: "已删除" });
    }

    if (path.startsWith("/account/promote/") && method === "POST") {
      const uid = path.replace("/account/promote/", "").trim();
      let users = await blobGetJSON("accounts", "users") || [];
      const user = users.find(u => u.id === uid);
      if (!user) return json({ ok: false, message: "用户不存在" }, 404);
      user.role = "admin";
      await blobSet("accounts", "users", JSON.stringify(users));
      return json({ ok: true, message: "已提升为管理员" });
    }

    // ============ UNIFIED LEARNING MEMORY ============
    // One user-scoped document is the source of truth for learning records.
    // The document can later be split into stores without changing the API.
    const lmRoot = path.match(/^\/learning-memory\/([^/]+)$/);
    const lmConversations = path.match(/^\/learning-memory\/([^/]+)\/conversations$/);
    const lmConversation = path.match(/^\/learning-memory\/([^/]+)\/conversations\/([^/]+)$/);
    const lmMessages = path.match(/^\/learning-memory\/([^/]+)\/conversations\/([^/]+)\/messages$/);
    const lmEvents = path.match(/^\/learning-memory\/([^/]+)\/events$/);
    const lmExtract = path.match(/^\/learning-memory\/([^/]+)\/conversations\/([^/]+)\/extract$/);
    const lmNotes = path.match(/^\/learning-memory\/([^/]+)\/notes$/);
    const lmNote = path.match(/^\/learning-memory\/([^/]+)\/notes\/([^/]+)$/);
    const lmNoteConfirm = path.match(/^\/learning-memory\/([^/]+)\/notes\/([^/]+)\/confirm$/);
    const lmWeaknesses = path.match(/^\/learning-memory\/([^/]+)\/weaknesses$/);
    const lmWeaknessFeedback = path.match(/^\/learning-memory\/([^/]+)\/weaknesses\/([^/]+)\/feedback$/);
    const learningUser = (match) => match ? decodeURIComponent(match[1]) : "";
    const learningKey = (userId) => `state_${userId}`;
    const emptyLearningState = (userId) => ({
      schema_version: 1, user_id: userId, conversations: [], messages: [],
      learning_events: [], concepts: [], concept_relations: [], user_thoughts: [],
      misconceptions: [], user_concept_states: [], learning_notes: [],
      weaknesses: [], updated_at: null
    });
    const loadLearningState = async (userId) => await blobGetJSON("learning-memory", learningKey(userId)) || emptyLearningState(userId);
    const saveLearningState = async (state) => {
      state.updated_at = now();
      await blobSet("learning-memory", learningKey(state.user_id), JSON.stringify(state));
      return state;
    };
    const newLearningId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

    if (lmRoot && method === "GET") {
      return json({ ok: true, state: await loadLearningState(learningUser(lmRoot)) });
    }
    if (lmConversations && method === "GET") {
      const userId = learningUser(lmConversations);
      const state = await loadLearningState(userId);
      return json({ ok: true, conversations: state.conversations });
    }
    if (lmConversations && method === "POST") {
      const userId = learningUser(lmConversations), data = await parseBody(req);
      if (!userId) return json({ ok: false, message: "缺少用户 ID" }, 400);
      const state = await loadLearningState(userId);
      const conversation = {
        id: String(data.id || newLearningId("conv")).slice(0, 100), user_id: userId,
        title: String(data.title || "新学习对话").slice(0, 200),
        created_at: now(), updated_at: now(), metadata: data.metadata || {}
      };
      state.conversations.unshift(conversation);
      await saveLearningState(state);
      return json({ ok: true, conversation });
    }
    if (lmConversation && method === "GET") {
      const userId = learningUser(lmConversation), conversationId = decodeURIComponent(lmConversation[2]);
      const state = await loadLearningState(userId);
      const conversation = state.conversations.find(item => item.id === conversationId);
      if (!conversation) return json({ ok: false, message: "会话不存在" }, 404);
      return json({ ok: true, conversation, messages: state.messages.filter(item => item.conversation_id === conversationId) });
    }
    if (lmMessages && method === "POST") {
      const userId = learningUser(lmMessages), conversationId = decodeURIComponent(lmMessages[2]), data = await parseBody(req);
      const state = await loadLearningState(userId);
      const conversation = state.conversations.find(item => item.id === conversationId);
      if (!conversation) return json({ ok: false, message: "会话不存在" }, 404);
      if (!["user", "assistant", "system"].includes(data.role) || !data.content) return json({ ok: false, message: "消息格式无效" }, 400);
      const message = {
        id: String(data.id || newLearningId("msg")).slice(0, 100), user_id: userId,
        conversation_id: conversationId, role: data.role,
        content: String(data.content).slice(0, 20000),
        content_type: String(data.content_type || "text").slice(0, 30),
        metadata: data.metadata || {}, created_at: now()
      };
      state.messages.push(message); conversation.updated_at = now();
      await saveLearningState(state);
      return json({ ok: true, message });
    }
    if (lmExtract && method === "POST") {
      const userId = learningUser(lmExtract), conversationId = decodeURIComponent(lmExtract[2]), data = await parseBody(req);
      const state = await loadLearningState(userId);
      if (!state.conversations.some(item => item.id === conversationId)) return json({ ok: false, message: "会话不存在" }, 404);
      const extracted = data.extracted || data;
      const noteId = newLearningId("note"), weaknessIds = [];
      const concepts = Array.isArray(extracted.concepts) ? extracted.concepts : [];
      concepts.forEach(item => {
        const key = String(item.concept_key || item.id || item.name || "").slice(0, 100);
        if (!key) return;
        if (!state.concepts.some(concept => concept.concept_key === key)) state.concepts.push({
          id: newLearningId("concept"), concept_key: key, name: String(item.name || key).slice(0, 200),
          type: "CONCEPT", confidence: item.confidence ?? null, source_message_ids: item.source_message_ids || [],
          created_at: now(), updated_at: now()
        });
      });
      (Array.isArray(extracted.concept_relations) ? extracted.concept_relations : []).forEach(item => {
        const source = String(item.source_concept_key || item.source || "").slice(0, 100);
        const target = String(item.target_concept_key || item.target || "").slice(0, 100);
        if (source && target && state.concepts.some(c => c.concept_key === source) && state.concepts.some(c => c.concept_key === target)) {
          state.concept_relations.push({ id: newLearningId("relation"), source_concept_id: source,
            target_concept_id: target, relation_type: String(item.relation_type || "RELATED_TO").slice(0, 50),
            description: String(item.description || "").slice(0, 1000), confidence: item.confidence ?? null,
            source_type: "ai", conversation_id: conversationId, created_at: now() });
        }
      });
      (Array.isArray(extracted.user_thoughts) ? extracted.user_thoughts : []).forEach(item => state.user_thoughts.push({
        id: newLearningId("thought"), user_id: userId, conversation_id: conversationId,
        content: String(item.content || "").slice(0, 4000), thought_type: item.type === "inferred" ? "inferred" : "explicit",
        source_message_ids: item.source_message_ids || [], confidence: item.confidence ?? null, created_at: now()
      }));
      (Array.isArray(extracted.misconceptions) ? extracted.misconceptions : []).forEach(item => {
        const id = newLearningId("misconception"); weaknessIds.push(id);
        state.misconceptions.push({ id, user_id: userId, conversation_id: conversationId,
          concept_ids: item.concept_ids || item.concept_keys || [], error_code: item.error_code || "UNCLASSIFIED",
          description: String(item.description || "").slice(0, 2000), status: ["suspected", "confirmed", "corrected", "recurring"].includes(item.status) ? item.status : "suspected",
          evidence_ids: item.source_message_ids || item.evidence_ids || [], confidence: item.confidence ?? null,
          first_detected_at: now(), last_detected_at: now(), occurrence_count: 1
        });
      });
      const note = { id: noteId, user_id: userId, conversation_id: conversationId,
        title: String(extracted.title || "本次工程力学学习记录").slice(0, 200),
        markdown_content: String(extracted.markdown_content || extracted.summary || "").slice(0, 20000),
        structured_content: extracted, version: 1, status: "draft", created_at: now(), updated_at: now() };
      state.learning_notes.unshift(note);
      (Array.isArray(extracted.ability_evidence) ? extracted.ability_evidence : []).forEach(item => state.user_concept_states.push({
        id: newLearningId("state"), user_id: userId, concept_id: item.concept_id || null,
        conversation_id: conversationId, ability_type: item.ability_type || "concept_understanding",
        mastery_level: item.result || "unknown", evidence_count: 1, correct_count: item.result === "correct" ? 1 : 0,
        partial_count: item.result === "partial" ? 1 : 0, incorrect_count: item.result === "incorrect" ? 1 : 0,
        hint_count: 0, evidence_ids: item.source_message_ids || [], confidence: item.confidence ?? null,
        last_updated_at: now()
      }));
      const actions = Array.isArray(extracted.suggested_actions) ? extracted.suggested_actions : [];
      weaknessIds.forEach((id, index) => state.weaknesses.unshift({ id: newLearningId("weakness"), user_id: userId,
        misconception_id: id, level: "suspected", score: null, reasons: "本次对话提取到待验证的错误理解",
        evidence_ids: extracted.misconceptions[index]?.source_message_ids || [], recommendation_id: actions[index]?.id || null,
        user_feedback: "unknown", created_at: now(), updated_at: now() }));
      await saveLearningState(state);
      return json({ ok: true, note, concept_count: concepts.length, weakness_count: weaknessIds.length,
        suggested_actions: actions, state });
    }
    if (lmEvents && method === "POST") {
      const userId = learningUser(lmEvents), data = await parseBody(req);
      const state = await loadLearningState(userId);
      if (!data.event_type || !data.evidence_type || !data.evidence_id) return json({ ok: false, message: "事件缺少类型或证据" }, 400);
      if (data.message_id && !state.messages.some(item => item.id === data.message_id)) return json({ ok: false, message: "关联消息不存在" }, 400);
      const event = {
        id: String(data.id || newLearningId("event")).slice(0, 100), user_id: userId,
        conversation_id: data.conversation_id || null, message_id: data.message_id || null,
        event_type: String(data.event_type).slice(0, 60), concept_id: data.concept_id || null,
        ability_type: data.ability_type || null, result: data.result || "unknown",
        error_type: data.error_type || null, evidence_type: String(data.evidence_type).slice(0, 40),
        evidence_id: String(data.evidence_id).slice(0, 160), confidence: data.confidence ?? null,
        payload: data.payload || {}, created_at: now()
      };
      state.learning_events.push(event); await saveLearningState(state);
      return json({ ok: true, event });
    }
    if (lmNotes && method === "GET") {
      const state = await loadLearningState(learningUser(lmNotes));
      return json({ ok: true, notes: state.learning_notes || [] });
    }
    if (lmNotes && method === "POST") {
      const userId = learningUser(lmNotes), data = await parseBody(req);
      if (!String(data.title || "").trim()) return json({ ok: false, message: "笔记标题不能为空" }, 400);
      const state = await loadLearningState(userId), noteId = newLearningId("note");
      const note = { id: noteId, user_id: userId, conversation_id: null,
        title: String(data.title).trim().slice(0, 200),
        markdown_content: String(data.markdown_content || "").slice(0, 20000),
        structured_content: { source: "manual", note_id: noteId }, version: 1, status: "draft",
        created_at: now(), updated_at: now() };
      state.learning_notes.unshift(note);
      state.concepts.push({ id: noteId, concept_key: noteId, name: note.title, type: "LEARNING_NOTE",
        confidence: 1, source_message_ids: [], created_at: now(), updated_at: now() });
      await saveLearningState(state);
      return json({ ok: true, note });
    }
    if (lmNote && method === "GET") {
      const state = await loadLearningState(learningUser(lmNote));
      const note = (state.learning_notes || []).find(item => item.id === decodeURIComponent(lmNote[2]));
      if (!note) return json({ ok: false, message: "学习笔记不存在" }, 404);
      return json({ ok: true, note });
    }
    if (lmNote && method === "POST") {
      const state = await loadLearningState(learningUser(lmNote));
      const note = (state.learning_notes || []).find(item => item.id === decodeURIComponent(lmNote[2]));
      if (!note) return json({ ok: false, message: "学习笔记不存在" }, 404);
      const data = await parseBody(req);
      if (data.title !== undefined) note.title = String(data.title).slice(0, 200);
      if (data.markdown_content !== undefined) note.markdown_content = String(data.markdown_content).slice(0, 20000);
      if (data.status !== undefined && ["draft", "confirmed", "edited"].includes(data.status)) note.status = data.status;
      note.updated_at = now(); await saveLearningState(state);
      return json({ ok: true, note });
    }
    if (lmNoteConfirm && method === "POST") {
      const state = await loadLearningState(learningUser(lmNoteConfirm));
      const note = (state.learning_notes || []).find(item => item.id === decodeURIComponent(lmNoteConfirm[2]));
      if (!note) return json({ ok: false, message: "学习笔记不存在" }, 404);
      note.status = "confirmed"; note.updated_at = now(); await saveLearningState(state);
      return json({ ok: true, note });
    }
    if (lmWeaknesses && method === "GET") {
      const state = await loadLearningState(learningUser(lmWeaknesses));
      return json({ ok: true, weaknesses: state.weaknesses || [] });
    }
    if (lmWeaknessFeedback && method === "POST") {
      const state = await loadLearningState(learningUser(lmWeaknessFeedback));
      const weakness = (state.weaknesses || []).find(item => item.id === decodeURIComponent(lmWeaknessFeedback[2]));
      if (!weakness) return json({ ok: false, message: "薄弱点不存在" }, 404);
      const data = await parseBody(req);
      if (!["accurate", "inaccurate", "unknown"].includes(data.feedback)) return json({ ok: false, message: "反馈值无效" }, 400);
      weakness.user_feedback = data.feedback; weakness.updated_at = now(); await saveLearningState(state);
      return json({ ok: true, weakness });
    }

    // ============ PERSONAL KNOWLEDGE NETWORK ============
    // Each user's graph is stored independently under the user id. The client
    // keeps the current user's id in localStorage, while the server validates
    // the payload shape and normalizes the graph before persisting it.
    const knowledgeMatch = path.match(/^\/knowledge-network\/([^/]+)$/);
    if (knowledgeMatch && method === "GET") {
      const userId = decodeURIComponent(knowledgeMatch[1]);
      const graph = await blobGetJSON("knowledge-network", `graph_${userId}`) || {
        user_id: userId, nodes: [], edges: [], updated_at: null
      };
      return json({ ok: true, graph });
    }

    if (knowledgeMatch && method === "POST") {
      const userId = decodeURIComponent(knowledgeMatch[1]);
      const data = await parseBody(req);
      if (!userId || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        return json({ ok: false, message: "知识网络数据格式无效" }, 400);
      }
      const nodeIds = new Set();
      const nodes = data.nodes.slice(0, 500).map((node, index) => {
        const id = String(node.id || `node_${Date.now()}_${index}`).slice(0, 80);
        nodeIds.add(id);
        return {
          id, label: String(node.label || "未命名知识点").slice(0, 100),
          type: String(node.type || "concept").slice(0, 30),
          note: String(node.note || "").slice(0, 2000),
          status: String(node.status || "learning").slice(0, 30)
        };
      });
      const edges = data.edges.slice(0, 1000).map(edge => ({
        id: String(edge.id || `${edge.source}-${edge.target}`).slice(0, 160),
        source: String(edge.source || ""), target: String(edge.target || ""),
        relation: String(edge.relation || "关联").slice(0, 50)
      })).filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target);
      const graph = { user_id: userId, nodes, edges, updated_at: now() };
      await blobSet("knowledge-network", `graph_${userId}`, JSON.stringify(graph));
      return json({ ok: true, graph });
    }

    if (knowledgeMatch && method === "DELETE") {
      const userId = decodeURIComponent(knowledgeMatch[1]);
      await blobDelete("knowledge-network", `graph_${userId}`);
      return json({ ok: true, message: "个人知识网络已清空" });
    }

    // ============ ADMIN DATA VIEWER ============

    if (path === "/admin/data" && method === "GET") {
      const qIndex = await blobGetJSON("questions", "index") || { questions: [] };
      const fIndex = await blobGetJSON("forum", "index") || { posts: [] };
      const accounts = await blobGetJSON("accounts", "users") || [];

      // Build admin-friendly data view
      const result = {
        questions: {
          count: qIndex.questions.length,
          items: qIndex.questions.map(q => ({
            id: q.id,
            title: q.title,
            module: q.module,
            difficulty: q.difficulty,
            knowledge_points: q.knowledge_points || []
          }))
        },
        forum: {
          count: fIndex.posts.length,
          items: fIndex.posts.map(p => ({
            id: p.id,
            title: p.title,
            author: p.author,
            time: p.time,
            category: p.category,
            views: p.views,
            replies: p.replies
          }))
        },
        accounts: {
          count: accounts.length,
          items: accounts.map(u => ({
            id: u.id,
            name: u.name,
            student_id: u.student_id,
            role: u.role,
            created: u.created
          }))
        }
      };
      return json({ ok: true, data: result });
    }

    // 404
    return json({ ok: false, message: `未知API: ${method} ${path}` }, 404);

  } catch (e) {
    console.error("[api] Unhandled error:", e.message, e.stack);
    return json({ ok: false, message: `服务器错误: ${e.message}` }, 500);
  }
}
