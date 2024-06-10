// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const User = require('./models/user');
const axios = require('axios');

const BOT_USERNAME = "sdfsdfjsidjsjgjsdopgjd_bot";
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
  return `https://t.me/${BOT_USERNAME}?start=${referralCode}`;
};

const getProfilePhotoUrl = async (telegramId) => {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/getUserProfilePhotos`, {
      params: {
        user_id: telegramId,
        limit: 1
      }
    });

    if (response.data.ok && response.data.result.photos.length > 0) {
      const fileId = response.data.result.photos[0][0].file_id;
      const fileResponse = await axios.get(`https://api.telegram.org/bot${token}/getFile`, {
        params: {
          file_id: fileId
        }
      });

      if (fileResponse.data.ok) {
        const filePath = fileResponse.data.result.file_path;
        return `https://api.telegram.org/file/bot${token}/${filePath}`;
      }
    }
  } catch (error) {
    console.error('Error fetching profile photo:', error);
  }
  return '';
};

app.post('/register', async (req, res) => {
  const { telegramId, username, referralCode } = req.body;

  try {
    let user = await User.findOne({ telegramId });

    if (user) {
      return res.json({
        success: true,
        userId: user._id,
        username: user.username,
        coins: user.coins,
        referralCode: user.referralCode,
        telegramLink: generateTelegramLink(user.referralCode),
        profilePhotoUrl: user.profilePhotoUrl,
        gameProgress: user.gameProgress
      });
    }

    const referredByUser = referralCode ? await User.findOne({ referralCode }) : null;
    const profilePhotoUrl = await getProfilePhotoUrl(telegramId);

    user = new User({
      telegramId,
      username,
      coins: 5000,
      referralCode: generateReferralCode(),
      referredBy: referredByUser ? referredByUser._id : null,
      profilePhotoUrl,
      gameProgress: {
        upgrades: {
          coinPerClick: { level: 1, cost: 10 },
          energy: { level: 1, cost: 100, limit: 1000 },
          energyTime: { level: 1, cost: 200, time: 2000, val: 0.5 }
        },
        miniGameState: {}
      }
    });

    await user.save();

    if (referredByUser) {
      referredByUser.coins += 5000;
      await referredByUser.save();
    }

    res.json({
      success: true,
      userId: user._id,
      username: user.username,
      coins: user.coins,
      referralCode: user.referralCode,
      telegramLink: generateTelegramLink(user.referralCode),
      profilePhotoUrl: user.profilePhotoUrl,
      gameProgress: user.gameProgress
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/username', async (req, res) => {
  const userId = req.query.userId;
  try {
    const user = await User.findById(userId).populate('referredBy');
    if (user) {
      const referralCount = await User.countDocuments({ referredBy: user._id });
      res.json({
        username: user.username,
        coins: user.coins,
        referralCode: user.referralCode,
        telegramLink: generateTelegramLink(user.referralCode),
        referralCount,
        profilePhotoUrl: user.profilePhotoUrl,
        gameProgress: user.gameProgress
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

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

    if (response.data.ok) {
      const isSubscribed = ['member', 'administrator', 'creator'].includes(response.data.result.status);
      if (isSubscribed) {
        user.coins += 50000;
        await user.save();
        res.json({ success: true, isSubscribed });
      } else {
        res.json({ success: false, isSubscribed });
      }
    } else {
      res.status(400).json({ error: response.data.description });
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/update-coins', async (req, res) => {
  const { userId, coins } = req.body;
  try {
    const user = await User.findByIdAndUpdate(userId, { coins }, { new: true });
    if (user) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error updating coins:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Сохранение прогресса игры
app.post('/save-progress', async (req, res) => {
  const { userId, coins, upgrades, miniGameState } = req.body;

  try {
    const user = await User.findById(userId);
    if (user) {
      user.coins = coins;
      user.gameProgress = { upgrades, miniGameState };
      await user.save();
      res.json({ success: true, gameProgress: user.gameProgress });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error saving progress:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Загрузка прогресса игры
app.get('/load-progress', async (req, res) => {
  const userId = req.query.userId;

  try {
    const user = await User.findById(userId);
    if (user) {
      res.json({ success: true, gameProgress: user.gameProgress });
    } else {
      res.status(404).json({ error: 'Progress not found' });
    }
  } catch (error) {
    console.error('Error loading progress:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Настройка Telegram Bot
if (bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;

    let profilePhotoUrl = await getProfilePhotoUrl(chatId);

    let user = await User.findOneAndUpdate(
      { telegramId: chatId.toString() },
      {
        telegramId: chatId.toString(),
        username: username,
        profilePhotoUrl
      },
      { upsert: true, new: true }
    );

    await bot.sendMessage(chatId, 'Добро пожаловать! Нажмите на кнопку, чтобы начать игру.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Играть', web_app: { url: `${process.env.FRONTEND_URL}?userId=${user._id}` } }]
        ]
      }
    });
  });
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
