const express = require('express');
const FriendRequest = require('../models/FriendRequest');
const requireAuth = require('../middleware/auth');

const router = express.Router();
const PUBLIC_FIELDS = 'name email avatarSeed isOnline status';

// Send a friend request
router.post('/request', requireAuth, async (req, res) => {
  const { toUserId } = req.body;
  if (!toUserId) return res.status(400).json({ error: 'toUserId is required.' });
  if (toUserId === req.userId) return res.status(400).json({ error: "You can't friend-request yourself." });

  // Already friends or a pending request already exists either direction?
  const existing = await FriendRequest.findOne({
    $or: [
      { from: req.userId, to: toUserId },
      { from: toUserId, to: req.userId }
    ],
    status: { $in: ['pending', 'accepted'] }
  });
  if (existing) {
    return res.status(409).json({
      error: existing.status === 'accepted' ? 'You are already friends.' : 'A request is already pending.'
    });
  }

  const request = await FriendRequest.create({ from: req.userId, to: toUserId });
  await request.populate('to', PUBLIC_FIELDS);
  res.status(201).json(request);
});

// List incoming + outgoing pending requests
router.get('/requests', requireAuth, async (req, res) => {
  const [incoming, outgoing] = await Promise.all([
    FriendRequest.find({ to: req.userId, status: 'pending' }).populate('from', PUBLIC_FIELDS),
    FriendRequest.find({ from: req.userId, status: 'pending' }).populate('to', PUBLIC_FIELDS)
  ]);
  res.json({ incoming, outgoing });
});

// Accept an incoming request
router.post('/requests/:id/accept', requireAuth, async (req, res) => {
  const request = await FriendRequest.findById(req.params.id);
  if (!request || request.to.toString() !== req.userId) {
    return res.status(404).json({ error: 'Request not found.' });
  }
  request.status = 'accepted';
  await request.save();
  await request.populate('from', PUBLIC_FIELDS);
  res.json(request);
});

// Reject an incoming request (or cancel an outgoing one)
router.post('/requests/:id/reject', requireAuth, async (req, res) => {
  const request = await FriendRequest.findById(req.params.id);
  if (!request || (request.to.toString() !== req.userId && request.from.toString() !== req.userId)) {
    return res.status(404).json({ error: 'Request not found.' });
  }
  await request.deleteOne();
  res.json({ success: true });
});

// List accepted friends
router.get('/', requireAuth, async (req, res) => {
  const accepted = await FriendRequest.find({
    status: 'accepted',
    $or: [{ from: req.userId }, { to: req.userId }]
  }).populate('from', PUBLIC_FIELDS).populate('to', PUBLIC_FIELDS);

  const friends = accepted.map((r) => (r.from._id.toString() === req.userId ? r.to : r.from));
  res.json(friends);
});

// Remove a friend
router.delete('/:userId', requireAuth, async (req, res) => {
  await FriendRequest.deleteMany({
    status: 'accepted',
    $or: [
      { from: req.userId, to: req.params.userId },
      { from: req.params.userId, to: req.userId }
    ]
  });
  res.json({ success: true });
});

module.exports = router;
