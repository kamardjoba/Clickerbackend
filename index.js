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
const CHANNEL_ID = -1002202574694;

const bot = new TelegramBot(token, { polling: true });

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Функция для генерации реферального кода
function generateReferralCode() {
  return Math.random().toString(36).substr(2, 9);
}

// Функция для генерации ссылки на Telegram с реферальным кодом
function generateTelegramLink(referralCode) {
  return `https://t.me/${BOT_USERNAME}?start=${referralCode}`;
}

// Функция для получения URL фото профиля
// index.js
async function getProfilePhotoUrl(telegramId) {
    try {
      // Запрос на получение фото профиля
      const response = await axios.get(`https://api.telegram.org/bot${token}/getUserProfilePhotos`, {
        params: {
          user_id: telegramId,
          limit: 1
        }
      });
  
      // Проверка ответа API
      if (response.data.ok && response.data.result.photos.length > 0) {
        const fileId = response.data.result.photos[0][0].file_id;
  
        // Запрос на получение файла
        const fileResponse = await axios.get(`https://api.telegram.org/bot${token}/getFile`, {
          params: {
            file_id: fileId
          }
        });
  
        // Проверка ответа API
        if (fileResponse.data.ok) {
          const filePath = fileResponse.data.result.file_path;
          return `https://api.telegram.org/file/bot${token}/${filePath}`;
        } else {
          console.error('Error fetching file:', fileResponse.data);
          throw new Error('Failed to fetch file');
        }
      } else {
        console.error('No profile photo found:', response.data);
        return ''; // Возвращаем пустую строку, если фото профиля нет
      }
    } catch (error) {
      console.error('Error fetching profile photo:', error.message);
      throw error; // Перебрасываем ошибку для обработки на уровне вызова
    }
  }
  

// Функция для обновления фото профиля пользователя
async function updateProfilePhoto(telegramId) {
  const profilePhotoUrl = await getProfilePhotoUrl(telegramId);
  if (profilePhotoUrl) {
    await UserProgress.findOneAndUpdate(
      { telegramId },
      { profilePhotoUrl },
      { new: true }
    );
  }
}

// Проверка подписки на канал и начисление монет
app.post('/check-subscription', async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await UserProgress.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден.' });
    }

    const chatMemberResponse = await axios.get(`https://api.telegram.org/bot${token}/getChatMember`, {
      params: {
        chat_id: CHANNEL_ID,
        user_id: user.telegramId
      }
    });

    const status = chatMemberResponse.data.result.status;
    const isSubscribed = ['member', 'administrator', 'creator'].includes(status);

    let message = '';
    if (isSubscribed) {
      if (!user.hasCheckedSubscription) {
        user.coins += 5000; // Начисляем 5000 монет
        user.hasCheckedSubscription = true; // Отмечаем, что подписка была проверена
        await user.save();
        message = 'Вы успешно подписались на канал и получили 5000 монет!';
      } else {
        message = 'Вы уже проверяли подписку и получили свои монеты.';
      }
    } else {
      message = 'Вы не подписаны на канал.';
    }

    res.json({ success: true, isSubscribed, message });
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ success: false, message: 'Ошибка при проверке подписки.' });
  }
});

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
      // Обновляем фото профиля перед возвратом данных
      await updateProfilePhoto(user.telegramId);
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
        telegramLink: generateTelegramLink(user.referralCode),
        referrals: user.referrals // Возвращаем массив рефералов
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

    let user = await UserProgress.findOne({ telegramId: chatId.toString() });

    if (!user) {
      // Новый пользователь
      user = new UserProgress({
        telegramId: chatId.toString(),
        username: username,
        profilePhotoUrl,
        referralCode: generateReferralCode()
      });
    } else {
      // Пользователь уже существует, используем его текущий referralCode
      user.referralCode = user.referralCode || generateReferralCode();
    }

    // Добавьте пользователя в массив рефералов у пригласившего
    if (!referrer.referrals.some(ref => ref.telegramId === chatId.toString())) {
      referrer.referrals.push({
        telegramId: chatId.toString(),
        username: username,
        profilePhotoUrl
      });
    }
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

// Обновление фото профиля пользователя
// index.js
app.post('/update-profile-photo', async (req, res) => {
    const { telegramId } = req.body;
  
    try {
      const profilePhotoUrl = await getProfilePhotoUrl(telegramId);
      if (!profilePhotoUrl) {
        return res.status(404).json({ success: false, message: 'Фото профиля не найдено.' });
      }
  
      const user = await UserProgress.findOneAndUpdate(
        { telegramId },
        { profilePhotoUrl },
        { new: true }
      );
  
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден.' });
      }
  
      res.json({ success: true, profilePhotoUrl });
    } catch (error) {
      console.error('Error updating profile photo:', error.message);
      res.status(500).json({ success: false, message: 'Ошибка при обновлении фото профиля.' });
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
  } else {
    await updateProfilePhoto(chatId);
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
