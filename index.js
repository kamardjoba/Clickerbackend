// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();
const UserProgress = require('./models/userProgress'); // Убедитесь, что путь правильный

const app = express();
const port = process.env.PORT || 3001;
const token = process.env.TOKEN;
const BOT_USERNAME = "sdfsdfjsidjsjgjsdopgjd_bot";

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
  return `https://t.me/${BOT_USERNAME}?start=${referralCode}`;
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

// Обработка команды /start с реферальным кодом
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referralCode = match[1];
  
  // Найдите пользователя, который отправил код
  const referrer = await UserProgress.findOne({ referralCode });

  if (referrer) {
    // Найдите или создайте нового пользователя
    const username = msg.from.username || `user${chatId}`;
    const profilePhotoUrl = await getProfilePhotoUrl(chatId);
    
    let user = await UserProgress.findOneAndUpdate(
      { telegramId: chatId.toString() },
      {
        telegramId: chatId.toString(),
        username: username,
        profilePhotoUrl,
        referralCode: referrer.referralCode // Новый пользователь получает реферальный код от пригласившего
      },
      { upsert: true, new: true }
    );

    // Добавьте бонусы обоим пользователям
    referrer.coins += 5000;
    await referrer.save();

    user.coins += 5000;
    await user.save();

    await bot.sendMessage(referrer.telegramId, `Ваш друг присоединился по вашему реферальному коду! Вам начислено 5000 монет.`);
    await bot.sendMessage(chatId, `Вы успешно присоединились по реферальному коду! Вам начислено 5000 монет.`);

  } else {
    await bot.sendMessage(chatId, `Реферальный код недействителен.`);
  }
});

// Настройка Telegram Bot
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || `user${chatId}`;
  let profilePhotoUrl = await getProfilePhotoUrl(chatId);

  // Проверить, существует ли пользователь
  let user = await UserProgress.findOne({ telegramId: chatId.toString() });

  if (!user) {
    // Создать нового пользователя, если он не существует
    user = new UserProgress({
      telegramId: chatId.toString(),
      username: username,
      profilePhotoUrl,
      referralCode: generateReferralCode()
    });
    await user.save();
  }

  const telegramLink = generateTelegramLink(user.referralCode);

  await bot.sendMessage(chatId, `Добро пожаловать! Нажмите на кнопку, чтобы начать игру. Ваш реферальный код: ${user.referralCode}. Пригласите друзей по ссылке: ${telegramLink}`, {
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
