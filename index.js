const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const User = require('./models/user');
const axios = require('axios');

BOT_USERNAME = "sdfsdfjsidjsjgjsdopgjd_bot";
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

// Регистрация с проверкой существующего пользователя
app.post('/register', async (req, res) => {
  const { telegramId, username, referralCode } = req.body;

  try {
    // Проверка, существует ли пользователь
    let user = await User.findOne({ telegramId });

    if (user) {
      // Если пользователь существует, возвращаем его данные
      return res.json({
        success: true,
        userId: user._id,
        username: user.username,
        coins: user.coins,
        referralCode: user.referralCode,
        telegramLink: generateTelegramLink(user.referralCode),
        profilePhotoUrl: user.profilePhotoUrl
      });
    }

    // Если пользователь не существует, создаем нового
    const referredByUser = referralCode ? await User.findOne({ referralCode }) : null;

    const profilePhotoUrl = await getProfilePhotoUrl(telegramId);

    user = new User({
      telegramId,
      username,
      coins: 5000, // Начальные монеты для нового пользователя
      referralCode: generateReferralCode(),
      referredBy: referredByUser ? referredByUser._id : null,
      profilePhotoUrl
    });

    await user.save();

    // Начисление бонусов за реферала
    if (referredByUser) {
      referredByUser.coins += 5000; // Бонус для реферера
      await referredByUser.save();
    }

    res.json({
      success: true,
      userId: user._id,
      username: user.username,
      coins: user.coins,
      referralCode: user.referralCode,
      telegramLink: generateTelegramLink(user.referralCode),
      profilePhotoUrl: user.profilePhotoUrl
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Получение информации о пользователе
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
        profilePhotoUrl: user.profilePhotoUrl
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Проверка подписки пользователя
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
        user.coins += 50000; // Начисляем монеты
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

// Обновление количества монет
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
