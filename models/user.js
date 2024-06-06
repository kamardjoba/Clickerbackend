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
    }
});

module.exports = mongoose.model('User', userSchema);

//const User = mongoose.model('clickerbotcollections', userSchema);

//module.exports = User;
