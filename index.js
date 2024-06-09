const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const User = require('./models/user');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3001;
const token = process.env.TOKEN;
let bot;

try {
  bot = new TelegramBot(token, { polling: true });
} catch (error) {
  console.error('Telegram Bot is already running:', error.message);
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.log(error));

const generateReferralCode = () => {
  return Math.random().toString(36).substr(2, 9);
};

const generateTelegramLink = (referralCode) => {
  return `https://t.me/${process.env.BOT_USERNAME}?start=${referralCode}`;
};

app.post('/check-subscription', async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const channelId = '@Clickerroadtomoon';
    const response = await axios.get(`https://api.telegram.org/bot${token}/getChatMember`, {
      params: {
        chat_id: channelId,
        user_id: user.telegramId
      }
    });

    const isSubscribed = ['member', 'administrator', 'creator'].includes(response.data.result.status);

    if (isSubscribed) {
      user.coins += 50000; // Начисляем монеты
      await user.save();
      res.json({ success: true, isSubscribed });
    } else {
      res.json({ success: false, isSubscribed });
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Регистрация с реферальным кодом через Telegram Bot
app.post('/register-with-referral', async (req, res) => {
  const { telegramId, username, referralCode } = req.body;
  try {
    const existingUser = await User.findOne({ telegramId });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const referredByUser = await User.findOne({ referralCode });
    if (!referredByUser) {
      return res.status(400).json({ error: 'Invalid referral code' });
    }

    const newUser = new User({
      telegramId,
      username,
      coins: 0,
      referralCode: generateReferralCode(),
      referredBy: referredByUser._id
    });

    await newUser.save();

    // Начисление бонусов за реферала
    referredByUser.coins += 5000; // Бонус за приглашение
    await referredByUser.save();

    res.json({ success: true, userId: newUser._id, referralCode: newUser.referralCode });
  } catch (error) {
    console.error('Error registering user with referral:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Получение информации о пользователе
app.get('/username', async (req, res) => {
  const userId = req.query.userId;
  try {
    const user = await User.findById(userId).populate('referredBy');
    if (user) {
      const referralCount = await User.countDocuments({ referredBy: user._id }); // Подсчет рефералов
      res.json({
        username: user.username,
        coins: user.coins,
        referralCode: user.referralCode,
        telegramLink: generateTelegramLink(user.referralCode),
        referralCount // Количество рефералов
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Обновление количества монет
app.post('/update-coins', async (req, res) => {
  const { userId, coins } = req.body;
  console.log(`Received request to update coins: ${coins} for userId: ${userId}`);
  try {
    const user = await User.findByIdAndUpdate(userId, { coins }, { new: true });
    if (user) {
      console.log(`Coins updated successfully: ${user.coins}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error updating coins:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Настройка Telegram Bot
if (bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username;

    if (text.startsWith('/start')) {
      const referralCode = text.split(' ')[1]; // Получаем реферальный код из команды /start <referralCode>
      let referredByUser = null;

      if (referralCode) {
        referredByUser = await User.findOne({ referralCode });
      }

      let user = await User.findOneAndUpdate(
        { telegramId: chatId.toString() },
        {
          telegramId: chatId.toString(),
          username: username,
          coins: 0,
          referralCode: generateReferralCode(),
          referredBy: referredByUser ? referredByUser._id : null
        },
        { upsert: true, new: true }
      );

      if (referredByUser && user.isNew) {
        referredByUser.coins += 5000; // Начисление бонусов за приглашение нового пользователя
        await referredByUser.save();
      }

      await bot.sendMessage(chatId, 'Добро пожаловать! Нажмите на кнопку, чтобы начать игру.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Играть', web_app: { url: `${process.env.FRONTEND_URL}?userId=${user._id}` } }]
          ]
        }
      });
    }
  });
}
