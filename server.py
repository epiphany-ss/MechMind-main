#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
理论力学研究平台 - 后端服务器
提供题目上传/删除 API，数据直接写入 qdata/ 文件夹
"""

import json
import os
import re
import shutil
import base64
import hashlib
from datetime import datetime
from http.server import HTTPServer, ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

import tts_utils  # 语音讲解（edge-tts）

# 项目根目录（server.py 所在目录）
ROOT = Path(__file__).resolve().parent
QDATA = ROOT / 'qdata'
INDEX_PATH = QDATA / 'index.json'
UPLOAD_IMG_DIR = QDATA  # 图片存在 qdata/ 下

FDATA = ROOT / 'fdata'
FORUM_INDEX = FDATA / 'index.json'
PDATA = ROOT / 'pdata'

PORT = 8080


def load_index():
    """读取 index.json，不存在则返回空结构"""
    if INDEX_PATH.exists():
        with open(INDEX_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"questions": []}


def save_index(data):
    """写入 index.json"""
    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_forum():
    if FORUM_INDEX.exists():
        with open(FORUM_INDEX, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"posts": []}


def save_forum(data):
    with open(FORUM_INDEX, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_max_id(questions):
    """获取已用 ID 中的最大数字编号"""
    max_n = 0
    for q in questions:
        m = re.match(r'q_(\d{3})', q.get('id', ''))
        if m:
            n = int(m.group(1))
            if n > max_n:
                max_n = n
    return max_n


def save_base64_image(data_uri, folder, filename):
    """将 base64 data URI 解码保存为文件，返回文件名"""
    if not data_uri or ',' not in data_uri:
        return ''
    header, b64 = data_uri.split(',', 1)
    # 推断扩展名
    ext = '.png'
    if 'jpeg' in header or 'jpg' in header:
        ext = '.jpg'
    elif 'gif' in header:
        ext = '.gif'
    elif 'webp' in header:
        ext = '.webp'

    filepath = folder / f'{filename}{ext}'
    try:
        raw = base64.b64decode(b64)
        with open(filepath, 'wb') as f:
            f.write(raw)
        return filepath.name
    except Exception:
        return ''


def save_figure_base64(data_uri, folder):
    """保存题目图例"""
    if not data_uri or ',' not in data_uri:
        return ''
    header, b64 = data_uri.split(',', 1)
    ext = '.png'
    if 'jpeg' in header or 'jpg' in header:
        ext = '.jpg'
    elif 'gif' in header:
        ext = '.gif'
    elif 'webp' in header:
        ext = '.webp'
    elif 'pdf' in header:
        ext = '.pdf'

    filepath = folder / f'figure{ext}'
    try:
        raw = base64.b64decode(b64)
        with open(filepath, 'wb') as f:
            f.write(raw)
        return filepath.name
    except Exception:
        return ''


class Handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        """简化日志输出"""
        print(f"[{self.command}] {args[0]}")

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.lstrip('/')

        # Forum API
        if path == 'api/forum/list':
            self.handle_forum_list()
            return

        if path.startswith('api/knowledge-network/'):
            self.handle_knowledge_network('GET')
            return

        if path.startswith('api/learning-memory/'):
            self.handle_learning_memory('GET')
            return

        # 语音讲解 API
        if path == 'api/tts-prompt':
            self.send_json(200, {'ok': True, 'prompt': tts_utils.load_tts_prompt()})
            return

        if path == 'api/voices':
            self.send_json(200, {'ok': True, 'voices': tts_utils.VOICES})
            return

        # 默认首页
        if path == '' or path == '/':
            path = 'index.html'

        file_path = ROOT / path

        try:
            file_path.resolve().relative_to(ROOT.resolve())
        except ValueError:
            self.send_error(403, 'Forbidden')
            return

        if file_path.exists() and file_path.is_file():
            ext_map = {
                '.html': 'text/html; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.pdf': 'application/pdf',
                '.ico': 'image/x-icon',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.ttf': 'font/ttf',
                '.eot': 'application/vnd.ms-fontobject',
                '.otf': 'font/otf',
            }
            content_type = ext_map.get(file_path.suffix, 'application/octet-stream')
            self.send_response(200)
            self.send_cors()
            self.send_header('Content-Type', content_type)
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            # 全部按原始字节读取，保证服务器提供的内容与本地文件逐字节一致（不做行尾符/编码转换）
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, 'Not Found')

    def do_POST(self):
        if self.path == '/api/upload':
            self.handle_upload()
        elif self.path == '/api/forum/upload':
            self.handle_forum_upload()
        elif self.path == '/api/account/register':
            self.handle_account_register()
        elif self.path.startswith('/api/account/promote/'):
            self.handle_account_promote()
        elif self.path.startswith('/api/knowledge-network/'):
            self.handle_knowledge_network('POST')
        elif self.path.startswith('/api/learning-memory/'):
            self.handle_learning_memory('POST')
        elif self.path == '/api/tts':
            self.handle_tts_preview()
        elif self.path == '/api/narrate':
            self.handle_narrate()
        else:
            self.send_error(404, 'Not Found')

    def do_DELETE(self):
        if self.path.startswith('/api/delete/'):
            self.handle_delete()
        elif self.path.startswith('/api/forum/delete/'):
            self.handle_forum_delete()
        elif self.path.startswith('/api/account/delete/'):
            self.handle_account_delete()
        elif self.path.startswith('/api/knowledge-network/'):
            self.handle_knowledge_network('DELETE')
        elif self.path.startswith('/api/narrate'):
            self.handle_narrate_delete()
        else:
            self.send_error(404, 'Not Found')

    def handle_knowledge_network(self, method):
        """读取、保存或清空某个用户的个人知识网络。"""
        user_id = self.path.split('/api/knowledge-network/', 1)[1].split('?', 1)[0].strip()
        if not user_id or not re.match(r'^[A-Za-z0-9_.-]{1,80}$', user_id):
            self.send_json(400, {'ok': False, 'message': '用户 ID 无效'})
            return
        PDATA.mkdir(exist_ok=True)
        graph_file = PDATA / f'graph_{user_id}.json'
        if method == 'GET':
            if graph_file.exists():
                with open(graph_file, 'r', encoding='utf-8') as f:
                    graph = json.load(f)
            else:
                graph = {'user_id': user_id, 'nodes': [], 'edges': [], 'updated_at': None}
            self.send_json(200, {'ok': True, 'graph': graph})
            return
        if method == 'DELETE':
            if graph_file.exists():
                graph_file.unlink()
            self.send_json(200, {'ok': True, 'message': '个人知识网络已清空'})
            return

        length = int(self.headers.get('Content-Length', 0))
        try:
            data = json.loads(self.rfile.read(length).decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {'ok': False, 'message': 'JSON 数据无效'})
            return
        if not isinstance(data.get('nodes'), list) or not isinstance(data.get('edges'), list):
            self.send_json(400, {'ok': False, 'message': '知识网络数据格式无效'})
            return

        nodes = []
        node_ids = set()
        for i, node in enumerate(data['nodes'][:500]):
            node_id = str(node.get('id') or f'node_{int(datetime.now().timestamp())}_{i}')[:80]
            node_ids.add(node_id)
            nodes.append({
                'id': node_id,
                'label': str(node.get('label') or '未命名知识点')[:100],
                'type': str(node.get('type') or 'concept')[:30],
                'note': str(node.get('note') or '')[:2000],
                'status': str(node.get('status') or 'learning')[:30]
            })
        edges = []
        for edge in data['edges'][:1000]:
            source, target = str(edge.get('source') or ''), str(edge.get('target') or '')
            if source in node_ids and target in node_ids and source != target:
                edges.append({'id': str(edge.get('id') or f'{source}-{target}')[:160],
                              'source': source, 'target': target,
                              'relation': str(edge.get('relation') or '关联')[:50]})
        graph = {'user_id': user_id, 'nodes': nodes, 'edges': edges,
                 'updated_at': datetime.now().isoformat(timespec='seconds')}
        with open(graph_file, 'w', encoding='utf-8') as f:
            json.dump(graph, f, ensure_ascii=False, indent=2)
        self.send_json(200, {'ok': True, 'graph': graph})

    def handle_learning_memory(self, method):
        """统一学习记忆数据层：会话、消息、学习事件和后续扩展集合。"""
        suffix = self.path.split('/api/learning-memory/', 1)[1].split('?', 1)[0].strip('/')
        parts = suffix.split('/') if suffix else []
        user_id = parts[0] if parts else ''
        if not user_id or not re.match(r'^[A-Za-z0-9_.-]{1,80}$', user_id):
            self.send_json(400, {'ok': False, 'message': '用户 ID 无效'})
            return
        PDATA.mkdir(exist_ok=True)
        state_file = PDATA / f'memory_{user_id}.json'
        empty = {'schema_version': 1, 'user_id': user_id, 'conversations': [], 'messages': [],
                 'learning_events': [], 'concepts': [], 'concept_relations': [], 'user_thoughts': [],
                 'misconceptions': [], 'user_concept_states': [], 'learning_notes': [],
                 'weaknesses': [], 'updated_at': None}
        if state_file.exists():
            with open(state_file, 'r', encoding='utf-8') as f:
                state = json.load(f)
        else:
            state = empty

        def save_state():
            state['updated_at'] = datetime.now().isoformat(timespec='seconds')
            with open(state_file, 'w', encoding='utf-8') as f:
                json.dump(state, f, ensure_ascii=False, indent=2)

        if method == 'GET' and len(parts) == 1:
            self.send_json(200, {'ok': True, 'state': state})
            return
        if len(parts) >= 2 and parts[1] == 'conversations' and len(parts) == 2:
            if method == 'GET':
                self.send_json(200, {'ok': True, 'conversations': state['conversations']})
                return
            if method == 'POST':
                data = self.read_json_body()
                conversation = {'id': str(data.get('id') or self.new_learning_id('conv'))[:100],
                                'user_id': user_id, 'title': str(data.get('title') or '新学习对话')[:200],
                                'created_at': self.learning_now(), 'updated_at': self.learning_now(),
                                'metadata': data.get('metadata') or {}}
                state['conversations'].insert(0, conversation); save_state()
                self.send_json(200, {'ok': True, 'conversation': conversation})
                return
        if len(parts) == 3 and parts[1] == 'conversations' and method == 'GET':
            conversation_id = parts[2]
            conversation = next((c for c in state['conversations'] if c.get('id') == conversation_id), None)
            if not conversation:
                self.send_json(404, {'ok': False, 'message': '会话不存在'}); return
            messages = [m for m in state['messages'] if m.get('conversation_id') == conversation_id]
            self.send_json(200, {'ok': True, 'conversation': conversation, 'messages': messages}); return
        if len(parts) >= 4 and parts[1] == 'conversations' and parts[3] == 'messages' and method == 'POST':
            conversation_id = parts[2]
            if not any(c.get('id') == conversation_id for c in state['conversations']):
                self.send_json(404, {'ok': False, 'message': '会话不存在'}); return
            data = self.read_json_body()
            if data.get('role') not in ('user', 'assistant', 'system') or not data.get('content'):
                self.send_json(400, {'ok': False, 'message': '消息格式无效'}); return
            message = {'id': str(data.get('id') or self.new_learning_id('msg'))[:100], 'user_id': user_id,
                       'conversation_id': conversation_id, 'role': data['role'],
                       'content': str(data['content'])[:20000], 'content_type': str(data.get('content_type') or 'text')[:30],
                       'metadata': data.get('metadata') or {}, 'created_at': self.learning_now()}
            state['messages'].append(message)
            for c in state['conversations']:
                if c.get('id') == conversation_id: c['updated_at'] = self.learning_now()
            save_state(); self.send_json(200, {'ok': True, 'message': message}); return
        if len(parts) == 4 and parts[1] == 'conversations' and parts[3] == 'extract' and method == 'POST':
            conversation_id = parts[2]
            if not any(c.get('id') == conversation_id for c in state['conversations']):
                self.send_json(404, {'ok': False, 'message': '会话不存在'}); return
            data = self.read_json_body(); extracted = data.get('extracted') or data
            concepts = extracted.get('concepts') if isinstance(extracted.get('concepts'), list) else []
            for item in concepts:
                key = str(item.get('concept_key') or item.get('id') or item.get('name') or '')[:100]
                if key and not any(c.get('concept_key') == key for c in state['concepts']):
                    state['concepts'].append({'id': self.new_learning_id('concept'), 'concept_key': key,
                        'name': str(item.get('name') or key)[:200], 'type': 'CONCEPT',
                        'confidence': item.get('confidence'), 'source_message_ids': item.get('source_message_ids') or [],
                        'created_at': self.learning_now(), 'updated_at': self.learning_now()})
            for item in extracted.get('concept_relations') if isinstance(extracted.get('concept_relations'), list) else []:
                source = str(item.get('source_concept_key') or item.get('source') or '')[:100]
                target = str(item.get('target_concept_key') or item.get('target') or '')[:100]
                if source and target and any(c.get('concept_key') == source for c in state['concepts']) and any(c.get('concept_key') == target for c in state['concepts']):
                    state['concept_relations'].append({'id': self.new_learning_id('relation'),
                        'source_concept_id': source, 'target_concept_id': target,
                        'relation_type': str(item.get('relation_type') or 'RELATED_TO')[:50],
                        'description': str(item.get('description') or '')[:1000], 'confidence': item.get('confidence'),
                        'source_type': 'ai', 'conversation_id': conversation_id, 'created_at': self.learning_now()})
            for item in extracted.get('user_thoughts') if isinstance(extracted.get('user_thoughts'), list) else []:
                state['user_thoughts'].append({'id': self.new_learning_id('thought'), 'user_id': user_id,
                    'conversation_id': conversation_id, 'content': str(item.get('content') or '')[:4000],
                    'thought_type': 'inferred' if item.get('type') == 'inferred' else 'explicit',
                    'source_message_ids': item.get('source_message_ids') or [], 'confidence': item.get('confidence'),
                    'created_at': self.learning_now()})
            misconception_ids = []; misconception_evidence = []
            for item in extracted.get('misconceptions') if isinstance(extracted.get('misconceptions'), list) else []:
                mid = self.new_learning_id('misconception'); misconception_ids.append(mid)
                misconception_evidence.append(item.get('source_message_ids') or item.get('evidence_ids') or [])
                state['misconceptions'].append({'id': mid, 'user_id': user_id, 'conversation_id': conversation_id,
                    'concept_ids': item.get('concept_ids') or item.get('concept_keys') or [],
                    'error_code': item.get('error_code') or 'UNCLASSIFIED', 'description': str(item.get('description') or '')[:2000],
                    'status': item.get('status') if item.get('status') in ('suspected', 'confirmed', 'corrected', 'recurring') else 'suspected',
                    'evidence_ids': item.get('source_message_ids') or item.get('evidence_ids') or [],
                    'confidence': item.get('confidence'), 'first_detected_at': self.learning_now(),
                    'last_detected_at': self.learning_now(), 'occurrence_count': 1})
            note = {'id': self.new_learning_id('note'), 'user_id': user_id, 'conversation_id': conversation_id,
                    'title': str(extracted.get('title') or '本次工程力学学习记录')[:200],
                    'markdown_content': str(extracted.get('markdown_content') or extracted.get('summary') or '')[:20000],
                    'structured_content': extracted, 'version': 1, 'status': 'draft',
                    'created_at': self.learning_now(), 'updated_at': self.learning_now()}
            state['learning_notes'].insert(0, note)
            for item in extracted.get('ability_evidence') if isinstance(extracted.get('ability_evidence'), list) else []:
                result = item.get('result') or 'unknown'
                state['user_concept_states'].append({'id': self.new_learning_id('state'), 'user_id': user_id,
                    'concept_id': item.get('concept_id'), 'conversation_id': conversation_id,
                    'ability_type': item.get('ability_type') or 'concept_understanding', 'mastery_level': result,
                    'evidence_count': 1, 'correct_count': 1 if result == 'correct' else 0,
                    'partial_count': 1 if result == 'partial' else 0, 'incorrect_count': 1 if result == 'incorrect' else 0,
                    'hint_count': 0, 'evidence_ids': item.get('source_message_ids') or [],
                    'confidence': item.get('confidence'), 'last_updated_at': self.learning_now()})
            actions = extracted.get('suggested_actions') if isinstance(extracted.get('suggested_actions'), list) else []
            for index, mid in enumerate(misconception_ids):
                state['weaknesses'].insert(0, {'id': self.new_learning_id('weakness'), 'user_id': user_id,
                    'misconception_id': mid, 'level': 'suspected', 'score': None,
                    'reasons': '本次对话提取到待验证的错误理解', 'evidence_ids': misconception_evidence[index],
                    'recommendation_id': actions[index].get('id') if index < len(actions) else None,
                    'user_feedback': 'unknown', 'created_at': self.learning_now(), 'updated_at': self.learning_now()})
            save_state(); self.send_json(200, {'ok': True, 'note': note, 'concept_count': len(concepts),
                'weakness_count': len(misconception_ids), 'suggested_actions': actions, 'state': state}); return
        if len(parts) == 2 and parts[1] == 'notes' and method == 'GET':
            self.send_json(200, {'ok': True, 'notes': state['learning_notes']}); return
        if len(parts) == 2 and parts[1] == 'notes' and method == 'POST':
            data = self.read_json_body()
            if not str(data.get('title') or '').strip():
                self.send_json(400, {'ok': False, 'message': '笔记标题不能为空'}); return
            note = {'id': self.new_learning_id('note'), 'user_id': user_id, 'conversation_id': None,
                    'title': str(data.get('title')).strip()[:200], 'markdown_content': str(data.get('markdown_content') or '')[:20000],
                    'structured_content': {'source': 'manual', 'note_id': self.new_learning_id('note_ref')}, 'version': 1, 'status': 'draft',
                    'created_at': self.learning_now(), 'updated_at': self.learning_now()}
            # Use the note id itself as a graph node id so the note is directly addressable.
            note['structured_content']['note_id'] = note['id']
            state['learning_notes'].insert(0, note)
            state['concepts'].append({'id': note['id'], 'concept_key': note['id'], 'name': note['title'],
                'type': 'LEARNING_NOTE', 'confidence': 1, 'source_message_ids': [],
                'created_at': self.learning_now(), 'updated_at': self.learning_now()})
            save_state()
            self.send_json(200, {'ok': True, 'note': note}); return
        if len(parts) == 3 and parts[1] == 'notes' and method == 'GET':
            note = next((n for n in state['learning_notes'] if n.get('id') == parts[2]), None)
            if not note: self.send_json(404, {'ok': False, 'message': '学习笔记不存在'}); return
            self.send_json(200, {'ok': True, 'note': note}); return
        if len(parts) == 3 and parts[1] == 'notes' and method == 'POST':
            note = next((n for n in state['learning_notes'] if n.get('id') == parts[2]), None)
            if not note: self.send_json(404, {'ok': False, 'message': '学习笔记不存在'}); return
            data = self.read_json_body()
            if 'title' in data: note['title'] = str(data['title'])[:200]
            if 'markdown_content' in data: note['markdown_content'] = str(data['markdown_content'])[:20000]
            if data.get('status') in ('draft', 'confirmed', 'edited'): note['status'] = data['status']
            note['updated_at'] = self.learning_now(); save_state(); self.send_json(200, {'ok': True, 'note': note}); return
        if len(parts) == 4 and parts[1] == 'notes' and parts[3] == 'confirm' and method == 'POST':
            note = next((n for n in state['learning_notes'] if n.get('id') == parts[2]), None)
            if not note: self.send_json(404, {'ok': False, 'message': '学习笔记不存在'}); return
            note['status'] = 'confirmed'; note['updated_at'] = self.learning_now(); save_state()
            self.send_json(200, {'ok': True, 'note': note}); return
        if len(parts) == 2 and parts[1] == 'weaknesses' and method == 'GET':
            self.send_json(200, {'ok': True, 'weaknesses': state['weaknesses']}); return
        if len(parts) == 4 and parts[1] == 'weaknesses' and parts[3] == 'feedback' and method == 'POST':
            weakness = next((w for w in state['weaknesses'] if w.get('id') == parts[2]), None)
            if not weakness: self.send_json(404, {'ok': False, 'message': '薄弱点不存在'}); return
            data = self.read_json_body()
            if data.get('feedback') not in ('accurate', 'inaccurate', 'unknown'):
                self.send_json(400, {'ok': False, 'message': '反馈值无效'}); return
            weakness['user_feedback'] = data['feedback']; weakness['updated_at'] = self.learning_now(); save_state()
            self.send_json(200, {'ok': True, 'weakness': weakness}); return
        if len(parts) == 2 and parts[1] == 'events' and method == 'POST':
            data = self.read_json_body()
            if not data.get('event_type') or not data.get('evidence_type') or not data.get('evidence_id'):
                self.send_json(400, {'ok': False, 'message': '事件缺少类型或证据'}); return
            if data.get('message_id') and not any(m.get('id') == data['message_id'] for m in state['messages']):
                self.send_json(400, {'ok': False, 'message': '关联消息不存在'}); return
            event = {'id': str(data.get('id') or self.new_learning_id('event'))[:100], 'user_id': user_id,
                     'conversation_id': data.get('conversation_id'), 'message_id': data.get('message_id'),
                     'event_type': str(data['event_type'])[:60], 'concept_id': data.get('concept_id'),
                     'ability_type': data.get('ability_type'), 'result': data.get('result') or 'unknown',
                     'error_type': data.get('error_type'), 'evidence_type': str(data['evidence_type'])[:40],
                     'evidence_id': str(data['evidence_id'])[:160], 'confidence': data.get('confidence'),
                     'payload': data.get('payload') or {}, 'created_at': self.learning_now()}
            state['learning_events'].append(event); save_state()
            self.send_json(200, {'ok': True, 'event': event}); return
        self.send_json(404, {'ok': False, 'message': '未知学习记忆接口'})

    def read_json_body(self):
        length = int(self.headers.get('Content-Length', 0))
        try:
            return json.loads(self.rfile.read(length).decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    @staticmethod
    def learning_now():
        return datetime.now().isoformat(timespec='seconds')

    @staticmethod
    def new_learning_id(prefix):
        return f'{prefix}_{int(datetime.now().timestamp() * 1000):x}_{os.urandom(4).hex()}'

    def handle_upload(self):
        """处理题目上传"""
        # 读取请求体
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_json(400, {'ok': False, 'message': 'JSON 解析失败'})
            return

        # 验证必填字段
        required = ['module', 'difficulty', 'answer', 'explanation']
        missing = [k for k in required if not data.get(k, '').strip()]
        if missing:
            self.send_json(400, {'ok': False, 'message': f'缺少必填字段: {", ".join(missing)}'})
            return

        content_text = data.get('content', '').strip()
        if not content_text:
            self.send_json(400, {'ok': False, 'message': '题目内容不能为空'})
            return

        # 读取现有数据
        index_data = load_index()
        questions = index_data.get('questions', [])

        # 生成新 ID
        max_n = get_max_id(questions)
        new_id = f'q_{max_n + 1:03d}'

        # 自动生成 title（取内容前 30 字）
        title = re.sub(r'<[^>]*>', '', content_text)
        title = re.sub(r'\s+', ' ', title).strip()
        if len(title) > 30:
            title = title[:30] + '…'

        # 创建题目文件夹
        folder = QDATA / new_id
        folder.mkdir(parents=True, exist_ok=True)

        # 保存图例
        figure_name = ''
        figure_data = data.get('_figureData', '')
        if figure_data:
            figure_name = save_figure_base64(figure_data, folder)

        # 处理内容中的内联图片，替换为文件引用
        content = data.get('content', '')
        content_imgs = data.get('_contentImages', [])
        if content_imgs:
            for i, img_data in enumerate(content_imgs):
                saved_name = save_base64_image(img_data, folder, f'content_img_{i}')
                # 替换内联 data URI（匹配第一个 data URI）
                content = re.sub(
                    r'<img\s+src="' + re.escape(img_data) + r'"',
                    f'<img src="{saved_name}"',
                    content,
                    count=1
                )

        answer = data.get('answer', '')
        answer_imgs = data.get('_answerImages', [])
        if answer_imgs:
            for i, img_data in enumerate(answer_imgs):
                saved_name = save_base64_image(img_data, folder, f'answer_img_{i}')
                answer = re.sub(
                    r'<img\s+src="' + re.escape(img_data) + r'"',
                    f'<img src="{saved_name}"',
                    answer,
                    count=1
                )

        explanation = data.get('explanation', '')
        explanation_imgs = data.get('_explanationImages', [])
        if explanation_imgs:
            for i, img_data in enumerate(explanation_imgs):
                saved_name = save_base64_image(img_data, folder, f'explanation_img_{i}')
                explanation = re.sub(
                    r'<img\s+src="' + re.escape(img_data) + r'"',
                    f'<img src="{saved_name}"',
                    explanation,
                    count=1
                )

        # 构建题目数据
        question_data = {
            'id': new_id,
            'title': title,
            'content': content,
            'figure': figure_name,
            'knowledge_points': data.get('knowledge_points', []),
            'answer': answer,
            'explanation': explanation,
            'difficulty': data.get('difficulty', 'medium'),
            'module': data.get('module', '')
        }

        # 写入 data.json
        with open(folder / 'data.json', 'w', encoding='utf-8') as f:
            json.dump(question_data, f, ensure_ascii=False, indent=2)

        # 更新索引
        index_entry = {
            'id': new_id,
            'title': title,
            'difficulty': question_data['difficulty'],
            'knowledge_points': question_data['knowledge_points'],
            'module': question_data['module']
        }
        questions.append(index_entry)
        save_index(index_data)

        print(f'[OK] 题目已保存: {new_id} - {title}')

        self.send_json(200, {'ok': True, 'id': new_id, 'title': title})

    def handle_delete(self):
        """处理题目删除"""
        qid = self.path.replace('/api/delete/', '').strip()
        if not qid:
            self.send_json(400, {'ok': False, 'message': '缺少题目 ID'})
            return

        # 读取现有数据
        index_data = load_index()
        questions = index_data.get('questions', [])

        # 从索引中移除
        new_questions = [q for q in questions if q.get('id') != qid]
        if len(new_questions) == len(questions):
            self.send_json(404, {'ok': False, 'message': f'题目 {qid} 不存在'})
            return

        index_data['questions'] = new_questions
        save_index(index_data)

        # 删除题目文件夹
        folder = QDATA / qid
        if folder.exists():
            shutil.rmtree(folder)

        print(f'[OK] 题目已删除: {qid}')

        self.send_json(200, {'ok': True, 'message': f'题目 {qid} 已删除'})

    # ==================== 语音讲解 API ====================

    def read_body_json(self):
        """读取 JSON 请求体，失败返回 None 并已回写 400"""
        try:
            length = int(self.headers.get('Content-Length', 0))
        except (TypeError, ValueError):
            length = 0
        if length <= 0:
            return None
        try:
            return json.loads(self.rfile.read(length).decode('utf-8'))
        except Exception:
            self.send_json(400, {'ok': False, 'message': 'JSON 解析失败'})
            return None

    def handle_tts_preview(self):
        """试听讲解：按解析内容合成语音，直接返回 mp3 字节"""
        data = self.read_body_json()
        if data is None:
            return
        explanation = data.get('explanation', '')
        if not (explanation or '').strip():
            self.send_json(400, {'ok': False, 'message': '解析内容为空'})
            return
        voice = data.get('voice', 'girl')
        status, result = tts_utils.tts_preview(explanation, voice, data.get('overview', ''))
        if status == 200:
            self.send_response(200)
            self.send_cors()
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Content-Length', str(len(result)))
            self.end_headers()
            try:
                self.wfile.write(result)
            except ConnectionError:
                pass
        else:
            self.send_json(status, result)

    def handle_narrate(self):
        """生成并存储讲解音频到 qdata/q_XXX/"""
        data = self.read_body_json()
        if data is None:
            return
        qid = (data.get('id') or '').strip()
        voice = data.get('voice', 'girl')
        status, payload = tts_utils.narrate_question(qid, voice)
        self.send_json(status, payload)

    def handle_narrate_delete(self):
        """删除题目的讲解音频"""
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        qid = (qs.get('id') or [''])[0].strip()
        status, payload = tts_utils.delete_narration(qid)
        self.send_json(status, payload)

    def send_json(self, code, data):
        self.send_response(code)
        self.send_cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    # ==================== Forum API ====================

    def handle_forum_list(self):
        data = load_forum()
        self.send_json(200, {'ok': True, 'posts': data.get('posts', [])})

    def handle_forum_upload(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_json(400, {'ok': False, 'message': 'JSON 解析失败'})
            return

        category = data.get('category', '').strip()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        if not category:
            self.send_json(400, {'ok': False, 'message': '请选择分类'})
            return
        if not title:
            self.send_json(400, {'ok': False, 'message': '请输入标题'})
            return
        if not content:
            self.send_json(400, {'ok': False, 'message': '请输入内容'})
            return

        forum_data = load_forum()
        posts = forum_data.get('posts', [])
        max_n = 0
        for p in posts:
            m = re.match(r'f_(\d{3})', p.get('id', ''))
            if m:
                n = int(m.group(1))
                if n > max_n:
                    max_n = n
        new_id = f'f_{max_n + 1:03d}'

        # Handle images in content
        content_imgs = data.get('_contentImages', [])
        if content_imgs:
            for i, img_data in enumerate(content_imgs):
                saved_name = save_base64_image(img_data, FDATA, f'forum_{new_id}_{i}')
                content = re.sub(
                    r'<img\s+src="' + re.escape(img_data) + r'"',
                    f'<img src="fdata/{saved_name}"',
                    content,
                    count=1
                )

        post = {
            'id': new_id,
            'category': category,
            'title': title,
            'content': content,
            'author': data.get('author', '匿名用户').strip() or '匿名用户',
            'time': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'views': 0,
            'replies': 0
        }
        posts.insert(0, post)
        save_forum({'posts': posts})
        print(f'[Forum] 帖子已发布: {new_id} - {title}')
        self.send_json(200, {'ok': True, 'id': new_id, 'post': post})

    def handle_forum_delete(self):
        qid = self.path.replace('/api/forum/delete/', '').strip()
        if not qid:
            self.send_json(400, {'ok': False, 'message': '缺少帖子 ID'})
            return
        forum_data = load_forum()
        posts = forum_data.get('posts', [])
        new_posts = [p for p in posts if p.get('id') != qid]
        if len(new_posts) == len(posts):
            self.send_json(404, {'ok': False, 'message': f'帖子 {qid} 不存在'})
            return
        forum_data['posts'] = new_posts
        save_forum(forum_data)
        print(f'[Forum] 帖子已删除: {qid}')
        self.send_json(200, {'ok': True, 'message': f'帖子 {qid} 已删除'})

    # ==================== Account API ====================
    def handle_account_register(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_json(400, {'ok': False, 'message': 'JSON 解析失败'})
            return
        name = data.get('name', '').strip()
        sid = data.get('student_id', '').strip()
        pw = data.get('password', '').strip()
        if not name or not sid or len(pw) < 6:
            self.send_json(400, {'ok': False, 'message': '信息不完整'})
            return
        # Load existing users
        udata_file = ROOT / 'udata' / 'index.json'
        users = []
        if udata_file.exists():
            with open(udata_file, 'r', encoding='utf-8') as f:
                d = json.load(f)
                users = d.get('users', [])
        # Check duplicate
        for u in users:
            if u.get('student_id') == sid:
                self.send_json(400, {'ok': False, 'message': '该学号已注册'})
                return
        # Generate ID
        max_n = 100
        for u in users:
            m = re.match(r'u_(\d{3})', u.get('id', ''))
            if m:
                n = int(m.group(1))
                if n > max_n:
                    max_n = n
        new_id = f'u_{max_n + 1:03d}'
        new_user = {'id': new_id, 'name': name, 'student_id': sid, 'password': pw, 'role': 'user',
                    'created': datetime.now().strftime('%Y-%m-%d')}
        users.append(new_user)
        udata_file.parent.mkdir(parents=True, exist_ok=True)
        with open(udata_file, 'w', encoding='utf-8') as f:
            json.dump({'users': users}, f, ensure_ascii=False, indent=2)
        print(f'[Account] 用户注册: {new_id} - {name}')
        self.send_json(200, {'ok': True, 'user': {'name': name, 'student_id': sid, 'role': 'user', 'id': new_id}})

    def handle_account_delete(self):
        uid = self.path.replace('/api/account/delete/', '').strip()
        if not uid:
            self.send_json(400, {'ok': False, 'message': '缺少用户 ID'})
            return
        udata_file = ROOT / 'udata' / 'index.json'
        if not udata_file.exists():
            self.send_json(404, {'ok': False, 'message': '用户数据不存在'})
            return
        with open(udata_file, 'r', encoding='utf-8') as f:
            d = json.load(f)
        users = d.get('users', [])
        target = None
        for u in users:
            if u.get('id') == uid:
                target = u
                break
        if not target:
            self.send_json(404, {'ok': False, 'message': '用户不存在'})
            return
        if target.get('role') == 'admin':
            self.send_json(403, {'ok': False, 'message': '不能删除管理员账户'})
            return
        users = [u for u in users if u.get('id') != uid]
        with open(udata_file, 'w', encoding='utf-8') as f:
            json.dump({'users': users}, f, ensure_ascii=False, indent=2)
        print(f'[Account] 用户已删除: {uid}')
        self.send_json(200, {'ok': True, 'message': f'用户 {uid} 已删除'})

    def handle_account_promote(self):
        uid = self.path.replace('/api/account/promote/', '').strip()
        if not uid:
            self.send_json(400, {'ok': False, 'message': '缺少用户 ID'})
            return
        udata_file = ROOT / 'udata' / 'index.json'
        if not udata_file.exists():
            self.send_json(404, {'ok': False, 'message': '用户数据不存在'})
            return
        with open(udata_file, 'r', encoding='utf-8') as f:
            d = json.load(f)
        users = d.get('users', [])
        found = False
        for u in users:
            if u.get('id') == uid:
                u['role'] = 'admin'
                found = True
                break
        if not found:
            self.send_json(404, {'ok': False, 'message': '用户不存在'})
            return
        with open(udata_file, 'w', encoding='utf-8') as f:
            json.dump({'users': users}, f, ensure_ascii=False, indent=2)
        print(f'[Account] 用户提升为管理员: {uid}')
        self.send_json(200, {'ok': True, 'message': f'用户 {uid} 已提升为管理员'})


def main():
    print(f'==========================================')
    print(f'  理论力学研究平台 - 后端服务器')
    print(f'  地址: http://localhost:{PORT}')
    print(f'  根目录: {ROOT}')
    print(f'  数据目录: {QDATA}')
    print(f'==========================================')
    print(f'')
    print(f'  API 接口:')
    print(f'    POST /api/upload            上传题目')
    print(f'    DELETE /api/delete/:id       删除题目')
    print(f'    GET  /api/forum/list         获取帖子列表')
    print(f'    POST /api/forum/upload       发布新帖')
    print(f'    DELETE /api/forum/delete/:id 删除帖子')
    print(f'')
    print(f'  按 Ctrl+C 停止服务器')
    print(f'==========================================')

    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n服务器已停止')
        server.shutdown()


if __name__ == '__main__':
    main()
