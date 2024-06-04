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
    }
});


const User = mongoose.model('clickerbotcollections', userSchema);

module.exports = User;
