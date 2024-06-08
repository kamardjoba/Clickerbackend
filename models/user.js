const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { 
    type: String,
     required: true, 
     unique: true },

  username: {
     type: String,
      required: true },

  coins: { 
    type: Number, 
    default: 0 },

  referralCode: {
     type: String, 
     required: true, 
     unique: true },

  referredBy: {
     type: mongoose.Schema.Types.ObjectId,
      ref: 'User' }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
