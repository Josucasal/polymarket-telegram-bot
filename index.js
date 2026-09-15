require('dotenv').config();

const { createBot } = require('./src/bot');
const { startMonitor } = require('./src/monitor');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('Falta TELEGRAM_BOT_TOKEN en el archivo .env (copia .env.example a .env y rellenalo).');
  process.exit(1);
}

const bot = createBot(TOKEN);
const intervalMs = Number(process.env.POLL_INTERVAL_MS || 90000);
startMonitor(bot, intervalMs);

console.log(`Bot en marcha. Comprobando wallets vigiladas cada ${intervalMs / 1000} segundos.`);
