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
        type: Number
    }
});

const User = mongoose.model('User', userSchema);



module.exports = User;
