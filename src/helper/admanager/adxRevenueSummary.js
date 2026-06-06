const { getDateFilter } = require("../../../utils/dateFormate");

const getAdManagerRevenueSummary = async (Model, userId, networkId) => {
  const todayFilter = getDateFilter("today");
  const yesterdayFilter = getDateFilter("yesterday");
  const last7Filter = getDateFilter("last7");
  const thisMonthFilter = getDateFilter("thisMonth");

  const result = await Model.aggregate([
    {
      $match: {
        userId,
        networkId,
        adxExchangeLineItemLevelRevenue: { $gt: 0 },
      },
    },
    {
      // MICROS → DOLLARS
      $addFields: {
        revenue: {
          $divide: ["$adxExchangeLineItemLevelRevenue", 1000000],
        },
      },
    },
    {
      $facet: {
        today: [
          { $match: { reportDate: todayFilter } },
          { $group: { _id: null, revenue: { $sum: "$revenue" } } },
        ],
        yesterday: [
          { $match: { reportDate: yesterdayFilter } },
          { $group: { _id: null, revenue: { $sum: "$revenue" } } },
        ],
        last7Days: [
          { $match: { reportDate: last7Filter } },
          { $group: { _id: null, revenue: { $sum: "$revenue" } } },
        ],
        thisMonth: [
          { $match: { reportDate: thisMonthFilter } },
          { $group: { _id: null, revenue: { $sum: "$revenue" } } },
        ],
      },
    },
    {
      // ✅ ROUND UP LIKE TABLE (always 2 decimals)
      $project: {
        today: {
          $cond: [
            { $gt: [{ $arrayElemAt: ["$today.revenue", 0] }, null] },
            {
              $divide: [
                {
                  $ceil: {
                    $multiply: [
                      { $arrayElemAt: ["$today.revenue", 0] },
                      100,
                    ],
                  },
                },
                100,
              ],
            },
            0,
          ],
        },
        yesterday: {
          $cond: [
            { $gt: [{ $arrayElemAt: ["$yesterday.revenue", 0] }, null] },
            {
              $divide: [
                {
                  $ceil: {
                    $multiply: [
                      { $arrayElemAt: ["$yesterday.revenue", 0] },
                      100,
                    ],
                  },
                },
                100,
              ],
            },
            0,
          ],
        },
        last7Days: {
          $cond: [
            { $gt: [{ $arrayElemAt: ["$last7Days.revenue", 0] }, null] },
            {
              $divide: [
                {
                  $ceil: {
                    $multiply: [
                      { $arrayElemAt: ["$last7Days.revenue", 0] },
                      100,
                    ],
                  },
                },
                100,
              ],
            },
            0,
          ],
        },
        thisMonth: {
          $cond: [
            { $gt: [{ $arrayElemAt: ["$thisMonth.revenue", 0] }, null] },
            {
              $divide: [
                {
                  $ceil: {
                    $multiply: [
                      { $arrayElemAt: ["$thisMonth.revenue", 0] },
                      100,
                    ],
                  },
                },
                100,
              ],
            },
            0,
          ],
        },
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

module.exports = { getAdManagerRevenueSummary };
