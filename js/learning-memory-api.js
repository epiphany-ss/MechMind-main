/* Client wrapper for the unified learning-memory API. */
(function (root) {
  'use strict';
  function accountId(user) { return user && (user.id || user.student_id) || 'anonymous'; }
  function request(url, options) {
    return fetch(url, options || {}).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok || data.ok === false) throw new Error(data.message || '请求失败');
        return data;
      });
    });
  }
  function base(user) { return '/api/learning-memory/' + encodeURIComponent(accountId(user)); }
  root.LearningMemoryAPI = {
    accountId: accountId,
    getState: function (user) { return request(base(user)); },
    createConversation: function (user, data) {
      return request(base(user) + '/conversations', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data || {}) });
    },
    listConversations: function (user) { return request(base(user) + '/conversations'); },
    getConversation: function (user, conversationId) { return request(base(user) + '/conversations/' + encodeURIComponent(conversationId)); },
    appendMessage: function (user, conversationId, data) {
      return request(base(user) + '/conversations/' + encodeURIComponent(conversationId) + '/messages', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data || {}) });
    },
    appendEvent: function (user, data) {
      return request(base(user) + '/events', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data || {}) });
    },
    extractConversation: function (user, conversationId, extracted) {
      return request(base(user) + '/conversations/' + encodeURIComponent(conversationId) + '/extract', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({extracted: extracted || {}}) });
    },
    listNotes: function (user) { return request(base(user) + '/notes'); },
    createNote: function (user, data) { return request(base(user) + '/notes', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data || {}) }); },
    getNote: function (user, noteId) { return request(base(user) + '/notes/' + encodeURIComponent(noteId)); },
    updateNote: function (user, noteId, data) { return request(base(user) + '/notes/' + encodeURIComponent(noteId), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data || {}) }); },
    confirmNote: function (user, noteId) { return request(base(user) + '/notes/' + encodeURIComponent(noteId) + '/confirm', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' }); },
    listWeaknesses: function (user) { return request(base(user) + '/weaknesses'); },
    feedbackWeakness: function (user, weaknessId, feedback) { return request(base(user) + '/weaknesses/' + encodeURIComponent(weaknessId) + '/feedback', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({feedback: feedback}) }); }
  };
})(typeof window !== 'undefined' ? window : this);
