// bot.js
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

export async function sendOrderToTelegram(order) {
  const chatId = process.env.ADMIN_CHAT_ID;
  let message = `🧾 *Новый заказ с сайта*\n\n`;
  message += `👤 *Имя:* ${order.name}\n📞 *Телефон:* ${order.phone}\n🏠 *Адрес:* ${order.address || "-"}\n\n`;
  message += `🛒 *Товары:*\n`;

  for (const item of order.items) {
    message += `• ${item.name} × ${item.qty} = ${item.sum.toLocaleString("ru-RU")} ₸\n`;
  }

  message += `\n💰 *Итого:* ${order.total.toLocaleString("ru-RU")} ₸`;

  await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  console.log("✅ Заказ отправлен в Telegram");
}
