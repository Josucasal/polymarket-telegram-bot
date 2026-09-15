// Persistencia simple en un fichero JSON. Suficiente para un numero moderado
// de chats y wallets vigiladas. Si esto crece mucho, sustituir por SQLite.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'watchlist.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ chats: {} }, null, 2));
}

function load() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    console.error('No se pudo leer data/watchlist.json, se reinicia vacio:', err.message);
    return { chats: {} };
  }
}

function save(data) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getOrCreateChat(data, chatId) {
  const key = String(chatId);
  if (!data.chats[key]) {
    data.chats[key] = {
      threshold: Number(process.env.DEFAULT_THRESHOLD_USD || 1000),
      wallets: {},
    };
  }
  return data.chats[key];
}

function addWallet(chatId, address, label) {
  const data = load();
  const chat = getOrCreateChat(data, chatId);
  const key = address.toLowerCase();
  const isNew = !chat.wallets[key];
  chat.wallets[key] = {
    label: label || chat.wallets[key]?.label || '',
    addedAt: chat.wallets[key]?.addedAt || Math.floor(Date.now() / 1000),
    // Al anadir una wallet, solo se avisa de actividad posterior a este momento.
    lastSeenTimestamp: chat.wallets[key]?.lastSeenTimestamp ?? Math.floor(Date.now() / 1000),
  };
  save(data);
  return { isNew, wallet: chat.wallets[key] };
}

function removeWallet(chatId, address) {
  const data = load();
  const chat = getOrCreateChat(data, chatId);
  const key = address.toLowerCase();
  const existed = !!chat.wallets[key];
  delete chat.wallets[key];
  save(data);
  return existed;
}

function listWallets(chatId) {
  const data = load();
  return getOrCreateChat(data, chatId).wallets;
}

function setThreshold(chatId, usd) {
  const data = load();
  const chat = getOrCreateChat(data, chatId);
  chat.threshold = usd;
  save(data);
}

function getThreshold(chatId) {
  const data = load();
  return getOrCreateChat(data, chatId).threshold;
}

function updateLastSeen(chatId, address, timestamp) {
  const data = load();
  const chat = getOrCreateChat(data, chatId);
  const key = address.toLowerCase();
  if (chat.wallets[key]) {
    chat.wallets[key].lastSeenTimestamp = timestamp;
    save(data);
  }
}

function allChatsWithWallets() {
  return load().chats;
}

module.exports = {
  addWallet,
  removeWallet,
  listWallets,
  setThreshold,
  getThreshold,
  updateLastSeen,
  allChatsWithWallets,
};
