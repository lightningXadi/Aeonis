const jwt = require('jsonwebtoken');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const User = require('./models/User');

// userId -> Set of socket ids (a user may have multiple tabs open)
const onlineUsers = new Map();

function addSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function removeSocket(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
}

function socketsFor(userId) {
  return Array.from(onlineUsers.get(userId) || []);
}

module.exports = function initSocket(io) {
  // Auth handshake: client sends the JWT once when connecting
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch (err) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    addSocket(userId, socket.id);
    socket.join(`user:${userId}`);

    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
    socket.broadcast.emit('presence:update', { userId, isOnline: true });

    // ---- Chat messages ----
    socket.on('message:send', async ({ conversationId, text, type, callStatus, callDuration }, ack) => {
      try {
        if (!text || !text.trim()) return ack?.({ error: 'Empty message' });
        const convo = await Conversation.findById(conversationId);
        if (!convo || !convo.participants.some(p => p.toString() === userId)) {
          return ack?.({ error: 'Not part of this conversation' });
        }
        const message = await Message.create({
          conversation: conversationId, sender: userId, text: text.trim(), readBy: [userId],
          type: type === 'call' ? 'call' : 'text',
          ...(type === 'call' ? { callStatus, callDuration: callDuration || 0 } : {})
        });
        convo.lastMessage = type === 'call' ? text.trim() : text.trim();
        convo.lastMessageAt = new Date();
        await convo.save();

        const payload = {
          id: message._id, conversation: conversationId, sender: userId,
          text: message.text, createdAt: message.createdAt,
          type: message.type, callStatus: message.callStatus, callDuration: message.callDuration
        };
        convo.participants.forEach(p => io.to(`user:${p.toString()}`).emit('message:new', payload));
        ack?.({ ok: true, message: payload });
      } catch (err) {
        console.error(err);
        ack?.({ error: 'Failed to send message' });
      }
    });

    socket.on('typing:start', ({ conversationId, toUserId }) => {
      io.to(`user:${toUserId}`).emit('typing:start', { conversationId, fromUserId: userId });
    });
    socket.on('typing:stop', ({ conversationId, toUserId }) => {
      io.to(`user:${toUserId}`).emit('typing:stop', { conversationId, fromUserId: userId });
    });

    // ---- WebRTC audio-call signaling ----
    // callParticipants (optional) lets a multi-party call tell a new
    // invitee who else is already on the call.
    socket.on('call:invite', ({ toUserId, conversationId, offer, callParticipants, fromUser }) => {
      io.to(`user:${toUserId}`).emit('call:incoming', { fromUserId: userId, fromUser, conversationId, offer, callParticipants: callParticipants || [] });
    });
    socket.on('call:answer', ({ toUserId, answer }) => {
      io.to(`user:${toUserId}`).emit('call:answered', { fromUserId: userId, answer });
    });
    socket.on('call:ice-candidate', ({ toUserId, candidate }) => {
      io.to(`user:${toUserId}`).emit('call:ice-candidate', { fromUserId: userId, candidate });
    });
    socket.on('call:decline', ({ toUserId }) => {
      io.to(`user:${toUserId}`).emit('call:declined', { fromUserId: userId });
    });
    socket.on('call:end', ({ toUserId }) => {
      io.to(`user:${toUserId}`).emit('call:ended', { fromUserId: userId });
    });
    // Relayed by whoever just added someone to an ongoing call, to every
    // OTHER existing participant — tells their client to independently
    // open its own direct connection to the new joiner (full mesh).
    socket.on('call:peer-joined', ({ toUserId, newUser }) => {
      io.to(`user:${toUserId}`).emit('call:peer-joined', { fromUserId: userId, newUser });
    });

    socket.on('disconnect', async () => {
      removeSocket(userId, socket.id);
      if (!onlineUsers.has(userId)) {
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        socket.broadcast.emit('presence:update', { userId, isOnline: false });
      }
    });
  });
};
