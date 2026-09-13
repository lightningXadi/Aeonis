const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  isGroup: { type: Boolean, default: false },
  name: { type: String, trim: true },              // group chats only
  avatarSeed: { type: String, default: 'fox' },     // group chats only — reuses the same 4 creature icons
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // group chats only — the Creator
  moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // group chats only — Creator promotes members to this
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
