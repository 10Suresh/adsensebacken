const logger = require("../../logger");
const calculateMetrics = (doc) => ({
    adxExchangeLineItemLevelCtr: {
        $cond: [
            { $gt: [doc.adxExchangeLineItemLevelImpressions, 0] },
            {
                $round: [
                    {
                        $multiply: [
                            { $divide: [doc.adxExchangeLineItemLevelClicks, doc.adxExchangeLineItemLevelImpressions] },
                            100,
                        ],
                    },
                    2,
                ],
            },
            0,
        ],
    },
    // adxExchangeCostPerClick: {
    //     $cond: [
    //         { $gt: [doc.adxExchangeLineItemLevelClicks, 0] },
    //         {
    //             $round: [
    //                 {
    //                     $divide: [doc.adxExchangeLineItemLevelRevenue, doc.adxExchangeLineItemLevelClicks]
    //                 },
    //                 2,
    //             ],
    //         },
    //         0,
    //     ],
    // },
    adxExchangeCostPerClick: {
        $cond: [
            { $gt: [doc.adxExchangeLineItemLevelClicks, 0] },
            { $divide: [doc.adxExchangeLineItemLevelRevenue, doc.adxExchangeLineItemLevelClicks] },
            0.00
        ]
    }
    ,
    adxExchangeLineItemLevelAverageECPM: {
        $cond: [
            { $gt: [doc.adxExchangeLineItemLevelImpressions, 0] },
            {
                $round: [
                    {
                        $multiply: [
                            { $divide: [doc.adxExchangeLineItemLevelRevenue, doc.adxExchangeLineItemLevelImpressions] },
                            1000,
                        ],
                    },
                    2,
                ],
            },
            0,
        ],
    },
});

// --------- Shared Aggregation Runner ---------
const runAggregation = async ({ schema, pipelineBuilder, functionName, page, limit, sortObj }) => {
    const startTime = Date.now();
    const pipeline = pipelineBuilder({ page, limit, sortObj });

    const result = await schema.aggregate(pipeline);

    const durationMs = Date.now() - startTime;
    logger.info(`${functionName} executed`, { durationMs, page, limit, sortObj });

    return result;
};

// --------- View Aggregators ---------

const aggregateSiteView = async (AdManagerRowsSchema, match, sortObj, page, limit, hasDate) =>
    runAggregation({
        schema: AdManagerRowsSchema,
        functionName: "aggregateSiteView",
        page,
        limit,
        sortObj,
        pipelineBuilder: ({ page, limit, sortObj }) => {
            const groupId = { site: "$site" };
            if (hasDate) groupId.reportDate = "$reportDate";

            return [
                { $match: match },
                {
                    $group: {
                        _id: groupId,
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
                        reportDate: hasDate ? "$_id.reportDate" : undefined,
                        adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
                        adxExchangeLineItemLevelClicks: 1,
                        adxExchangeLineItemLevelImpressions: 1,
                        ...calculateMetrics({
                            adxExchangeLineItemLevelClicks: "$adxExchangeLineItemLevelClicks",
                            adxExchangeLineItemLevelImpressions: "$adxExchangeLineItemLevelImpressions",
                            adxExchangeLineItemLevelRevenue: "$adxExchangeLineItemLevelRevenue",
                        }),
                    },
                },
                { $sort: sortObj },
                {
                    $facet: {
                        paginatedResults: [{ $skip: (page - 1) * limit }, { $limit: limit }],
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
                                    ...calculateMetrics({
                                        adxExchangeLineItemLevelClicks: "$adxExchangeLineItemLevelClicks",
                                        adxExchangeLineItemLevelImpressions: "$adxExchangeLineItemLevelImpressions",
                                        adxExchangeLineItemLevelRevenue: "$adxExchangeLineItemLevelRevenue",
                                    }),
                                },
                            },
                        ],
                        totalCount: [{ $count: "count" }],
                    },
                },
            ];
        },
    });

