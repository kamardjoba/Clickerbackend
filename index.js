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

async function updateProfilePhoto(telegramId) {
  try {
    const profilePhotoUrl = await getProfilePhotoUrl(telegramId);
    if (profilePhotoUrl) {
      await UserProgress.findOneAndUpdate(
        { telegramId },
        { profilePhotoUrl },
        { new: true }
      );
    }
  } catch (error) {
    console.error('Error updating profile photo:', error.message);
  }
}

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

        res.json({ success: true, isSubscribed, hasCheckedSubscription: user.hasCheckedSubscription, message });
    } catch (error) {
        console.error('Error checking subscription:', error);
        res.status(500).json({ success: false, message: 'Ошибка при проверке подписки.' });
    }
});

  
  

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

app.get('/load-progress', async (req, res) => {
  const userId = req.query.userId;

  try {
    const user = await UserProgress.findById(userId);
    if (user) {
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
        referralCode: generateReferralCode(),
        referredBy: referrer ? referrer._id : null // Сохранить реферальную связь
      });
  
      if (referrer) {
        referrer.referrals.push({
          telegramId: chatId.toString(),
          username: username,
          profilePhotoUrl
        });
        referrer.coins += 5000; // Награда за реферала
        await referrer.save();
  
        user.coins += 5000; // Награда за регистрацию по реферальной ссылке
      }
      await user.save();
    } else {
      // Пользователь уже существует, проверяем его реферальный код
      if (user.referralCode === referralCode) {
        return bot.sendMessage(chatId, `Вы не можете использовать свою собственную реферальную ссылку.`);
      }
  
      // Проверка, что пользователь не уже зарегистрирован по другой реферальной ссылке
      if (user.referredBy && user.referredBy.toString() !== referrer?._id.toString()) {
        return bot.sendMessage(chatId, `Вы уже зарегистрированы по другой реферальной ссылке.`);
      }
  
      // Если пользователь зарегистрирован по той же ссылке, но не получил награду
      if (referrer && !user.referredBy) {
        referrer.referrals.push({
          telegramId: chatId.toString(),
          username: username,
          profilePhotoUrl
        });
        referrer.coins += 5000; // Награда за реферала
        await referrer.save();
  
        user.coins += 5000; // Награда за регистрацию по реферальной ссылке
        user.referredBy = referrer._id;
        await user.save();
      }
    }
  
    await bot.sendMessage(referrer?.telegramId, `Ваш друг присоединился по вашему реферальному коду! Вам начислено 5000 монет.`);
    await bot.sendMessage(chatId, `Вы успешно присоединились по реферальному коду! Вам начислено 5000 монет.`);
  });
  

// Обновление фото профиля пользователя
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