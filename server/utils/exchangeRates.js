const https = require('https');

const cache = {}; // { 'GBP': { rates: {USD: 1.27, EUR: 1.16, ...}, fetchedAt: Date } }
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Fallback rates relative to GBP (if API down)
const FALLBACK_RATES = {
  GBP: {
    USD: 1.27, EUR: 1.16, INR: 105.5, JPY: 190.2, AUD: 1.93, CAD: 1.73,
    CHF: 1.13, CNY: 9.18, SGD: 1.70, HKD: 9.94, NZD: 2.10, NOK: 13.45,
    SEK: 13.20, DKK: 8.64, MXN: 21.80, BRL: 6.35, ZAR: 23.50, KRW: 1690,
    AED: 4.67, SAR: 4.76, THB: 44.50, MYR: 5.95, IDR: 20100, PHP: 72.30,
    PLN: 5.02, CZK: 29.10, HUF: 453, RON: 5.77, TRY: 40.80, GBP: 1
  },
  USD: {
    GBP: 0.787, EUR: 0.914, INR: 83.10, JPY: 149.7, AUD: 1.52, CAD: 1.36,
    CHF: 0.889, CNY: 7.23, SGD: 1.34, HKD: 7.82, NZD: 1.65, NOK: 10.58,
    SEK: 10.39, DKK: 6.80, MXN: 17.15, BRL: 5.00, ZAR: 18.50, KRW: 1330,
    AED: 3.67, SAR: 3.75, THB: 35.02, MYR: 4.68, IDR: 15820, PHP: 56.90,
    PLN: 3.95, CZK: 22.90, HUF: 356, RON: 4.54, TRY: 32.10, USD: 1
  },
  EUR: {
    GBP: 0.862, USD: 1.093, INR: 90.85, JPY: 163.5, AUD: 1.66, CAD: 1.49,
    CHF: 0.971, CNY: 7.89, SGD: 1.46, HKD: 8.55, NZD: 1.80, NOK: 11.58,
    SEK: 11.37, DKK: 7.46, MXN: 18.78, BRL: 5.46, ZAR: 20.21, KRW: 1454,
    AED: 4.01, SAR: 4.10, THB: 38.30, MYR: 5.12, IDR: 17300, PHP: 62.20,
    PLN: 4.32, CZK: 25.05, HUF: 389, RON: 4.96, TRY: 35.12, EUR: 1
  }
};

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', reject);
  });
}

async function getRate(from, to) {
  if (from === to) return 1;

  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  // Check cache
  const cached = cache[fromUpper];
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
    const rate = cached.rates[toUpper];
    if (rate !== undefined) return rate;
  }

  // Fetch from API
  try {
    const data = await fetchJSON(`https://open.er-api.com/v6/latest/${fromUpper}`);
    if (data && data.rates) {
      cache[fromUpper] = { rates: data.rates, fetchedAt: Date.now() };
      const rate = data.rates[toUpper];
      if (rate !== undefined) return rate;
    }
    throw new Error(`Rate not found for ${toUpper}`);
  } catch (err) {
    console.warn(`Exchange rate API failed for ${fromUpper}: ${err.message}. Using fallback.`);
    // Try fallback rates
    if (FALLBACK_RATES[fromUpper] && FALLBACK_RATES[fromUpper][toUpper] !== undefined) {
      return FALLBACK_RATES[fromUpper][toUpper];
    }
    // Try via GBP as intermediate
    if (FALLBACK_RATES[fromUpper] && FALLBACK_RATES['GBP'] && FALLBACK_RATES[fromUpper]['GBP'] !== undefined) {
      const toGBP = FALLBACK_RATES[fromUpper]['GBP'];
      if (FALLBACK_RATES['GBP'][toUpper] !== undefined) {
        return +(toGBP * FALLBACK_RATES['GBP'][toUpper]).toFixed(6);
      }
    }
    throw new Error(`No exchange rate available for ${fromUpper} to ${toUpper}`);
  }
}

async function convert(amount, from, to) {
  const rate = await getRate(from, to);
  return {
    convertedAmount: +(amount * rate).toFixed(2),
    rate
  };
}

module.exports = { getRate, convert };
