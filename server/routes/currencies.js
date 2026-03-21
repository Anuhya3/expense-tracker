const express = require('express');
const { protect } = require('../middleware/auth');
const { getRate } = require('../utils/exchangeRates');

const router = express.Router();
router.use(protect);

const CURRENCIES = [
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' }
];

// GET /api/currencies
router.get('/', async (req, res) => {
  try {
    const baseCurrency = req.user.currency || 'GBP';
    res.json({ currencies: CURRENCIES, baseCurrency });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/currencies/rates
router.get('/rates', async (req, res) => {
  try {
    const baseCurrency = req.user.currency || 'GBP';
    const rateCodes = CURRENCIES.map(c => c.code).filter(c => c !== baseCurrency);

    const rateResults = await Promise.allSettled(
      rateCodes.map(async code => {
        const rate = await getRate(baseCurrency, code);
        return { code, rate };
      })
    );

    const rates = {};
    rates[baseCurrency] = 1;
    for (const result of rateResults) {
      if (result.status === 'fulfilled') {
        rates[result.value.code] = result.value.rate;
      }
    }

    res.json({ baseCurrency, rates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/currencies/convert?from=USD&to=GBP&amount=100
router.get('/convert', async (req, res) => {
  try {
    const { from, to, amount } = req.query;
    if (!from || !to || !amount) return res.status(400).json({ error: 'from, to, and amount are required' });

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });

    const rate = await getRate(from.toUpperCase(), to.toUpperCase());
    const convertedAmount = +(numAmount * rate).toFixed(2);

    res.json({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      amount: numAmount,
      convertedAmount,
      rate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
