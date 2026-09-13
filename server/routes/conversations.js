const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// List conversations for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  const convos = await Conversation.find({ participants: req.userId })
    .populate('participants', 'name email avatarSeed isOnline status')
    .sort({ lastMessageAt: -1 });
  res.json(convos);
});

// Start or fetch an existing 1:1 conversation with another user
router.post('/', requireAuth, async (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required.' });

  let convo = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [req.userId, otherUserId], $size: 2 }
  });
  if (!convo) {
    convo = await Conversation.create({ participants: [req.userId, otherUserId] });
  }
  convo = await convo.populate('participants', 'name email avatarSeed isOnline status');
  res.json(convo);
});

// Create a new group conversation
router.post('/group', requireAuth, async (req, res) => {
  const { name, participantIds, avatarSeed } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required.' });
  if (!Array.isArray(participantIds) || participantIds.length < 1) {
    return res.status(400).json({ error: 'Pick at least one friend to add.' });
  }
  const CREATURES = ['fox', 'owl', 'rabbit', 'deer'];
  const participants = [req.userId, ...new Set(participantIds.filter((id) => id !== req.userId))];

  let convo = await Conversation.create({
    participants,
    isGroup: true,
    name: name.trim(),
    avatarSeed: CREATURES.includes(avatarSeed) ? avatarSeed : CREATURES[Math.floor(Math.random() * CREATURES.length)],
    createdBy: req.userId
  });
  convo = await convo.populate('participants', 'name email avatarSeed isOnline status');
  res.status(201).json(convo);
});

// Add a member to an existing group. If the conversation is still a plain
// 1:1 (e.g. someone was just added to an ongoing call), it gets promoted
// in-place into a real group first — everyone keeps the shared history and
// the person who triggered this becomes the Creator.
router.post('/:id/members', requireAuth, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required.' });

  const convo = await Conversation.findById(req.params.id);
  if (!convo || !convo.participants.some((p) => p.toString() === req.userId)) {
    return res.status(404).json({ error: 'Conversation not found.' });
  }

  if (!convo.isGroup) {
    // Upgrade path: was a 1:1, now becoming a group because a third person
    // is joining (typically via "add to call"). Name it using everyone
    // who'll be in it — including the person joining right now — not just
    // who was already there. Whoever triggers this becomes Creator.
    const allIds = [...new Set([...convo.participants.map((p) => p.toString()), userId])];
    const memberUsers = await User.find({ _id: { $in: allIds } }, 'name');
    const names = memberUsers.map((u) => u.name);
    convo.isGroup = true;
    convo.createdBy = req.userId;
    convo.name = names.length > 2 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names.join(' & ');
    if (!convo.avatarSeed) convo.avatarSeed = 'fox';
  } else {
    const isCreator = convo.createdBy?.toString() === req.userId;
    const isModerator = convo.moderators.some((m) => m.toString() === req.userId);
    if (!isCreator && !isModerator) {
      return res.status(403).json({ error: 'Only the creator or a moderator can add members.' });
    }
  }

  if (!convo.participants.some((p) => p.toString() === userId)) {
    convo.participants.push(userId);
  }
  await convo.save();
  const populated = await convo.populate('participants', 'name email avatarSeed isOnline status');
  res.json(populated);
});

// Promote a member to Moderator — Creator only
router.post('/:id/moderators', requireAuth, async (req, res) => {
  const { userId } = req.body;
  const convo = await Conversation.findById(req.params.id);
  if (!convo || !convo.isGroup) return res.status(404).json({ error: 'Group not found.' });
  if (convo.createdBy?.toString() !== req.userId) {
    return res.status(403).json({ error: 'Only the group creator can assign moderators.' });
  }
  if (!convo.participants.some((p) => p.toString() === userId)) {
    return res.status(400).json({ error: 'That person is not in the group.' });
  }
  if (!convo.moderators.some((m) => m.toString() === userId)) {
    convo.moderators.push(userId);
    await convo.save();
  }
  const populated = await convo.populate('participants', 'name email avatarSeed isOnline status');
  res.json(populated);
});

