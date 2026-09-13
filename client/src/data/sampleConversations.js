/**
 * SAMPLE DATA — shaped identically to what GET /api/conversations actually
 * returns (see server/routes/conversations.js + models/Conversation.js).
 * Each item: { _id, participants: [{_id,name,email,avatarSeed,isOnline,status}], lastMessage, lastMessageAt }
 *
 * To go live later: delete this file's usage in Chat.jsx and call
 * getConversations(token) from ../api/client instead — the shape already
 * matches, so ChatList itself needs zero changes.
 */
const now = Date.now();
const minutesAgo = (m) => new Date(now - m * 60_000).toISOString();

export const CURRENT_USER_ID = 'u_self';

export const sampleConversations = [
  {
    _id: 'c1',
    participants: [
      { _id: CURRENT_USER_ID, name: 'You', avatarSeed: 'fox', isOnline: true },
      { _id: 'u2', name: 'Meera Sanghvi', avatarSeed: 'owl', isOnline: true, status: 'Resting in the Bracken' }
    ],
    lastMessage: 'Call me when you\'re free, need to figure out the venue',
    lastMessageAt: minutesAgo(6),
    unread: true
  },
  {
    _id: 'c2',
    participants: [
      { _id: CURRENT_USER_ID, name: 'You', avatarSeed: 'fox', isOnline: true },
      { _id: 'u3', name: 'Devansh Rao', avatarSeed: 'deer', isOnline: false, status: 'Wandering off-grid' }
    ],
    lastMessage: 'haha yeah that tracks perfectly',
    lastMessageAt: minutesAgo(52),
    unread: false
  },
  {
    _id: 'c3',
    participants: [
      { _id: CURRENT_USER_ID, name: 'You', avatarSeed: 'fox', isOnline: true },
      { _id: 'u4', name: 'Priya Nambiar', avatarSeed: 'rabbit', isOnline: true, status: 'Nesting quietly' }
    ],
    lastMessage: 'sent the files over, let me know if anything is missing from the drive',
    lastMessageAt: minutesAgo(190),
    unread: true
  },
  {
    _id: 'c4',
    participants: [
      { _id: CURRENT_USER_ID, name: 'You', avatarSeed: 'fox', isOnline: true },
      { _id: 'u5', name: 'Arjun Vaidya', avatarSeed: 'owl', isOnline: false, status: 'Resting in the Bracken' }
    ],
    lastMessage: 'Ok, talk tomorrow 👍',
    lastMessageAt: minutesAgo(1400),
    unread: false
  }
];
