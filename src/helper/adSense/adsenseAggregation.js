// adsenseAggregation.js
const { getDateFilter } = require("../../../utils/dateFormate")
// const aggregateDomainView = async (
//   AdsenseRowSchema,
//   match,
//   sortObj,
//   page,
//   limit,
//   includeDate
// ) => {
//   // Map nested metric keys to top-level fields after grouping
//   const mappedSortObj = {};
//   for (const key in sortObj) {
//     if (key.startsWith("metrics.")) {
//       mappedSortObj[key.replace("metrics.", "")] = sortObj[key];
//     } else {
//       mappedSortObj[key] = sortObj[key];
//     }
//   }

//   // Build _id dynamically
//   const groupId = { domain: "$domain" };
//   if (includeDate) groupId.date = "$date";

//   return AdsenseRowSchema.aggregate([
//     { $match: match },
//     {
//       $group: {
//         _id: groupId,
//         estimatedEarnings: { $sum: "$metrics.estimatedEarnings" },
//         clicks: { $sum: { $toInt: "$metrics.clicks" } },
//         pageViews: { $sum: { $toInt: "$metrics.pageViews" } },
//         impressions: { $sum: { $toInt: "$metrics.impressions" } },
//       },
//     },
//     {
//       $project: {
//         _id: 0,
//         domain: "$_id.domain",
//         date: includeDate ? "$_id.date" : undefined,
//         estimatedEarnings: 1,
//         clicks: 1,
//         pageViews: 1,
//         impressions: 1,
//         ctr: {
//           $cond: [
//             { $gt: ["$impressions", 0] },
//             { $round: [{ $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] }, 2] },
//             0,
//           ],
//         },
//         cpc: {
//           $cond: [
//             { $gt: ["$clicks", 0] },
//             { $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2] },
//             0,
//           ],
//         },
//       },
//     },
//     { $sort: mappedSortObj }, // ✅ use mapped top-level field keys
//     {
//       $facet: {
//         paginatedResults: [{ $skip: (page - 1) * limit }, { $limit: limit }],
//         totals: [
//           {
//             $group: {
//               _id: null,
//               estimatedEarnings: { $sum: "$estimatedEarnings" },
//               clicks: { $sum: "$clicks" },
//               pageViews: { $sum: "$pageViews" },
//               impressions: { $sum: "$impressions" },
//             },
//           },
//         ],
//         totalCount: [{ $count: "count" }],
//       },
//     },
//   ]);
// };
const aggregateDomainView = async (
  AdsenseRowSchema,
  match,
  sortObj,
  page = 1,
  limit = 50,
  includeDate
) => {
  // Map nested metric keys to top-level fields for sorting
  const mappedSortObj = {};
  for (const key in sortObj) {
    if (key.startsWith("metrics.")) {
      mappedSortObj[key.replace("metrics.", "")] = sortObj[key];
    } else {
      mappedSortObj[key] = sortObj[key];
    }
  }

  // Build dynamic group _id
  const groupId = { domain: "$domain" };
  if (includeDate) groupId.date = "$date";

  return AdsenseRowSchema.aggregate([
    { $match: match },
    {
      $group: {
        _id: groupId,
        estimatedEarnings: { $sum: { $toDouble: "$metrics.estimatedEarnings" } },
        clicks: { $sum: { $toInt: "$metrics.clicks" } },
        pageViews: { $sum: { $toInt: "$metrics.pageViews" } },
        impressions: { $sum: { $toInt: "$metrics.impressions" } },
      },
    },
    {
      $project: {
        _id: 0,
        domain: "$_id.domain",
        ...(includeDate ? { date: "$_id.date" } : {}),
        estimatedEarnings: { $round: ["$estimatedEarnings", 2] },
        clicks: 1,
        pageViews: 1,
        impressions: 1,
        ctr: {
          $cond: [
            { $gt: ["$impressions", 0] },
            {
              $round: [
                { $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] },
                2,
              ],
            },
            0,
          ],
        },
        cpc: {
          $cond: [
            { $gt: ["$clicks", 0] },
            {
              $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2],
            },
            0,
          ],
        },
        rpm: {
          $cond: [
            { $gt: ["$pageViews", 0] },
            {
              $round: [
                { $multiply: [{ $divide: ["$estimatedEarnings", "$pageViews"] }, 1000] },
                2,
              ],
            },
            0,
          ],
        },
      },
    },
    { $sort: mappedSortObj },
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
              estimatedEarnings: { $sum: "$estimatedEarnings" },
              clicks: { $sum: "$clicks" },
              pageViews: { $sum: "$pageViews" },
              impressions: { $sum: "$impressions" },
            },
          },
          {
            $project: {
              _id: 0,
              estimatedEarnings: { $round: ["$estimatedEarnings", 2] },
              clicks: 1,
              pageViews: 1,
              impressions: 1,
              ctr: {
                $cond: [
                  { $gt: ["$impressions", 0] },
                  {
                    $round: [
                      { $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] },
                      2,
                    ],
                  },
                  0,
                ],
              },
              cpc: {
                $cond: [
                  { $gt: ["$clicks", 0] },
                  {
                    $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2],
                  },
                  0,
                ],
              },
              rpm: {
                $cond: [
                  { $gt: ["$pageViews", 0] },
                  {
                    $round: [
                      { $multiply: [{ $divide: ["$estimatedEarnings", "$pageViews"] }, 1000] },
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

const aggregateCountryView = async (AdsenseRowSchema, match, sortObj, page, limit, includeDate) => {
  // ✅ Normalize Sort Object (No change needed)
  const normalizeSortObj = (sortObj, includeDate) => {
    const allowedFields = [
      "estimatedEarnings", "clicks", "pageViews", "impressions",
      "ctr", "cpc", "rpm", "country"
    ];
    if (includeDate) allowedFields.push("date");

    const finalSort = {};
    for (const key in sortObj) {
      const cleanKey = key.startsWith("metrics.") ? key.replace("metrics.", "") : key;
      if (allowedFields.includes(cleanKey)) {
        finalSort[cleanKey] = sortObj[key];
      }
    }

    if (Object.keys(finalSort).length === 0) {
      finalSort[includeDate ? "date" : "country"] = -1;
    }

    return finalSort;
  };

  const finalSort = normalizeSortObj(sortObj, includeDate);
  console.log(finalSort, "✅ finalSort");

  return AdsenseRowSchema.aggregate([
    { $match: match },

    // ✅ IMPORTANT: SORT BEFORE GROUP
    // This ensures that inside each date, the country/domain is also sorted correctly
    { $sort: finalSort },

    // ✅ GROUP (AFTER sorting to preserve correct internal order)
    {
      $group: {
        _id: includeDate
          ? { country: "$country", date: "$date" }
          : { country: "$country" },
        estimatedEarnings: { $sum: { $toDouble: "$metrics.estimatedEarnings" } },
        clicks:           { $sum: { $toInt: "$metrics.clicks" } },
        pageViews:        { $sum: { $toInt: "$metrics.pageViews" } },
        impressions:      { $sum: { $toInt: "$metrics.impressions" } },
      },
    },

    // ✅ PROJECT
    {
      $project: {
        _id: 0,
        country: "$_id.country",
        date: includeDate ? "$_id.date" : null,
        estimatedEarnings: 1,
        clicks: 1,
        pageViews: 1,
        impressions: 1,
        ctr: {
          $cond: [
            { $gt: ["$impressions", 0] },
            { $round: [{ $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] }, 2] },
            0,
          ],
        },
        cpc: {
          $cond: [
            { $gt: ["$clicks", 0] },
            { $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2] },
            0,
          ],
        },
        rpm: {
          $cond: [
            { $gt: ["$pageViews", 0] },
            { $round: [{ $multiply: [{ $divide: ["$estimatedEarnings", "$pageViews"] }, 1000] }, 2] },
            0,
          ],
        },
      },
    },

    // ✅ FINAL SORT AGAIN (Optional if projection affects sorting)
    { $sort: finalSort },

    // ✅ PAGINATION + TOTALS
    {
      $facet: {
        paginatedResults: [
          { $skip: (page - 1) * limit },
          { $limit: limit }
        ],
        totals: [
          {
            $group: {
              _id: null,
              estimatedEarnings: { $sum: "$estimatedEarnings" },
              clicks:            { $sum: "$clicks" },
              pageViews:         { $sum: "$pageViews" },
              impressions:       { $sum: "$impressions" },
            },
          },
          {
            $project: {
              _id: 0,
              estimatedEarnings: { $round: ["$estimatedEarnings", 2] },
              clicks: 1,
              pageViews: 1,
              impressions: 1,
              ctr: {
                $cond: [
                  { $gt: ["$impressions", 0] },
                  { $round: [{ $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] }, 2] },
                  0,
                ],
              },
              cpc: {
                $cond: [
                  { $gt: ["$clicks", 0] },
                  { $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2] },
                  0,
                ],
              },
              rpm: {
                $cond: [
                  { $gt: ["$pageViews", 0] },
                  { $round: [{ $multiply: [{ $divide: ["$estimatedEarnings", "$pageViews"] }, 1000] }, 2] },
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



// const aggregateCountryView = async (AdsenseRowSchema, match, sortObj, page, limit, includeDate) => {
// console.log(sortObj,"sortObjsortObj")
//   return AdsenseRowSchema.aggregate([
//     { $match: match },

//     // ✅ Group
//     {
//       $group: {
//         _id: includeDate
//           ? { country: "$country", date: "$date" }
//           : { country: "$country" },
//         estimatedEarnings: { $sum: { $toDouble: "$metrics.estimatedEarnings" } },
//         clicks: { $sum: { $toInt: "$metrics.clicks" } },
//         pageViews: { $sum: { $toInt: "$metrics.pageViews" } },
//         impressions: { $sum: { $toInt: "$metrics.impressions" } },
//       },
//     },

//     // ✅ Project
//     {
//       $project: {
//         _id: 0,
//         country: "$_id.country",
//         date: includeDate ? "$_id.date" : null,  // ✅ always define explicitly
//         estimatedEarnings: 1,
//         clicks: 1,
//         pageViews: 1,
//         impressions: 1,
//         ctr: {
//           $cond: [
//             { $gt: ["$impressions", 0] },
//             { $round: [{ $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] }, 2] },
//             0,
//           ],
//         },
//         cpc: {
//           $cond: [
//             { $gt: ["$clicks", 0] },
//             { $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2] },
//             0,
//           ],
//         },
//         rpm: {
//           $cond: [
//             { $gt: ["$pageViews", 0] },
//             { $round: [{ $multiply: [{ $divide: ["$estimatedEarnings", "$pageViews"] }, 1000] }, 2] },
//             0,
//           ],
//         },
//       },
//     },

//     { $sort: sortObj },

//     {
//       $facet: {
//         paginatedResults: [{ $skip: (page - 1) * limit }, { $limit: limit }],
//         totals: [
//           {
//             $group: {
//               _id: null,
//               estimatedEarnings: { $sum: "$estimatedEarnings" },
//               clicks: { $sum: "$clicks" },
//               pageViews: { $sum: "$pageViews" },
//               impressions: { $sum: "$impressions" },
//             },
//           },
//           {
//             $project: {
//               _id: 0,
//               estimatedEarnings: { $round: ["$estimatedEarnings", 2] },
//               clicks: 1,
//               pageViews: 1,
//               impressions: 1,
//               ctr: {
//                 $cond: [
//                   { $gt: ["$impressions", 0] },
//                   { $round: [{ $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] }, 2] },
//                   0,
//                 ],
//               },
//               cpc: {
//                 $cond: [
//                   { $gt: ["$clicks", 0] },
//                   { $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2] },
//                   0,
//                 ],
//               },
//               rpm: {
//                 $cond: [
//                   { $gt: ["$pageViews", 0] },
//                   { $round: [{ $multiply: [{ $divide: ["$estimatedEarnings", "$pageViews"] }, 1000] }, 2] },
//                   0,
//                 ],
//               },
//             },
//           },
//         ],
//         totalCount: [{ $count: "count" }],
//       },
//     },
//   ]);
// };
const aggregateDefaultView = async (
  AdsenseRowSchema,
  match,
  sortObj,
  projection,
  page = 1,
  limit = 50,
  hasDate,
  hasDomain,
  hasCountry
) => {
  // ✅ Determine Grouping Key
  let groupId;
  if (hasDate && !hasDomain && !hasCountry) {
    groupId = "$date";
  } else if (!hasDomain && !hasCountry) {
    groupId = "$date";
  } else if (hasDomain && !hasCountry) {
    groupId = "$domain";
  } else if (!hasDomain && hasCountry) {
    groupId = "$country";
  } else if (hasDate && hasDomain && hasCountry) {
    groupId = { date: "$date", domain: "$domain", country: "$country" };
  } else if (hasDomain && hasCountry) {
    groupId = { domain: "$domain", country: "$country" };
  } else if (hasDate && hasCountry) {
    groupId = { date: "$date", country: "$country" };
  }

  const pipeline = [{ $match: match }];

  // ✅ GROUP Stage
  pipeline.push({
    $group: {
      _id: groupId,
      estimatedEarnings: { $sum: { $toDouble: "$metrics.estimatedEarnings" } },
      clicks: { $sum: { $toInt: "$metrics.clicks" } },
      pageViews: { $sum: { $toInt: "$metrics.pageViews" } },
      impressions: { $sum: { $toInt: "$metrics.impressions" } },
    },
  });

  // ✅ PROJECT Stage
  const projectStage = {
    _id: 0,
    estimatedEarnings: { $round: ["$estimatedEarnings", 2] },
    clicks: 1,
    pageViews: 1,
    impressions: 1,
    ctr: {
      $cond: [
        { $gt: ["$impressions", 0] },
        {
          $round: [
            { $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] },
            2,
          ],
        },
        0,
      ],
    },
    rpm: {
      $cond: [
        { $gt: ["$pageViews", 0] },
        {
          $round: [
            {
              $multiply: [
                { $divide: ["$estimatedEarnings", "$pageViews"] },
                1000,
              ],
            },
            2,
          ],
        },
        0,
      ],
    },
    cpc: {
      $cond: [
        { $gt: ["$clicks", 0] },
        { $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2] },
        0,
      ],
    },
  };

  // ✅ Add output fields based on grouping
  if (hasDate && !hasDomain && !hasCountry) {
    projectStage.date = "$_id";
  } else if (!hasDomain && !hasCountry) {
    projectStage.date = "$_id";
  } else if (hasDomain && !hasCountry) {
    projectStage.domain = "$_id";
  } else if (!hasDomain && hasCountry) {
    projectStage.country = "$_id";
  } else if (hasDate && hasDomain && hasCountry) {
    projectStage.date = "$_id.date";
    projectStage.domain = "$_id.domain";
    projectStage.country = "$_id.country";
  } else {
    projectStage.domain = "$_id.domain";
    projectStage.country = "$_id.country";
  }

  pipeline.push({ $project: projectStage });

  // ✅ Normalize sort keys
const normalizeSortObj = (sortObj) => {
  const newSort = {};

  for (const key in sortObj) {
    const direction = sortObj[key];
    if (key.startsWith("metrics.")) {
      const cleanKey = key.replace("metrics.", "");
      newSort[cleanKey] = direction;
    } else {
      newSort[key] = direction;
    }
  }

  // ✅ Add date if sorting by country or domain
  const direction = newSort.country ?? newSort.domain;
  if (direction !== undefined && newSort.date === undefined) {
    newSort.date = direction;
  }

  return newSort;
};

const finalSort = normalizeSortObj(sortObj);

// ✅ Filter sort keys based on grouping
const validSort = {};
const allowedKeys = ["estimatedEarnings", "clicks", "pageViews", "impressions", "ctr", "rpm", "cpc"];
if (hasDate) allowedKeys.push("date");
if (hasDomain) allowedKeys.push("domain");
if (hasCountry) allowedKeys.push("country");

for (const key in finalSort) {
  if (allowedKeys.includes(key)) {
    validSort[key] = finalSort[key];
  }
}

  pipeline.push({ $sort: validSort });

  // ✅ Final Aggregation with Facet
  return AdsenseRowSchema.aggregate([
    ...pipeline,
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
              estimatedEarnings: { $sum: "$estimatedEarnings" },
              clicks: { $sum: "$clicks" },
              pageViews: { $sum: "$pageViews" },
              impressions: { $sum: "$impressions" },
            },
          },
          {
            $project: {
              _id: 0,
              estimatedEarnings: { $round: ["$estimatedEarnings", 2] },
              clicks: 1,
              pageViews: 1,
              impressions: 1,
              ctr: {
                $cond: [
                  { $gt: ["$impressions", 0] },
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: ["$clicks", "$impressions"] },
                          100,
                        ],
                      },
                      2,
                    ],
                  },
                  0,
                ],
              },
              rpm: {
                $cond: [
                  { $gt: ["$pageViews", 0] },
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: ["$estimatedEarnings", "$pageViews"] },
                          1000,
                        ],
                      },
                      2,
                    ],
                  },
                  0,
                ],
              },
              cpc: {
                $cond: [
                  { $gt: ["$clicks", 0] },
                  { $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2] },
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

// const aggregateDefaultView = async (
//   AdsenseRowSchema,
//   match,
//   sortObj,
//   projection,
//   page = 1,
//   limit = 50,
//   hasDate,
//   hasDomain,
//   hasCountry
// ) => {
//   // ✅ Determine Grouping Key

//   let groupId;
//   if (hasDate && !hasDomain && !hasCountry) {
//     groupId = "$date";  // ✅ Date wise
//   }
//   else if (!hasDomain && !hasCountry) {
//     groupId = "$date";  // ✅ Default also date
//   }
//   else if (hasDomain && !hasCountry) {
//     groupId = "$domain";
//   }
//   else if (!hasDomain && hasCountry) {
//     groupId = "$country";
//   }
//   else if (hasDomain && hasCountry && hasDate) {
//     groupId = { date: "$date", domain: "$domain", country: "$country" };
//   }
//   else if (hasDomain && hasCountry) {
//     groupId = { domain: "$domain", country: "$country" };
//   }
//   else if (hasDate && hasCountry) {
//     groupId = { date: "$date", country: "$country" };
//   }

//   const pipeline = [{ $match: match }];
//   // ✅ GROUP Stage
//   pipeline.push({
//     $group: {
//       _id: groupId,
//       estimatedEarnings: { $sum: { $toDouble: "$metrics.estimatedEarnings" } },
//       clicks: { $sum: { $toInt: "$metrics.clicks" } },
//       pageViews: { $sum: { $toInt: "$metrics.pageViews" } },
//       impressions: { $sum: { $toInt: "$metrics.impressions" } },
//     },
//   });

//   // ✅ PROJECT Stage
//   const projectStage = {
//     _id: 0,
//     estimatedEarnings: { $round: ["$estimatedEarnings", 2] },
//     clicks: 1,
//     pageViews: 1,
//     impressions: 1,
//     ctr: {
//       $cond: [
//         { $gt: ["$impressions", 0] },
//         {
//           $round: [
//             { $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] },
//             2,
//           ],
//         },
//         0,
//       ],
//     },
//     rpm: {
//       $cond: [
//         { $gt: ["$pageViews", 0] },
//         {
//           $round: [
//             {
//               $multiply: [
//                 { $divide: ["$estimatedEarnings", "$pageViews"] },
//                 1000,
//               ],
//             },
//             2,
//           ],
//         },
//         0,
//       ],
//     },
//     cpc: {
//       $cond: [
//         { $gt: ["$clicks", 0] },
//         { $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2] },
//         0,
//       ],
//     },
//   };

//   // ✅ Add output fields based on grouping
//   if (hasDate && !hasDomain && !hasCountry) {
//     projectStage.date = "$_id";
//   } else if (!hasDomain && !hasCountry) {
//     projectStage.date = "$_id";
//   } else if (hasDomain && !hasCountry) {
//     projectStage.domain = "$_id";
//   } else if (!hasDomain && hasCountry) {
//     projectStage.country = "$_id";
//   } else if (hasDate && hasDomain && hasCountry) {
//     projectStage.date = "$_id.date";
//     projectStage.domain = "$_id.domain";
//     projectStage.country = "$_id.country";
//   } else {
//     projectStage.domain = "$_id.domain";
//     projectStage.country = "$_id.country";
//   }

//   pipeline.push({ $project: projectStage });

 
//   pipeline.push({ $sort: sortObj });
//   console.log(pipeline, "pipeline")

//   return AdsenseRowSchema.aggregate([
//     ...pipeline,
//     {
//       $facet: {
//         paginatedResults: [
//           { $skip: (page - 1) * limit },
//           { $limit: limit },
//         ],
//         totals: [
//           {
//             $group: {
//               _id: null,
//               estimatedEarnings: { $sum: "$estimatedEarnings" },
//               clicks: { $sum: "$clicks" },
//               pageViews: { $sum: "$pageViews" },
//               impressions: { $sum: "$impressions" },
//             },
//           },
//           {
//             $project: {
//               _id: 0,
//               estimatedEarnings: { $round: ["$estimatedEarnings", 2] },
//               clicks: 1,
//               pageViews: 1,
//               impressions: 1,
//               ctr: {
//                 $cond: [
//                   { $gt: ["$impressions", 0] },
//                   {
//                     $round: [
//                       {
//                         $multiply: [
//                           { $divide: ["$clicks", "$impressions"] },
//                           100,
//                         ],
//                       },
//                       2,
//                     ],
//                   },
//                   0,
//                 ],
//               },
//               rpm: {
//                 $cond: [
//                   { $gt: ["$pageViews", 0] },
//                   {
//                     $round: [
//                       {
//                         $multiply: [
//                           { $divide: ["$estimatedEarnings", "$pageViews"] },
//                           1000,
//                         ],
//                       },
//                       2,
//                     ],
//                   },
//                   0,
//                 ],
//               },
//               cpc: {
//                 $cond: [
//                   { $gt: ["$clicks", 0] },
//                   { $round: [{ $divide: ["$estimatedEarnings", "$clicks"] }, 2] },
//                   0,
//                 ],
//               },
//             },
//           },
//         ],
//         totalCount: [{ $count: "count" }],
//       },
//     },
//   ]);
// };
const getRevenueSummary = async (AdsenseRowSchema, userId, accountId) => {
  if (!accountId) {
    return { error: "accountId is required" };
  }

  // ✅ Get filters using your function
  const todayFilter = getDateFilter("today");        // { $in: [...] }
  const yesterdayFilter = getDateFilter("yesterday");
  const last7Filter = getDateFilter("last7");
  const thisMonthFilter = getDateFilter("thisMonth");

  // ✅ Use in $facet
  const result = await AdsenseRowSchema.aggregate([
    { $match: { userId, accountId } },
    {
      $facet: {
        today: [
          { $match: { date: todayFilter } },   // ✅ directly pass filter
          { $group: { _id: null, revenue: { $sum: "$metrics.estimatedEarnings" } } },
        ],
        yesterday: [
          { $match: { date: yesterdayFilter } },
          { $group: { _id: null, revenue: { $sum: "$metrics.estimatedEarnings" } } },
        ],
        last7Days: [
          { $match: { date: last7Filter } },
          { $group: { _id: null, revenue: { $sum: "$metrics.estimatedEarnings" } } },
        ],
        thisMonth: [
          { $match: { date: thisMonthFilter } },
          { $group: { _id: null, revenue: { $sum: "$metrics.estimatedEarnings" } } },
        ],
      },
    },
  ]);

  // ✅ return object (not res.json)
  return {
    success: true,
    today: result[0].today[0]?.revenue || 0,
    yesterday: result[0].yesterday[0]?.revenue || 0,
    last7Days: result[0].last7Days[0]?.revenue || 0,
    thisMonth: result[0].thisMonth[0]?.revenue || 0,
  };
};


module.exports = { aggregateDomainView, aggregateCountryView, aggregateDefaultView, getRevenueSummary };
