function formatUSD(n) {
  const num = Number(n) || 0;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts, tz) {
  if (!ts) return 'fecha desconocida';
  const date = new Date(Number(ts) * 1000);
  return date.toLocaleString('es-ES', {
    timeZone: tz || 'Europe/Madrid',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function shortAddr(addr) {
  if (!addr) return 'n/d';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

// Divide un texto largo en trozos que respetan el limite de Telegram (~4096 caracteres),
// cortando siempre por saltos de linea para no partir una entrada por la mitad.
function chunkText(text, maxLen = 3500) {
  const chunks = [];
  let current = '';
  for (const line of text.split('\n')) {
    const candidate = current ? current + '\n' + line : line;
    if (candidate.length > maxLen) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

module.exports = { formatUSD, formatDate, shortAddr, chunkText };
