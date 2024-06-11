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
  // Параметры прогресса игры как отдельные поля
  upgradeCost: {
    type: Number,
    default: 10
  },
  upgradeLevel: {
    type: Number,
    default: 1
  },
  coinPerClick: {
    type: Number,
    default: 1
  },
  upgradeCostEnergy: {
    type: Number,
    default: 100
  },
  upgradeLevelEnergy: {
    type: Number,
    default: 1
  },
  clickLimit: {
    type: Number,
    default: 1000
  },
  energyNow: {
    type: Number,
    default: 1000
  },
  upgradeCostEnergyTime: {
    type: Number,
    default: 200
  },
  valEnergyTime: {
    type: Number,
    default: 0.5
  },
  time: {
    type: Number,
    default: 2000
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
