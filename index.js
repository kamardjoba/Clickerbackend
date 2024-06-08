const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const User = require('./models/user'); // Импорт модели пользователя

const app = express();
const port = process.env.PORT || 3001; // Убедитесь, что порт установлен правильно
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

// Настройка Telegram Bot
if (bot) {
  bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;
      const username = msg.from.username;

      if (text === '/start') {
          let user = await User.findOneAndUpdate(
              { telegramId: chatId.toString() },
              { telegramId: chatId.toString(), username: username, coins: 0 }, // Добавляем поле coins
              { upsert: true, new: true }
          );

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

app.get('/username', async (req, res) => {
    const userId = req.query.userId;
    try {
        const user = await User.findById(userId);
        if (user) {
            res.json({ username: user.username, coins: user.coins }); // Возвращаем количество монет
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/update-coins', async (req, res) => {
    const { userId, coins } = req.body;
    console.log(`Received request to update coins: ${coins} for userId: ${userId}`);
    try {
      const user = await User.findByIdAndUpdate(userId, { coins: coins }, { new: true });
      if (user) {
        console.log(`Coins updated successfully: ${user.coins}`); // Логируем новое количество монет
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      console.error('Error updating coins:', error); // Логируем ошибки
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
