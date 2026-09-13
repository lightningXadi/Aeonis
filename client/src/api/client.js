const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Thin wrapper around fetch: always sends/expects JSON, throws a plain
 * Error with the server's message on non-2xx so callers can just try/catch.
 */
async function request(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    // Server not running / unreachable — give a human-readable reason
    // rather than a raw "Failed to fetch".
    throw new Error('Could not reach the server. Is it running?');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export function signup({ name, email, password }) {
  return request('/auth/signup', { method: 'POST', body: { name, email, password } });
}

export function login({ email, password }) {
  return request('/auth/login', { method: 'POST', body: { email, password } });
}

export function googleAuth(credential) {
  return request('/auth/google', { method: 'POST', body: { credential } });
}

export function getConversations(token) {
  return request('/conversations', { token });
}

export function createConversation(token, otherUserId) {
  return request('/conversations', { method: 'POST', token, body: { otherUserId } });
}

export function createGroup(token, { name, participantIds, avatarSeed }) {
  return request('/conversations/group', { method: 'POST', token, body: { name, participantIds, avatarSeed } });
}

export function getConversationDetails(token, conversationId) {
  return request(`/conversations/${conversationId}`, { token });
}

export function updateGroup(token, conversationId, updates) {
  return request(`/conversations/${conversationId}`, { method: 'PATCH', token, body: updates });
}

export function addGroupMember(token, conversationId, userId) {
  return request(`/conversations/${conversationId}/members`, { method: 'POST', token, body: { userId } });
}

export function removeGroupMember(token, conversationId, userId) {
  return request(`/conversations/${conversationId}/members/${userId}`, { method: 'DELETE', token });
}

export function promoteModerator(token, conversationId, userId) {
  return request(`/conversations/${conversationId}/moderators`, { method: 'POST', token, body: { userId } });
}

export function demoteModerator(token, conversationId, userId) {
  return request(`/conversations/${conversationId}/moderators/${userId}`, { method: 'DELETE', token });
}

export function getMessages(token, conversationId) {
  return request(`/conversations/${conversationId}/messages`, { token });
}

export function getMe(token) {
  return request('/users/me', { token });
}

export function getTurnCredentials(token) {
  return request('/turn-credentials', { token });
}

export function updateMe(token, updates) {
  return request('/users/me', { method: 'PATCH', token, body: updates });
}

export function searchUsers(token, q) {
  return request(`/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, { token });
}

export function getFriends(token) {
  return request('/friends', { token });
}

export function getFriendRequests(token) {
  return request('/friends/requests', { token });
}

export function sendFriendRequest(token, toUserId) {
  return request('/friends/request', { method: 'POST', token, body: { toUserId } });
}

export function acceptFriendRequest(token, requestId) {
  return request(`/friends/requests/${requestId}/accept`, { method: 'POST', token });
}

export function rejectFriendRequest(token, requestId) {
  return request(`/friends/requests/${requestId}/reject`, { method: 'POST', token });
}

export function removeFriend(token, userId) {
  return request(`/friends/${userId}`, { method: 'DELETE', token });
}
