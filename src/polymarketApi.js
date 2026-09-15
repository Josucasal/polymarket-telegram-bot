// Cliente para la API publica de datos de Polymarket (data-api.polymarket.com).
// No requiere clave para las lecturas usadas aqui. Referencia de endpoints:
// /positions, /activity, /trades, /holders, /value.

const BASE_URL = 'https://data-api.polymarket.com';

async function apiGet(path, params = {}) {
  const url = new URL(BASE_URL + path);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (res.status === 429) {
    throw new Error(
      'Limite de peticiones de la API de Polymarket alcanzado. Prueba de nuevo en unos segundos.'
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Polymarket API respondio ${res.status}: ${text.slice(0, 200) || res.statusText}`);
  }
  return res.json();
}

// Posiciones actuales de una wallet.
function getPositions(user, opts = {}) {
  return apiGet('/positions', {
    user,
    limit: opts.limit ?? 20,
    sortBy: opts.sortBy ?? 'CURRENT',
    sortDirection: opts.sortDirection ?? 'DESC',
    sizeThreshold: opts.sizeThreshold ?? 1,
    market: opts.market,
  });
}

// Actividad on-chain de una wallet (trades, splits, merges, redeems, rewards, conversions).
function getActivity(user, opts = {}) {
  return apiGet('/activity', {
    user,
    limit: opts.limit ?? 20,
    offset: opts.offset,
    market: opts.market,
    type: opts.type,
    start: opts.start,
    end: opts.end,
    side: opts.side,
    sortBy: opts.sortBy ?? 'TIMESTAMP',
    sortDirection: opts.sortDirection ?? 'DESC',
  });
}

// Operaciones (trades) filtradas por wallet y/o mercado. No requiere "user".
function getTrades(opts = {}) {
  return apiGet('/trades', {
    user: opts.user,
    market: opts.market,
    limit: opts.limit ?? 20,
    offset: opts.offset,
    side: opts.side,
    takerOnly: opts.takerOnly,
  });
}

// Mayores posiciones (holders) de un mercado concreto, por conditionId.
function getHolders(market, limit = 10) {
  return apiGet('/holders', { market, limit });
}

// Valor total en USD de las posiciones de una wallet.
function getValue(user, market) {
  return apiGet('/value', { user, market });
}

module.exports = { getPositions, getActivity, getTrades, getHolders, getValue };
