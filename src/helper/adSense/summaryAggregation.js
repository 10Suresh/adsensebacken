const { getDateFilter } = require("../../../utils/dateFormate");

async function getAdsRevenueSummary(Model, adsenseFilter) {
  // ✅ 1) Date ranges
  const todayArr = getDateFilter("today").$in;
  const yesterdayArr = getDateFilter("yesterday").$in;
  const last7Arr = getDateFilter("last7").$in;
  const thisMonthRange = getDateFilter("thisMonth"); // { $in: [...] }

  // ✅ 2) Remove "date" from base filter to avoid double condition
  const { date, ...safeFilter } = adsenseFilter;

  const result = await Model.aggregate([
    {
      $match: safeFilter, // ✅ apply userId, accountId, domain, other filters
    },
    {
      $facet: {
        today: [
          { $match: { date: { $in: todayArr } } },
          { $group: { _id: null, revenue: { $sum: "$metrics.estimatedEarnings" } } },
        ],
        yesterday: [
          { $match: { date: { $in: yesterdayArr } } },
          { $group: { _id: null, revenue: { $sum: "$metrics.estimatedEarnings" } } },
        ],
        last7Days: [
          { $match: { date: { $in: last7Arr } } },
          { $group: { _id: null, revenue: { $sum: "$metrics.estimatedEarnings" } } },
        ],
        thisMonth: [
          { $match: { date: thisMonthRange } }, // e.g. { $in: [...] }
          { $group: { _id: null, revenue: { $sum: "$metrics.estimatedEarnings" } } },
        ],
      },
    },
  ]);

  // ✅ 3) Return summary safely
  return {
    today: result[0]?.today?.[0]?.revenue || 0,
    yesterday: result[0]?.yesterday?.[0]?.revenue || 0,
    last7Days: result[0]?.last7Days?.[0]?.revenue || 0,
    thisMonth: result[0]?.thisMonth?.[0]?.revenue || 0,
  };
}

module.exports = { getAdsRevenueSummary };
