const AdManagerRowsSchema = require("../../models/AdManagerRowsSchema");
const { getDateFilter, getDatesArray } = require("../../../utils/dateFormate");


const getAdManagerReportsHelper = async (
    user,
    {
        page = 1,
        limit = 50,
        countries = [],
        sites = [],
        dateRange = "today",
        startDate = null,
        endDate = null,
        sortKey = "reportDate",
        sortDirection = -1,
        columns = "",
    }
) => {

    try {
        const userId = user._id;
        const accountIds = (user.adManagerAccounts || [])
            .map(acc => String(acc.networkId))
            .filter(Boolean);

        if (!userId || accountIds.length === 0) {
            return { error: "No Ad Manager accounts linked to user" };
        }

        // Date filter
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.reportDate = { $in: getDatesArray(startDate, endDate) };
        } else {
            dateFilter.reportDate = getDateFilter(dateRange);
        }
        let match = {};
        // Base match
        // if (Array.isArray(sites) && sites.length > 0) {
        match = {
            userId,
            networkId: { $in: accountIds },
            site: { $in: sites },
            ...dateFilter,
        };
        // } else {
        //     match = {};
        // }
        if (countries.length > 0) match.country = { $in: countries };
        const hasSite = columns.includes("site");
        const hasCountry = columns.includes("country");
        const isSiteView = hasSite && !hasCountry;
        const isCountryView = hasCountry && !hasSite;

        const sortObj = { [sortKey]: sortDirection };
        let result;
        const allLists = await AdManagerRowsSchema.aggregate([
            { $match: { userId, networkId: { $in: accountIds } } }, // no filters
            {
                $group: {
                    _id: null,
                    allCountries: { $addToSet: "$country" },
                    allSites: { $addToSet: "$site" },
                },
            },
        ]);

        const allCountries = (allLists[0]?.allCountries || []).sort();
        const allSites = (allLists[0]?.allSites || []).sort();

        if (isSiteView) {
            result = await AdManagerRowsSchema.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: { site: "$site", reportDate: "$reportDate" },
                        adxExchangeLineItemLevelRevenue: {
                            $sum: { $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] },
                        },
                        adxExchangeLineItemLevelClicks: { $sum: "$adxExchangeLineItemLevelClicks" },
                        adxExchangeLineItemLevelImpressions: { $sum: "$adxExchangeLineItemLevelImpressions" },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        site: "$_id.site",
                        reportDate: "$_id.reportDate",
                        adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
                        adxExchangeLineItemLevelClicks: 1,
                        adxExchangeLineItemLevelImpressions: 1,
                        adxExchangeLineItemLevelCtr: {
                            $cond: [
                                { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                {
                                    $round: [
                                        {
                                            $multiply: [
                                                { $divide: ["$adxExchangeLineItemLevelClicks", "$adxExchangeLineItemLevelImpressions"] },
                                                100,
                                            ],
                                        },
                                        2,
                                    ],
                                },
                                0,
                            ],
                        },
                        adxExchangeCostPerClick: {
                            $cond: [
                                { $gt: ["$adxExchangeLineItemLevelClicks", 0] },
                                {
                                    $round: [
                                        {
                                            $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelClicks"],
                                        },
                                        2,
                                    ],
                                },
                                0,
                            ],
                        },
                        adxExchangeLineItemLevelAverageECPM: {
                            $cond: [
                                { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                {
                                    $round: [
                                        {
                                            $multiply: [
                                                { $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelImpressions"] },
                                                1000,
                                            ],
                                        },
                                        2,
                                    ],
                                },
                                0,
                            ],
                        },
                    },
                },
                { $sort: sortObj },
                {
                    $facet: {
                        paginatedResults: [
                            { $skip: (page - 1) * limit },
                            { $limit: limit },
                        ],
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    adxExchangeLineItemLevelRevenue: { $sum: "$adxExchangeLineItemLevelRevenue" },
                                    adxExchangeLineItemLevelClicks: { $sum: "$adxExchangeLineItemLevelClicks" },
                                    adxExchangeLineItemLevelImpressions: { $sum: "$adxExchangeLineItemLevelImpressions" },
                                },
                            },
                            {
                                $project: {
                                    _id: 0,
                                    adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
                                    adxExchangeLineItemLevelClicks: 1,
                                    adxExchangeLineItemLevelImpressions: 1,
                                    adxExchangeLineItemLevelCtr: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                            {
                                                $round: [
                                                    {
                                                        $multiply: [
                                                            { $divide: ["$adxExchangeLineItemLevelClicks", "$adxExchangeLineItemLevelImpressions"] },
                                                            100,
                                                        ],
                                                    },
                                                    2,
                                                ],
                                            },
                                            0,
                                        ],
                                    },
                                    adxExchangeCostPerClick: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelClicks", 0] },
                                            {
                                                $round: [
                                                    { $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelClicks"] },
                                                    2,
                                                ],
                                            },
                                            0,
                                        ],
                                    },
                                    adxExchangeLineItemLevelAverageECPM: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                            {
                                                $round: [
                                                    {
                                                        $multiply: [
                                                            { $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelImpressions"] },
                                                            1000,
                                                        ],
                                                    },
                                                    2,
                                                ],
                                            },
                                            0,
                                        ],
                                    },
                                },
                            },
                        ],
                        totalCount: [{ $count: "count" }],
                    },
                },
            ]);
        }
        else if (isCountryView) {
            // 🔹 Country-wise aggregation
            result = await AdManagerRowsSchema.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: { country: "$country", reportDate: "$reportDate" },
                        adxExchangeLineItemLevelRevenue: { $sum: { $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] } },
                        adxExchangeLineItemLevelClicks: { $sum: "$adxExchangeLineItemLevelClicks" },
                        adxExchangeLineItemLevelImpressions: { $sum: "$adxExchangeLineItemLevelImpressions" },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        country: "$_id.country",
                        reportDate: "$_id.reportDate",
                        adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
                        adxExchangeLineItemLevelClicks: 1,
                        adxExchangeLineItemLevelImpressions: 1,
                        adxExchangeLineItemLevelCtr: {
                            $cond: [
                                { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                {
                                    $round: [
                                        {
                                            $multiply: [
                                                { $divide: ["$adxExchangeLineItemLevelClicks", "$adxExchangeLineItemLevelImpressions"] },
                                                100,
                                            ],
                                        },
                                        2,
                                    ],
                                },
                                0,
                            ],
                        },
                        adxExchangeCostPerClick: {
                            $cond: [
                                { $gt: ["$adxExchangeLineItemLevelClicks", 0] },
                                {
                                    $round: [
                                        { $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelClicks"] },
                                        2,
                                    ],
                                },
                                0,
                            ],
                        },
                        adxExchangeLineItemLevelAverageECPM: {
                            $cond: [
                                { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                {
                                    $round: [
                                        {
                                            $multiply: [
                                                { $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelImpressions"] },
                                                1000,
                                            ],
                                        },
                                        2,
                                    ],
                                },
                                0,
                            ],
                        },
                    },
                },
                { $sort: sortObj },
                {
                    $facet: {
                        paginatedResults: [
                            { $skip: (page - 1) * limit },
                            { $limit: limit },
                        ],
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    adxExchangeLineItemLevelRevenue: { $sum: "$adxExchangeLineItemLevelRevenue" },
                                    adxExchangeLineItemLevelClicks: { $sum: "$adxExchangeLineItemLevelClicks" },
                                    adxExchangeLineItemLevelImpressions: { $sum: "$adxExchangeLineItemLevelImpressions" },
                                },
                            },
                            {
                                $project: {
                                    _id: 0,
                                    adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
                                    adxExchangeLineItemLevelClicks: 1,
                                    adxExchangeLineItemLevelImpressions: 1,
                                    adxExchangeLineItemLevelCtr: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                            {
                                                $round: [
                                                    {
                                                        $multiply: [
                                                            { $divide: ["$adxExchangeLineItemLevelClicks", "$adxExchangeLineItemLevelImpressions"] },
                                                            100,
                                                        ],
                                                    },
                                                    2,
                                                ],
                                            },
                                            0,
                                        ],
                                    },
                                    adxExchangeCostPerClick: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelClicks", 0] },
                                            { $round: [{ $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelClicks"] }, 2] },
                                            0,
                                        ],
                                    },
                                    adxExchangeLineItemLevelAverageECPM: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                            {
                                                $round: [
                                                    { $multiply: [{ $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelImpressions"] }, 1000] },
                                                    2,
                                                ],
                                            },
                                            0,
                                        ],
                                    },
                                },
                            },
                        ],
                        totalCount: [{ $count: "count" }],
                    },
                },
            ]);
        }
        // -----------------------------
        // 🔹 NORMAL ROW VIEW (default)
        // -----------------------------
        else {
            result = await AdManagerRowsSchema.aggregate([
                { $match: match },
                {
                    $facet: {
                        paginatedResults: [
                            { $sort: sortObj },
                            { $skip: (page - 1) * limit },
                            { $limit: limit },
                            {
                                $project: {
                                    _id: 0,
                                    reportDate: 1,
                                    site: 1,
                                    country: 1,
                                    adxExchangeLineItemLevelRevenue: { $round: [{ $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] }, 2] },
                                    adxExchangeLineItemLevelClicks: 1,
                                    adxExchangeLineItemLevelImpressions: 1,
                                    adxExchangeLineItemLevelAverageECPM: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                            { $round: [{ $multiply: [{ $divide: [{ $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] }, "$adxExchangeLineItemLevelImpressions"] }, 1000] }, 2] },
                                            0,
                                        ],
                                    },
                                    adxExchangeLineItemLevelCtr: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                            { $round: [{ $multiply: [{ $divide: ["$adxExchangeLineItemLevelClicks", "$adxExchangeLineItemLevelImpressions"] }, 100] }, 2] },
                                            0,
                                        ],
                                    },
                                    adxExchangeCostPerClick: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelClicks", 0] },
                                            { $round: [{ $divide: [{ $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] }, "$adxExchangeLineItemLevelClicks"] }, 2] },
                                            0,
                                        ],
                                    },
                                },
                            },
                        ],
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    adxExchangeLineItemLevelRevenue: { $sum: { $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] } },
                                    adxExchangeLineItemLevelClicks: { $sum: "$adxExchangeLineItemLevelClicks" },
                                    adxExchangeLineItemLevelImpressions: { $sum: "$adxExchangeLineItemLevelImpressions" },
                                },
                            },
                            {
                                $project: {
                                    _id: 0,
                                    adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
                                    adxExchangeLineItemLevelClicks: 1,
                                    adxExchangeLineItemLevelImpressions: 1,
                                    adxExchangeLineItemLevelAverageECPM: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                            { $round: [{ $multiply: [{ $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelImpressions"] }, 1000] }, 2] },
                                            0,
                                        ],
                                    },
                                    adxExchangeLineItemLevelCtr: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                            { $round: [{ $multiply: [{ $divide: ["$adxExchangeLineItemLevelClicks", "$adxExchangeLineItemLevelImpressions"] }, 100] }, 2] },
                                            0,
                                        ],
                                    },
                                    adxExchangeCostPerClick: {
                                        $cond: [
                                            { $gt: ["$adxExchangeLineItemLevelClicks", 0] },
                                            { $round: [{ $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelClicks"] }, 2] },
                                            0,
                                        ],
                                    },
                                },
                            },
                        ],
                        totalCount: [{ $count: "count" }],
                    },
                },
            ]);
        }

        const reports = result[0]?.paginatedResults || [];
        const rawTotals = result[0]?.totals[0] || {};
        const totalCount = result[0]?.totalCount[0]?.count || 0;

        return {
            success: true,
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            count: reports.length,
            reports,
            totals: rawTotals,
            allCountries,
            allSites
        };
    } catch (err) {
        console.error("Error in getAdManagerReportsHelper:", err);
        return { error: "Failed to fetch Ad Manager reports" };
    }
};
module.exports = { getAdManagerReportsHelper };

