const { getActivity } = require('./polymarketApi');
const { allChatsWithWallets, updateLastSeen } = require('./watchlist');
const { formatUSD, formatDate, shortAddr } = require('./format');

const TYPE_LABEL = {
  TRADE: 'Operacion',
  SPLIT: 'Split',
  MERGE: 'Merge',
  REDEEM: 'Canje',
  REWARD: 'Recompensa',
  CONVERSION: 'Conversion',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatActivityItem(item, flagged) {
  const typeLabel = TYPE_LABEL[item.type] || item.type;
  const lines = [
    `${flagged ? '🚩 ' : ''}${typeLabel}${item.side ? ' - ' + item.side : ''}`,
    item.title ? `Mercado: ${item.title}` : null,
    item.outcome ? `Resultado: ${item.outcome}` : null,
    item.usdcSize !== undefined ? `Importe: ${formatUSD(item.usdcSize)}` : null,
    item.price !== undefined ? `Precio: ${item.price}` : null,
    `Fecha: ${formatDate(item.timestamp, process.env.TZ_DISPLAY)}`,
  ].filter(Boolean);
  return lines.join('\n');
}

async function checkOnce(bot) {
  const chats = allChatsWithWallets();

  for (const [chatId, chat] of Object.entries(chats)) {
    const threshold = Number(chat.threshold ?? process.env.DEFAULT_THRESHOLD_USD ?? 1000);
    const wallets = Object.entries(chat.wallets || {});

    for (const [address, info] of wallets) {
      try {
        const activity = await getActivity(address, { limit: 25 });
        if (Array.isArray(activity) && activity.length > 0) {
          const lastSeen = info.lastSeenTimestamp || 0;
          const nuevos = activity
            .filter((item) => item.timestamp && item.timestamp > lastSeen)
            .sort((a, b) => a.timestamp - b.timestamp);

          if (nuevos.length > 0) {
            for (const item of nuevos) {
              const flagged = Number(item.usdcSize || 0) >= threshold;
              const header = `${flagged ? 'ALERTA' : 'Actividad'} - ${info.label || shortAddr(address)}`;
              await bot.sendMessage(chatId, `${header}\n${formatActivityItem(item, flagged)}`);
              await sleep(150);
            }
            const maxTs = Math.max(...nuevos.map((item) => item.timestamp));
            updateLastSeen(chatId, address, maxTs);
          }
        }
      } catch (err) {
        console.error(`Error comprobando ${address} (chat ${chatId}):`, err.message);
      }
      // Pequena pausa entre wallets para no saturar la API publica.
      await sleep(300);
    }
  }
}

function startMonitor(bot, intervalMs) {
  checkOnce(bot).catch((err) => console.error('Error en el primer chequeo:', err.message));
  return setInterval(() => {
    checkOnce(bot).catch((err) => console.error('Error en chequeo periodico:', err.message));
  }, intervalMs);
}

module.exports = { startMonitor };