const aggregateCountryView = async (AdManagerRowsSchema, match, sortObj, page = 1, limit) =>
    runAggregation({
        schema: AdManagerRowsSchema,
        functionName: "aggregateCountryView",
        page,
        limit,
        sortObj,
        pipelineBuilder: ({ page, limit, sortObj }) => [
            { $match: match },
            {
                $group: {
                    _id: { country: "$country", reportDate: "$reportDate" },
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
                    country: "$_id.country",
                    reportDate: "$_id.reportDate",
                    adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
                    adxExchangeLineItemLevelClicks: 1,
                    adxExchangeLineItemLevelImpressions: 1,
                    ...calculateMetrics({
                        adxExchangeLineItemLevelClicks: "$adxExchangeLineItemLevelClicks",
                        adxExchangeLineItemLevelImpressions: "$adxExchangeLineItemLevelImpressions",
                        adxExchangeLineItemLevelRevenue: "$adxExchangeLineItemLevelRevenue",
                    }),
                },
            },
            { $sort: sortObj },
            {
                $facet: {
                    paginatedResults: [{ $skip: (page - 1) * limit }, { $limit: limit }],
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
                                ...calculateMetrics({
                                    adxExchangeLineItemLevelClicks: "$adxExchangeLineItemLevelClicks",
                                    adxExchangeLineItemLevelImpressions: "$adxExchangeLineItemLevelImpressions",
                                    adxExchangeLineItemLevelRevenue: "$adxExchangeLineItemLevelRevenue",
                                }),
                            },
                        },
                    ],
                    totalCount: [{ $count: "count" }],
                },
            },
        ],
    });

// const aggregateCountryView = async (
//     AdManagerRowsSchema,
//     match,
//     sortObj,
//     page = 1,
//     limit,
//     hasDate // ✅ yeh flag pass karo
// ) =>
//     runAggregation({
//         schema: AdManagerRowsSchema,
//         functionName: "aggregateCountryView",
//         page,
//         limit,
//         sortObj,
//         pipelineBuilder: ({ page, limit, sortObj }) => {
//             const groupId = hasDate
//                 ? { country: "$country", reportDate: "$reportDate" } // ✅ date wise grouping
//                 : { country: "$country" }; // ✅ only country

//             const projectStage = {
//                 _id: 0,
//                 country: "$_id.country",
//                 reportDate: hasDate ? "$_id.reportDate" : undefined,
//                 adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
//                 adxExchangeLineItemLevelClicks: 1,
//                 adxExchangeLineItemLevelImpressions: 1,
//                 ...calculateMetrics({
//                     adxExchangeLineItemLevelClicks: "$adxExchangeLineItemLevelClicks",
//                     adxExchangeLineItemLevelImpressions: "$adxExchangeLineItemLevelImpressions",
//                     adxExchangeLineItemLevelRevenue: "$adxExchangeLineItemLevelRevenue",
//                 }),
//             };

//             // if (hasDate) {
//             //     projectStage.reportDate = "$_id.reportDate"; // ✅ sirf jab hasDate true ho
//             // }
//     console.log(hasDate,"hasDate adx c")

//             return [
//                 { $match: match },
//                 {
//                     $group: {
//                         _id: groupId,
//                         adxExchangeLineItemLevelRevenue: {
//                             $sum: { $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] },
//                         },
//                         adxExchangeLineItemLevelClicks: { $sum: "$adxExchangeLineItemLevelClicks" },
//                         adxExchangeLineItemLevelImpressions: { $sum: "$adxExchangeLineItemLevelImpressions" },
//                     },
//                 },
//                 { $project: projectStage },
//                 { $sort: sortObj },
//                 {
//                     $facet: {
//                         paginatedResults: [{ $skip: (page - 1) * limit }, { $limit: limit }],
//                         totals: [
//                             {
//                                 $group: {
//                                     _id: null,
//                                     adxExchangeLineItemLevelRevenue: { $sum: "$adxExchangeLineItemLevelRevenue" },
//                                     adxExchangeLineItemLevelClicks: { $sum: "$adxExchangeLineItemLevelClicks" },
//                                     adxExchangeLineItemLevelImpressions: { $sum: "$adxExchangeLineItemLevelImpressions" },
//                                 },
//                             },
//                             {
//                                 $project: {
//                                     _id: 0,
//                                     adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
//                                     adxExchangeLineItemLevelClicks: 1,
//                                     adxExchangeLineItemLevelImpressions: 1,
//                                     ...calculateMetrics({
//                                         adxExchangeLineItemLevelClicks: "$adxExchangeLineItemLevelClicks",
//                                         adxExchangeLineItemLevelImpressions: "$adxExchangeLineItemLevelImpressions",
//                                         adxExchangeLineItemLevelRevenue: "$adxExchangeLineItemLevelRevenue",
//                                     }),
//                                 },
//                             },
//                         ],
//                         totalCount: [{ $count: "count" }],
//                     },
//                 },
//             ];
//         },
//     });

