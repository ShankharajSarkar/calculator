/**
 * ==========================================================================
 * SHARED CALCULATOR UTILITIES (common.js)
 * ==========================================================================
 */

const FinanceUtils = (function () {
  'use strict';

  // Currency configuration specs
  const CURRENCY_CONFIGS = {
    INR: { locale: 'en-IN', symbol: '₹', code: 'INR' },
    USD: { locale: 'en-US', symbol: '$', code: 'USD' },
    EUR: { locale: 'de-DE', symbol: '€', code: 'EUR' },
    GBP: { locale: 'en-GB', symbol: '£', code: 'GBP' },
    AED: { locale: 'en-AE', symbol: 'AED ', code: 'AED' },
    SGD: { locale: 'en-SG', symbol: 'S$', code: 'SGD' },
    AUD: { locale: 'en-AU', symbol: 'A$', code: 'AUD' }
  };

  /**
   * Formats numeric currency with appropriate digit grouping (e.g. INR lakh/crore)
   */
  function formatCurrency(amount, currencyCode = 'INR', showDecimals = false) {
    if (isNaN(amount) || amount === null) amount = 0;
    const config = CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.INR;

    const formatted = new Intl.NumberFormat(config.locale, {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0
    }).format(Math.round(amount));

    return `${config.symbol}${formatted}`;
  }

  /**
   * Compact number formatter for chart axes (e.g., ₹10L, ₹1Cr or $10k, $1M)
   */
  function formatCompact(amount, currencyCode = 'INR') {
    const config = CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.INR;
    if (currencyCode === 'INR') {
      if (amount >= 10000000) return `${config.symbol}${(amount / 10000000).toFixed(1)}Cr`;
      if (amount >= 100000) return `${config.symbol}${(amount / 100000).toFixed(1)}L`;
      if (amount >= 1000) return `${config.symbol}${(amount / 1000).toFixed(0)}k`;
      return `${config.symbol}${amount}`;
    }
    return `${config.symbol}${new Intl.NumberFormat(config.locale, { notation: 'compact', compactDisplay: 'short' }).format(amount)}`;
  }

  /**
   * High performance debounce for real-time slider/number input calculation loops
   */
  function debounce(func, wait = 16) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Bi-directional synchronization helper for matching Range Slider & Number Inputs
   */
  function bindInputSliderPair(numberInputId, sliderInputId, onChangeCallback) {
    const numEl = document.getElementById(numberInputId);
    const sliderEl = document.getElementById(sliderInputId);

    if (!numEl || !sliderEl) return;

    const handler = (source) => {
      if (source === 'num') {
        sliderEl.value = numEl.value;
      } else {
        numEl.value = sliderEl.value;
      }
      if (typeof onChangeCallback === 'function') {
        onChangeCallback();
      }
    };

    numEl.addEventListener('input', () => handler('num'));
    sliderEl.addEventListener('input', () => handler('slider'));
  }

  /**
   * Default Chart.js theme tokens
   */
  const ChartTheme = {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    investedColor: '#475569',
    returnsColor: '#00d09c',
    gridColor: '#e2e8f0',
    tooltipBg: '#0f172a'
  };

  return {
    formatCurrency,
    formatCompact,
    debounce,
    bindInputSliderPair,
    ChartTheme,
    CURRENCY_CONFIGS
  };
})();
