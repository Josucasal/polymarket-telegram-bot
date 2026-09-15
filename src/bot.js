const TelegramBot = require('node-telegram-bot-api');
const { getPositions, getActivity, getTrades, getHolders, getValue } = require('./polymarketApi');
const { formatUSD, formatDate, shortAddr, chunkText } = require('./format');
const watchlist = require('./watchlist');

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function isAddress(value) {
  return ADDRESS_RE.test((value || '').trim());
}

async function sendLong(bot, chatId, text) {
  for (const chunk of chunkText(text)) {
    await bot.sendMessage(chatId, chunk);
  }
}

function createBot(token) {
  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/^\/(start|ayuda)$/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      [
        'Bot de consulta y vigilancia de cuentas de Polymarket.',
        '',
        'Consultas puntuales:',
        '/wallet <direccion> - posiciones actuales y valor de cartera',
        '/actividad <direccion> [n] - ultimas n operaciones (por defecto 10)',
        '/mercado <conditionId> [n] - ultimas operaciones en un mercado',
        '/holders <conditionId> [n] - mayores posiciones en un mercado',
        '',
        'Vigilancia continua (avisa en este chat):',
        '/vigilar <direccion> [etiqueta] - anade una wallet a vigilancia',
        '/dejar <direccion> - quita una wallet de vigilancia',
        '/vigilancia - lista las wallets vigiladas aqui',
        '/umbral <usd> - importe a partir del cual se marca como alerta',
      ].join('\n')
    );
  });

  bot.onText(/^\/wallet(?:\s+(\S+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const address = (match[1] || '').trim();
    if (!isAddress(address)) {
      return bot.sendMessage(chatId, 'Uso: /wallet 0xdireccion');
    }
    try {
      const [positions, value] = await Promise.all([
        getPositions(address, { limit: 10 }),
        getValue(address),
      ]);
      const total = Array.isArray(value) && value[0] ? value[0].value : 0;

      let out = `Wallet ${shortAddr(address)}\nValor total de cartera: ${formatUSD(total)}\n`;
      if (!Array.isArray(positions) || positions.length === 0) {
        out += '\nSin posiciones abiertas relevantes (o por debajo del tamano minimo).';
      } else {
        out += `\nPosiciones abiertas (top ${positions.length} por valor actual):\n`;
        positions.forEach((p, i) => {
          const size = typeof p.size === 'number' ? p.size.toFixed(2) : p.size;
          const pnlPct = typeof p.percentPnl === 'number' ? p.percentPnl.toFixed(1) : p.percentPnl;
          out += `\n${i + 1}. ${p.title}`;
          out += `\n   Resultado: ${p.outcome} - Tamano: ${size}`;
          out += `\n   Valor actual: ${formatUSD(p.currentValue)} - PnL: ${formatUSD(p.cashPnl)} (${pnlPct}%)`;
          out += `\n   Resuelve: ${p.endDate || 'n/d'}`;
        });
      }
      await sendLong(bot, chatId, out);
    } catch (err) {
      await bot.sendMessage(chatId, `Error consultando la wallet: ${err.message}`);
    }
  });

  bot.onText(/^\/actividad(?:\s+(\S+))?(?:\s+(\d+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const address = (match[1] || '').trim();
    const n = Math.min(Number(match[2] || 10), 20);
    if (!isAddress(address)) {
      return bot.sendMessage(chatId, 'Uso: /actividad 0xdireccion [n]');
    }
    try {
      const activity = await getActivity(address, { limit: n });
      if (!Array.isArray(activity) || activity.length === 0) {
        return bot.sendMessage(chatId, 'Sin actividad registrada para esa direccion.');
      }
      let out = `Ultimas ${activity.length} operaciones de ${shortAddr(address)}:\n`;
      activity.forEach((a, i) => {
        out += `\n${i + 1}. [${a.type}${a.side ? ' ' + a.side : ''}] ${a.title || 'mercado sin titulo'}`;
        out += `\n   Importe: ${formatUSD(a.usdcSize)} - Precio: ${a.price ?? 'n/d'} - ${formatDate(a.timestamp, process.env.TZ_DISPLAY)}`;
      });
      await sendLong(bot, chatId, out);
    } catch (err) {
      await bot.sendMessage(chatId, `Error consultando actividad: ${err.message}`);
    }
  });

  bot.onText(/^\/mercado(?:\s+(\S+))?(?:\s+(\d+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const conditionId = (match[1] || '').trim();
    const n = Math.min(Number(match[2] || 15), 20);
    if (!conditionId.startsWith('0x')) {
      return bot.sendMessage(
        chatId,
        'Uso: /mercado 0xconditionId [n]\n(el conditionId aparece en los datos de posiciones/actividad de una wallet)'
      );
    }
    try {
      const trades = await getTrades({ market: conditionId, limit: n });
      if (!Array.isArray(trades) || trades.length === 0) {
        return bot.sendMessage(chatId, 'Sin operaciones registradas para ese mercado.');
      }
      let out = `Ultimas ${trades.length} operaciones en el mercado:\n"${trades[0].title || conditionId}"\n`;
      trades.forEach((t, i) => {
        const usd = Number(t.size || 0) * Number(t.price || 0);
        out += `\n${i + 1}. ${t.side} - ${formatUSD(usd)} (${t.size} @ ${t.price})`;
        out += `\n   Wallet: ${shortAddr(t.proxyWallet)}${t.pseudonym ? ' (' + t.pseudonym + ')' : ''} - ${formatDate(t.timestamp, process.env.TZ_DISPLAY)}`;
      });
      await sendLong(bot, chatId, out);
    } catch (err) {
      await bot.sendMessage(chatId, `Error consultando el mercado: ${err.message}`);
    }
  });

  bot.onText(/^\/holders(?:\s+(\S+))?(?:\s+(\d+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const conditionId = (match[1] || '').trim();
    const n = Math.min(Number(match[2] || 5), 10);
    if (!conditionId.startsWith('0x')) {
      return bot.sendMessage(chatId, 'Uso: /holders 0xconditionId [n]');
    }
    try {
      const holders = await getHolders(conditionId, n);
      if (!Array.isArray(holders) || holders.length === 0) {
        return bot.sendMessage(chatId, 'Sin datos de holders para ese mercado.');
      }
      let out = 'Mayores posiciones por resultado:\n';
      holders.forEach((group) => {
        out += `\nToken ${shortAddr(group.token)}:`;
        (group.holders || []).forEach((h, i) => {
          const amount = typeof h.amount === 'number' ? h.amount.toFixed(2) : h.amount;
          out += `\n  ${i + 1}. ${shortAddr(h.proxyWallet)}${h.name ? ' (' + h.name + ')' : ''} - ${amount} shares`;
        });
      });
      await sendLong(bot, chatId, out);
    } catch (err) {
      await bot.sendMessage(chatId, `Error consultando holders: ${err.message}`);
    }
  });

  bot.onText(/^\/vigilar(?:\s+(\S+))?(?:\s+(.+))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    const address = (match[1] || '').trim();
    const label = (match[2] || '').trim();
    if (!isAddress(address)) {
      return bot.sendMessage(chatId, 'Uso: /vigilar 0xdireccion [etiqueta opcional]');
    }
    const { isNew } = watchlist.addWallet(chatId, address, label);
    bot.sendMessage(
      chatId,
      isNew
        ? `Wallet anadida a vigilancia: ${shortAddr(address)}${label ? ' (' + label + ')' : ''}.\nSolo se avisara de actividad nueva a partir de ahora.`
        : 'Esa wallet ya estaba en vigilancia (etiqueta actualizada si has dado una nueva).'
    );
  });

  bot.onText(/^\/dejar(?:\s+(\S+))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    const address = (match[1] || '').trim();
    if (!isAddress(address)) {
      return bot.sendMessage(chatId, 'Uso: /dejar 0xdireccion');
    }
    const existed = watchlist.removeWallet(chatId, address);
    bot.sendMessage(
      chatId,
      existed ? `Wallet quitada de vigilancia: ${shortAddr(address)}` : 'Esa wallet no estaba en vigilancia.'
    );
  });

  bot.onText(/^\/vigilancia$/, (msg) => {
    const chatId = msg.chat.id;
    const wallets = watchlist.listWallets(chatId);
    const entries = Object.entries(wallets);
    if (entries.length === 0) {
      return bot.sendMessage(chatId, 'No hay wallets en vigilancia en este chat. Usa /vigilar 0xdireccion');
    }
    let out = 'Wallets vigiladas en este chat:\n';
    entries.forEach(([addr, info], i) => {
      out += `\n${i + 1}. ${shortAddr(addr)}${info.label ? ' - ' + info.label : ''}`;
    });
    bot.sendMessage(chatId, out);
  });

  bot.onText(/^\/umbral(?:\s+(\d+(?:\.\d+)?))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!match[1]) {
      const current = watchlist.getThreshold(chatId);
      return bot.sendMessage(chatId, `Umbral de alerta actual: ${formatUSD(current)}\nUso: /umbral 500`);
    }
    const value = Number(match[1]);
    watchlist.setThreshold(chatId, value);
    bot.sendMessage(chatId, `Umbral de alerta actualizado a ${formatUSD(value)}`);
  });

  bot.on('polling_error', (err) => console.error('Error de polling de Telegram:', err.message));

  return bot;
}

module.exports = { createBot };
