// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();
const UserProgress = require('./userProgress'); // Убедитесь, что путь правильный

const app = express();
const port = process.env.PORT || 3001;
const token = process.env.TOKEN;

const bot = new TelegramBot(token, { polling: true });

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.log(error));

function generateReferralCode() {
  return Math.random().toString(36).substr(2, 9);
}

function generateTelegramLink(referralCode) {
  return `https://t.me/${process.env.BOT_USERNAME}?start=${referralCode}`;
}

async function getProfilePhotoUrl(telegramId) {
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
}

// Сохранение прогресса игры
app.post('/save-progress', async (req, res) => {
  const { userId, coins, upgradeCost, upgradeLevel, coinPerClick, upgradeCostEnergy, upgradeLevelEnergy, clickLimit, energyNow, upgradeCostEnergyTime, valEnergyTime, time } = req.body;

  try {
    const user = await UserProgress.findById(userId);
    if (user) {
      user.coins = coins;
      user.upgradeCost = upgradeCost;
      user.upgradeLevel = upgradeLevel;
      user.coinPerClick = coinPerClick;
      user.upgradeCostEnergy = upgradeCostEnergy;
      user.upgradeLevelEnergy = upgradeLevelEnergy;
      user.clickLimit = clickLimit;
      user.energyNow = energyNow;
      user.upgradeCostEnergyTime = upgradeCostEnergyTime;
      user.valEnergyTime = valEnergyTime;
      user.time = time;
      // Проверяем наличие referralCode, если отсутствует - генерируем новый
      if (!user.referralCode) {
        user.referralCode = generateReferralCode();
      }
      await user.save();
      res.json({ success: true });
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
    const user = await UserProgress.findById(userId);
    if (user) {
      res.json({
        success: true,
        coins: user.coins,
        upgradeCost: user.upgradeCost,
        upgradeLevel: user.upgradeLevel,
        coinPerClick: user.coinPerClick,
        upgradeCostEnergy: user.upgradeCostEnergy,
        upgradeLevelEnergy: user.upgradeLevelEnergy,
        clickLimit: user.clickLimit,
        energyNow: user.energyNow,
        upgradeCostEnergyTime: user.upgradeCostEnergyTime,
        valEnergyTime: user.valEnergyTime,
        time: user.time,
        username: user.username,
        profilePhotoUrl: user.profilePhotoUrl,
        referralCode: user.referralCode,
        telegramLink: generateTelegramLink(user.referralCode)
      });
    } else {
      res.status(404).json({ error: 'Progress not found' });
    }
  } catch (error) {
    console.error('Error loading progress:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Настройка Telegram Bot
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  let profilePhotoUrl = await getProfilePhotoUrl(chatId);

  let user = await UserProgress.findOneAndUpdate(
    { telegramId: chatId.toString() },
    {
      telegramId: chatId.toString(),
      username: username,
      profilePhotoUrl,
      // Добавьте генерацию referralCode при регистрации нового пользователя
      referralCode: generateReferralCode()
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
