// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();
const UserProgress = require('./models/userProgress');

const app = express();
const port = process.env.PORT || 3001;
const token = process.env.TOKEN;
const BOT_USERNAME = "sdfsdfjsidjsjgjsdopgjd_bot";
const CHANNEL_ID = -1002202574694;
const CHAT_ID = -1002177922862; 


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
        console.error('Ошибка при получении файла:', fileResponse.data);
        return '';
      }
    } else {
      if (response.data.result && response.data.result.total_count === 0) {
        console.error('Фото профиля не найдено для пользователя:', telegramId);
        return ''; // Фото не доступны для этого пользователя
      } else {
        console.error('Ошибка ответа от API Telegram:', response.data);
        return '';
      }
    }
  } catch (error) {
    if (error.response) {
      console.error(`Ошибка при получении фото профиля (статус: ${error.response.status})`, error.response.data);
    } else {
      console.error('Ошибка при получении фото профиля:', error.message);
    }
    return '';
  }
}

async function updateProfilePhoto(telegramId) {
  try {
    const profilePhotoUrl = await getProfilePhotoUrl(telegramId);
    if (profilePhotoUrl) {
      const updatedUser = await UserProgress.findOneAndUpdate(
          { telegramId },
          { profilePhotoUrl },
          { new: true }
      );
      if (!updatedUser) {
        console.error('User not found for updating profile photo:', telegramId);
      }
    } else {
      console.warn('No profile photo URL returned for user:', telegramId);
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
        user.coins += 5000;
        user.hasCheckedSubscription = true;
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

app.post('/check-chat-subscription', async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await UserProgress.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const chatMemberResponse = await axios.get(`https://api.telegram.org/bot${token}/getChatMember`, {
      params: {
        chat_id: CHAT_ID,
        user_id: user.telegramId
      }
    });

    const status = chatMemberResponse.data.result.status;
    const isSubscribed = ['member', 'administrator', 'creator'].includes(status);

    let message = '';
    if (isSubscribed) {
      if (!user.hasCheckedChatSubscription) {
        user.coins += 5000;
        user.hasCheckedChatSubscription = true;
        await user.save();
        message = 'You successfully subscribed to the chat and received 5000 coins!';
      } else {
        message = 'You have already checked the subscription and received your coins.';
      }
    } else {
      message = 'You are not subscribed to the chat.';
    }

    res.json({ success: true, isSubscribed, hasCheckedChatSubscription: user.hasCheckedChatSubscription, message });
  } catch (error) {
    console.error('Error checking chat subscription:', error.message, error.response?.data || '');
    res.status(500).json({ success: false, message: 'Error checking subscription.' });
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
        first_name: user.first_name,
        profilePhotoUrl: user.profilePhotoUrl,
        referralCode: user.referralCode,
        telegramLink: generateTelegramLink(user.referralCode),
        referrals: user.referrals
      });
    } else {
      res.status(404).json({ error: 'Progress not found' });
    }
  } catch (error) {
    console.error('Error loading progress:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

bot.onText(/\/start (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const referralCode = match[1];
  const referrer = await UserProgress.findOne({ referralCode });
  const firstName = msg.from.first_name || `user${userId}`;
  const profilePhotoUrl = await getProfilePhotoUrl(userId);

  try {
    let user = await UserProgress.findOneAndUpdate(
      { telegramId: userId.toString() },
      {
        telegramId: userId.toString(),
        first_name: firstName,
        profilePhotoUrl,
        referralCode: generateReferralCode(),
        referredBy: referrer ? referrer._id : null
      },
      { upsert: true, new: true }
    );

    if (referrer && !referrer.referrals.some(ref => ref.telegramId === userId.toString())) {
      referrer.referrals.push({
        telegramId: userId.toString(),
        first_name: firstName,
        profilePhotoUrl
      });
      referrer.coins += 5000;
      await referrer.save();
      user.coins += 5000;
      await user.save();
    }

    bot.sendMessage(referrer?.telegramId, `Ваш друг присоединился по вашему реферальному коду! Вам начислено 5000 монет.`);
    bot.sendMessage(userId, `Вы успешно присоединились по реферальному коду! Вам начислено 5000 монет.`);
  } catch (error) {
    console.error('Error in /start command:', error);
    bot.sendMessage(userId, `Произошла ошибка при обработке вашей регистрации.`);
  }
});

bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const firstName = msg.from.first_name || `user${userId}`;
  const profilePhotoUrl = await getProfilePhotoUrl(userId);

  try {
    let user = await UserProgress.findOneAndUpdate(
      { telegramId: userId.toString() },
      {
        telegramId: userId.toString(),
        first_name: firstName,
        profilePhotoUrl,
        referralCode: generateReferralCode()
      },
      { upsert: true, new: true }
    );

    const telegramLink = generateTelegramLink(user.referralCode);
    bot.sendMessage(userId, `Добро пожаловать! Нажмите на кнопку, чтобы начать игру. Ваш реферальный код: ${user.referralCode}. Пригласите друзей по ссылке: ${telegramLink}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Играть', web_app: { url: `${process.env.FRONTEND_URL}?userId=${user._id}` } }]
        ]
      }
    });
  } catch (error) {
    console.error('Error in message handler:', error);
    bot.sendMessage(userId, `Произошла ошибка при обработке вашего сообщения.`);
  }
});




bot.on('message', async (msg) => {
  const userId = msg.from.id; // Используем ID пользователя
  const chatId = msg.chat.id; // ID чата

  // Проверка, чтобы не создавать пользователя с ID чата
  if (userId === chatId.toString()) {
    return bot.sendMessage(userId, `Невозможно создать пользователя с ID чата.`);
  }

  const firstName = msg.from.first_name || `user${userId}`;
  let profilePhotoUrl = await getProfilePhotoUrl(userId);

  let user = await UserProgress.findOne({ telegramId: userId.toString() });

  if (!user) {
    user = new UserProgress({
      telegramId: userId.toString(),
      first_name: firstName,
      profilePhotoUrl,
      referralCode: generateReferralCode()
    });
    try {
          await user.save();
        } catch (error) {
          if (error.code === 11000) {
            return bot.sendMessage(userId, `Пользователь с таким Telegram ID уже существует.`);
          } else {
            throw error; // Пробрасываем ошибку дальше, если это не ошибка дублирования
          }
        }
  } else {
    await updateProfilePhoto(userId);
  }

  const telegramLink = generateTelegramLink(user.referralCode);

  // await bot.sendMessage(userId, `Добро пожаловать! Нажмите на кнопку, чтобы начать игру. Ваш реферальный код: ${user.referralCode}. Пригласите друзей по ссылке: ${telegramLink}`, {
  //   reply_markup: {
  //     inline_keyboard: [
  //       [{ text: 'Играть', web_app: { url: `${process.env.FRONTEND_URL}?userId=${user._id}` } }]
  //     ]
  //   }
  // });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


// if (!user) {
//   user = new UserProgress({
//     telegramId: userId.toString(),
//     first_name: firstName,
//     profilePhotoUrl,
//     referralCode: generateReferralCode()
//   });
//   try {
//     await user.save();
//   } catch (error) {
//     if (error.code === 11000) {
//       return bot.sendMessage(userId, `Пользователь с таким Telegram ID уже существует.`);
//     } else {
//       throw error; // Пробрасываем ошибку дальше, если это не ошибка дублирования
//     }
//   }
// }