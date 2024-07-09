// userProgress.js
const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  first_name: {
    type: String,
    required: true
  },
  coins: {
    type: Number,
    default: 0
  },

  hasClaimedRewards: {
    type: Boolean,
    default: false
  },


  coinPerClick: {
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
     default: false 
    },

  hasCheckedChatSubscription: {
       type: Boolean,
       default: false
       },

  cardUrls: {  // Изменено на массив строк
       type: [String],
       default: []
      },
  
  referrals: [{ // Добавляем массив рефералов
      telegramId: String,
      first_name: String,
      profilePhotoUrl: String
     }]
});

const UserProgress = mongoose.model('User9Progresprogres', userProgressSchema);

module.exports = UserProgress;
