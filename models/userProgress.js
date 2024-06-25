// userProgress.js
const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: false
  },
  coins: {
    type: Number,
    default: 0
  },
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
  },
  referralCode: {
    type: String,
    required: true,
    unique: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProgress'
  },
  profilePhotoUrl: {
    type: String,
    default: ''
  },
  referralCode: { 
    type: String,
     unique: true
     },
  
  hasCheckedSubscription: {
     type: Boolean, 
     default: false },
     
  referrals: [{ // Добавляем массив рефералов
      telegramId: String,
      username: String,
      profilePhotoUrl: String
     }]
});

const UserProgress = mongoose.model('User2Progresprogres', userProgressSchema);

module.exports = UserProgress;
