function normalizeTotals(result) {
  const keys = [
    "adxExchangeLineItemLevelRevenue",
    "adxExchangeLineItemLevelClicks",
    "adxExchangeLineItemLevelImpressions",
    "adxExchangeLineItemLevelAverageECPM",
    "adxExchangeLineItemLevelCtr",
    "adxExchangeCostPerClick",
  ];

  const rawTotals = result?.[0]?.totals?.[0] || {};

  return keys.reduce((acc, key) => {
    acc[key] = rawTotals[key] ?? 0;
    return acc;
  }, {});
}

module.exports = normalizeTotals;
