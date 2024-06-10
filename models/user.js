// user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  coins: {
    type: Number,
    default: 0
  },
  referralCode: {
    type: String,
    required: true,
    unique: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  profilePhotoUrl: {
    type: String,
    default: ''
  },
  gameProgress: {
    type: Object,
    default: {
      upgrades: {
        coinPerClick: { level: 1, cost: 10 },
        energy: { level: 1, cost: 100, limit: 1000 },
        energyTime: { level: 1, cost: 200, time: 2000, val: 0.5 }
      },
      miniGameState: {}
    }
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
