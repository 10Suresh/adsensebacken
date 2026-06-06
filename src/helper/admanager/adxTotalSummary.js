const { getDateFilter } = require("../../../utils/dateFormate");

const getAdxTotalSummary = async (Model, baseFilter) => {
  // ✅ 1) Date Filters
  const todayFilter = getDateFilter("today");
  const yesterdayFilter = getDateFilter("yesterday");
  const last7Filter = getDateFilter("last7");
  const thisMonthFilter = getDateFilter("thisMonth");

  // ✅ 2) Remove reportDate from baseFilter (to avoid conflict)
  const { reportDate, ...safeFilter } = baseFilter;

  const result = await Model.aggregate([
    {
      $match: safeFilter,  // ✅ Only userId, networkId, site, etc
    },
    {
      // ✅ Convert micros to dollars
      $addFields: {
        revenue: {
          $divide: ["$adxExchangeLineItemLevelRevenue", 1000000],
        },
      },
    },
    {
      $facet: {
        today: [
          { $match: { ...safeFilter, reportDate: todayFilter } },
          { $group: { _id: null, revenue: { $sum: "$revenue" } } },
        ],
        yesterday: [
          { $match: { ...safeFilter, reportDate: yesterdayFilter } },
          { $group: { _id: null, revenue: { $sum: "$revenue" } } },
        ],
        last7Days: [
          { $match: { ...safeFilter, reportDate: last7Filter } },
          { $group: { _id: null, revenue: { $sum: "$revenue" } } },
        ],
        thisMonth: [
          { $match: { ...safeFilter, reportDate: thisMonthFilter } },
          { $group: { _id: null, revenue: { $sum: "$revenue" } } },
        ],
      },
    },
    {
      // ✅ 2-decimal rounding
      $project: {
        today: { $round: [{ $ifNull: [{ $arrayElemAt: ["$today.revenue", 0] }, 0] }, 2] },
        yesterday: { $round: [{ $ifNull: [{ $arrayElemAt: ["$yesterday.revenue", 0] }, 0] }, 2] },
        last7Days: { $round: [{ $ifNull: [{ $arrayElemAt: ["$last7Days.revenue", 0] }, 0] }, 2] },
        thisMonth: { $round: [{ $ifNull: [{ $arrayElemAt: ["$thisMonth.revenue", 0] }, 0] }, 2] },
      },
    },
  ]);

  return (
    result[0] || {
      today: 0,
      yesterday: 0,
      last7Days: 0,
      thisMonth: 0,
    }
  );
};

module.exports = { getAdxTotalSummary };
