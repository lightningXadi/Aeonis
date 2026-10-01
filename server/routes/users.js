const express = require('express');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const friendCount = await FriendRequest.countDocuments({
    status: 'accepted',
    $or: [{ from: req.userId }, { to: req.userId }]
  });
  res.json({
    id: user._id, name: user.name, email: user.email,
    avatarSeed: user.avatarSeed, status: user.status, friendCount
  });
});

// Edit your own name / status / avatar
router.patch('/me', requireAuth, async (req, res) => {
  const { name, status, avatarSeed } = req.body;
  const updates = {};
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty.' });
    updates.name = name.trim();
  }
  if (status !== undefined) updates.status = status.trim();
  if (avatarSeed !== undefined) {
    if (!['fox', 'owl', 'rabbit', 'deer'].includes(avatarSeed)) {
      return res.status(400).json({ error: 'Invalid avatar.' });
    }
    updates.avatarSeed = avatarSeed;
  }

  const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });
  res.json({ id: user._id, name: user.name, email: user.email, avatarSeed: user.avatarSeed, status: user.status });
});

// Search/list other users to start a new conversation with
router.get('/', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  const filter = { _id: { $ne: req.userId } };
  if (q) filter.$or = [
    { name: new RegExp(q, 'i') },
    { email: new RegExp(q, 'i') }
  ];
  const users = await User.find(filter).limit(20)
    .select('name email avatarSeed isOnline status');
  res.json(users);
});

module.exports = router;
