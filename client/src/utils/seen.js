// The backend doesn't track per-user unread state, so unread is tracked on
// this device: we remember the timestamp of the newest message you've seen in
// each conversation. Anything newer than that is "unread".
const KEY = 'aeonis_seen';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function write(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* storage full/blocked — unread just won't persist */ }
}

export function markSeen(conversationId, at) {
  const map = read();
  const t = at ? new Date(at).getTime() : 0;
  map[conversationId] = Math.max(Date.now(), t);
  write(map);
}

export function isUnread(convo) {
  const seenAt = read()[convo._id];
  if (seenAt == null) return false;
  return new Date(convo.lastMessageAt).getTime() > seenAt;
}

/** First run on this device: don't flag your entire history as unread. */
export function seedSeen(conversations) {
  const map = read();
  let changed = false;
  conversations.forEach((c) => {
    if (map[c._id] == null) {
      map[c._id] = new Date(c.lastMessageAt).getTime();
      changed = true;
    }
  });
  if (changed) write(map);
}