const aggregateDefaultView = async (
    Schema,
    match,
    sortObj,
    page = 1,
    limit,
    hasDate,
    hasSite,
    hasCountry
) => {

    let groupId;

    if (hasSite && hasCountry) {
        // ✅ Group by site + country
        groupId = { site: "$site", country: "$country" };
    } else if (hasSite) {
        // ✅ Group by site
        groupId = "$site";
    } else if (hasCountry) {
        // ✅ Group by country
        groupId = "$country";
    } else {
        // ✅ Default: Group by date
        groupId = "$reportDate";
    }

    const pipeline = [{ $match: match }];

    // ✅ GROUP Stage
    pipeline.push({
        $group: {
            _id: groupId,
            adxExchangeLineItemLevelRevenue: {
                $sum: { $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] },
            },
            adxExchangeLineItemLevelClicks: { $sum: "$adxExchangeLineItemLevelClicks" },
            adxExchangeLineItemLevelImpressions: { $sum: "$adxExchangeLineItemLevelImpressions" },
            reportDate: { $first: "$reportDate" },
            site: { $first: "$site" },
            country: { $first: "$country" },
        },
    });

    // ✅ PROJECT Stage (final display)
    pipeline.push({
        $project: {
            _id: 0,
            reportDate: hasSite || hasCountry ? "$reportDate" : "$_id",
            site: hasSite ? (hasCountry ? "$_id.site" : "$_id") : "$site",
            country: hasCountry ? (hasSite ? "$_id.country" : "$_id") : "$country",
            adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
            adxExchangeLineItemLevelClicks: 1,
            adxExchangeLineItemLevelImpressions: 1,
            adxExchangeLineItemLevelAverageECPM: {
                $cond: [
                    { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                    {
                        $round: [
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            "$adxExchangeLineItemLevelRevenue",
                                            "$adxExchangeLineItemLevelImpressions",
                                        ],
                                    },
                                    1000,
                                ],
                            },
                            2,
                        ],
                    },
                    0,
                ],
            },
            adxExchangeLineItemLevelCtr: {
                $cond: [
                    { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                    {
                        $round: [
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            "$adxExchangeLineItemLevelClicks",
                                            "$adxExchangeLineItemLevelImpressions",
                                        ],
                                    },
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
                                $divide: [
                                    "$adxExchangeLineItemLevelRevenue",
                                    "$adxExchangeLineItemLevelClicks",
                                ],
                            },
                            2,
                        ],
                    },
                    0,
                ],
            },
        },
    });

    // ✅ FINAL facet pipeline
    return Schema.aggregate([
        ...pipeline,
        {
            $facet: {
                paginatedResults: [
                    { $sort: sortObj },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                ],
                totals: [
                    {
                        $group: {
                            _id: null,
                            adxExchangeLineItemLevelRevenue: {
                                $sum: "$adxExchangeLineItemLevelRevenue",
                            },
                            adxExchangeLineItemLevelClicks: {
                                $sum: "$adxExchangeLineItemLevelClicks",
                            },
                            adxExchangeLineItemLevelImpressions: {
                                $sum: "$adxExchangeLineItemLevelImpressions",
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            adxExchangeLineItemLevelRevenue: {
                                $round: ["$adxExchangeLineItemLevelRevenue", 2],
                            },
                            adxExchangeLineItemLevelClicks: 1,
                            adxExchangeLineItemLevelImpressions: 1,
                            adxExchangeLineItemLevelAverageECPM: {
                                $cond: [
                                    { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                    {
                                        $round: [
                                            {
                                                $multiply: [
                                                    {
                                                        $divide: [
                                                            "$adxExchangeLineItemLevelRevenue",
                                                            "$adxExchangeLineItemLevelImpressions",
                                                        ],
                                                    },
                                                    1000,
                                                ],
                                            },
                                            2,
                                        ],
                                    },
                                    0,
                                ],
                            },
                            adxExchangeLineItemLevelCtr: {
                                $cond: [
                                    { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
                                    {
                                        $round: [
                                            {
                                                $multiply: [
                                                    {
                                                        $divide: [
                                                            "$adxExchangeLineItemLevelClicks",
                                                            "$adxExchangeLineItemLevelImpressions",
                                                        ],
                                                    },
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
                                                $divide: [
                                                    "$adxExchangeLineItemLevelRevenue",
                                                    "$adxExchangeLineItemLevelClicks",
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
};



// const aggregateDefaultView = async (AdManagerRowsSchema, match, sortObj, page = 1, limit) => {
//     return AdManagerRowsSchema.aggregate([
//         { $match: match },
//         {
//             $facet: {
//                 paginatedResults: [
//                     { $sort: sortObj },
//                     { $skip: (page - 1) * limit },
//                     { $limit: limit },
//                     {
//                         $project: {
//                             _id: 0,
//                             reportDate: 1,
//                             site: 1,
//                             country: 1,
//                             adxExchangeLineItemLevelRevenue: { $round: [{ $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] }, 2] },
//                             adxExchangeLineItemLevelClicks: 1,
//                             adxExchangeLineItemLevelImpressions: 1,
//                             adxExchangeLineItemLevelAverageECPM: {
//                                 $cond: [
//                                     { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
//                                     { $round: [{ $multiply: [{ $divide: [{ $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] }, "$adxExchangeLineItemLevelImpressions"] }, 1000] }, 2] },
//                                     0,
//                                 ],
//                             },
//                             adxExchangeLineItemLevelCtr: {
//                                 $cond: [
//                                     { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
//                                     { $round: [{ $multiply: [{ $divide: ["$adxExchangeLineItemLevelClicks", "$adxExchangeLineItemLevelImpressions"] }, 100] }, 2] },
//                                     0,
//                                 ],
//                             },
//                             adxExchangeCostPerClick: {
//                                 $cond: [
//                                     { $gt: ["$adxExchangeLineItemLevelClicks", 0] },
//                                     { $round: [{ $divide: [{ $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] }, "$adxExchangeLineItemLevelClicks"] }, 2] },
//                                     0,
//                                 ],
//                             },
//                         },
//                     },
//                 ],
//                 totals: [
//                     {
//                         $group: {
//                             _id: null,
//                             adxExchangeLineItemLevelRevenue: { $sum: { $divide: ["$adxExchangeLineItemLevelRevenue", 1000000] } },
//                             adxExchangeLineItemLevelClicks: { $sum: "$adxExchangeLineItemLevelClicks" },
//                             adxExchangeLineItemLevelImpressions: { $sum: "$adxExchangeLineItemLevelImpressions" },
//                         },
//                     },
//                     {
//                         $project: {
//                             _id: 0,
//                             adxExchangeLineItemLevelRevenue: { $round: ["$adxExchangeLineItemLevelRevenue", 2] },
//                             adxExchangeLineItemLevelClicks: 1,
//                             adxExchangeLineItemLevelImpressions: 1,
//                             adxExchangeLineItemLevelAverageECPM: {
//                                 $cond: [
//                                     { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
//                                     { $round: [{ $multiply: [{ $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelImpressions"] }, 1000] }, 2] },
//                                     0,
//                                 ],
//                             },
//                             adxExchangeLineItemLevelCtr: {
//                                 $cond: [
//                                     { $gt: ["$adxExchangeLineItemLevelImpressions", 0] },
//                                     { $round: [{ $multiply: [{ $divide: ["$adxExchangeLineItemLevelClicks", "$adxExchangeLineItemLevelImpressions"] }, 100] }, 2] },
//                                     0,
//                                 ],
//                             },
//                             adxExchangeCostPerClick: {
//                                 $cond: [
//                                     { $gt: ["$adxExchangeLineItemLevelClicks", 0] },
//                                     { $round: [{ $divide: ["$adxExchangeLineItemLevelRevenue", "$adxExchangeLineItemLevelClicks"] }, 2] },
//                                     0,
//                                 ],
//                             },
//                         },
//                     },
//                 ],
//                 totalCount: [{ $count: "count" }],
//             },
//         },
//     ]);
// };
// ---------- Export ----------
module.exports = {
    aggregateSiteView,
    aggregateCountryView,
    aggregateDefaultView,
};