// Demote a Moderator back to Member — Creator only
router.delete('/:id/moderators/:userId', requireAuth, async (req, res) => {
  const convo = await Conversation.findById(req.params.id);
  if (!convo || !convo.isGroup) return res.status(404).json({ error: 'Group not found.' });
  if (convo.createdBy?.toString() !== req.userId) {
    return res.status(403).json({ error: 'Only the group creator can change moderators.' });
  }
  convo.moderators = convo.moderators.filter((m) => m.toString() !== req.params.userId);
  await convo.save();
  const populated = await convo.populate('participants', 'name email avatarSeed isOnline status');
  res.json(populated);
});

// Single conversation's full details (used by the group details screen)
router.get('/:id', requireAuth, async (req, res) => {
  const convo = await Conversation.findById(req.params.id)
    .populate('participants', 'name email avatarSeed isOnline status');
  if (!convo || !convo.participants.some((p) => p._id.toString() === req.userId)) {
    return res.status(404).json({ error: 'Conversation not found.' });
  }
  res.json(convo);
});

// Rename / re-icon a group — Creator or a Moderator only
router.patch('/:id', requireAuth, async (req, res) => {
  const { name, avatarSeed } = req.body;
  const convo = await Conversation.findById(req.params.id);
  if (!convo || !convo.isGroup) return res.status(404).json({ error: 'Group not found.' });
  const isCreator = convo.createdBy?.toString() === req.userId;
  const isModerator = convo.moderators.some((m) => m.toString() === req.userId);
  if (!isCreator && !isModerator) {
    return res.status(403).json({ error: 'Only the creator or a moderator can edit the group.' });
  }
  if (name && name.trim()) convo.name = name.trim();
  const CREATURES = ['fox', 'owl', 'rabbit', 'deer'];
  if (avatarSeed && CREATURES.includes(avatarSeed)) convo.avatarSeed = avatarSeed;
  await convo.save();
  const populated = await convo.populate('participants', 'name email avatarSeed isOnline status');
  res.json(populated);
});

// Remove a member — self-removal ("leave") is always allowed; removing
// someone else requires Creator or Moderator, and the Creator can never be
// removed, and only the Creator can remove a Moderator.
router.delete('/:id/members/:userId', requireAuth, async (req, res) => {
  const { userId: targetId } = req.params;
  const convo = await Conversation.findById(req.params.id);
  if (!convo || !convo.isGroup || !convo.participants.some((p) => p.toString() === req.userId)) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  const isSelf = targetId === req.userId;
  const isCreator = convo.createdBy?.toString() === req.userId;
  const isModerator = convo.moderators.some((m) => m.toString() === req.userId);
  const targetIsCreator = convo.createdBy?.toString() === targetId;
  const targetIsModerator = convo.moderators.some((m) => m.toString() === targetId);

  if (targetIsCreator) {
    return res.status(403).json({ error: 'The group creator cannot be removed.' });
  }
  if (!isSelf) {
    if (!isCreator && !isModerator) {
      return res.status(403).json({ error: 'Only the creator or a moderator can remove members.' });
    }
    if (targetIsModerator && !isCreator) {
      return res.status(403).json({ error: 'Only the creator can remove a moderator.' });
    }
  }

  convo.participants = convo.participants.filter((p) => p.toString() !== targetId);
  convo.moderators = convo.moderators.filter((m) => m.toString() !== targetId);
  await convo.save();
  const populated = await convo.populate('participants', 'name email avatarSeed isOnline status');
  res.json(populated);
});

// Message history for a conversation
router.get('/:id/messages', requireAuth, async (req, res) => {
  const convo = await Conversation.findById(req.params.id);
  if (!convo || !convo.participants.some(p => p.toString() === req.userId)) {
    return res.status(403).json({ error: 'Not part of this conversation.' });
  }
  const messages = await Message.find({ conversation: req.params.id })
    .sort({ createdAt: 1 })
    .limit(200);
  res.json(messages);
});

module.exports = router;
