// adsenseReportService.js
const { getDateFilter, getDatesArray } = require("../../../utils/dateFormate")
const { getAdsRevenueSummary } = require("../../helper/adSense/summaryAggregation")
const {
  aggregateDomainView,
  aggregateCountryView,
  aggregateDefaultView,
} = require("../../helper/adSense/adsenseAggregation"); // the aggregation helpers we made before
/**
 * Get Adsense Report
 * @param {Object} AdsenseRowSchema - Mongoose model
 * @param {Object} adsenseFilter - Filter from frontend
 * @param {Array} accountIds - User's Adsense account IDs
 */

async function getAdsenseReport(AdsenseRowSchema, adsenseFilter, accountIds) {
  const metricsFields = ["estimatedEarnings", "clicks", "impressions", "pageViews", "cpc", "ctr"];
  const columnsArray = adsenseFilter?.column || [];
  const hasDomain = columnsArray.includes("domain");
  const hasCountry = columnsArray.includes("country");
  const includeDate = columnsArray.includes("date");

  const isDomainView = hasDomain && !hasCountry;
  const isCountryView = hasCountry && !hasDomain;
  const page = parseInt(adsenseFilter.page) || 1;
  const limit = parseInt(adsenseFilter.limit) || 50;
  let sortKey = adsenseFilter.sortKey || "date";
  let sortDirection = adsenseFilter.sortDirection === "desc" ? 1 : -1;
  if (metricsFields.includes(sortKey)) sortKey = "metrics." + sortKey;
  const sortObj = { [sortKey]: sortDirection };
  // const isSortingCountry = sortKey === "country";
  // const isSortingDomain = sortKey === "domain";
  // if ((isSortingCountry || isSortingDomain) && !sortObj["date"]) {
  //   sortObj["date"] = sortDirection;
  // }

const isSortingCountry = sortKey === "country";
const isSortingDomain  = sortKey === "domain";
const isSortingDate    = sortKey === "date"; // ✅ important

// ✅ 1) If sorting COUNTRY or DOMAIN → also sort by DATE
if ((isSortingCountry || isSortingDomain) && sortObj["date"] === undefined) {
  sortObj["date"] = sortDirection;
}

// ✅ 2) If sorting DATE → also sort by DOMAIN (or site/name)
if (isSortingDate && sortObj["domain"] === undefined) {
  sortObj["domain"] = sortDirection;  // change to "site" or "name" if needed
}

  // Projection
  const projection = {};
  if (adsenseFilter.columns) {
    adsenseFilter.columns.split(",").forEach(col => {
      if (["_id", "date", "domain", "country", "userId", "accountId", "createdAt"].includes(col))
        projection[col] = 1;
      else if (metricsFields.includes(col))
        projection["metrics." + col] = 1;
    });
  } else {
    ["_id", "date", "domain", "country", "accountId", "createdAt"].forEach(c => projection[c] = 1);
    metricsFields.forEach(m => projection["metrics." + m] = 1);
  }

  let dateFilter = {};

  if (adsenseFilter.dateRange === "custom" && adsenseFilter.customRange) {
    const [startDate, endDate] = adsenseFilter.customRange;
    dateFilter.date = { $in: getDatesArray(startDate, endDate) };
  } else if (adsenseFilter.dateRange) {
    dateFilter.date = getDateFilter(adsenseFilter.dateRange);
  }
  let baseFilter = {};
  if (Array.isArray(adsenseFilter.domain) && adsenseFilter.domain.length > 0) {
    baseFilter = {
      userId: adsenseFilter.userId,
      ...(Array.isArray(accountIds) && accountIds.length > 0 ? { accountId: { $in: accountIds } } : {}),
      domain: { $in: adsenseFilter.domain },
      ...dateFilter
    };
  } else {
    baseFilter = { userId: "no-data-user" };
  }
  let match = {};

  if (Array.isArray(adsenseFilter.domain) && adsenseFilter.domain.length > 0) {
    match = {
      userId: adsenseFilter.userId,
      ...(Array.isArray(accountIds) && accountIds.length > 0
        ? { accountId: { $in: accountIds } }
        : {}),
      domain: { $in: adsenseFilter.domain },
      ...dateFilter,
      ...(Array.isArray(adsenseFilter.country) && adsenseFilter.country.length > 0
        ? { country: { $in: adsenseFilter.country } }
        : {}),
    };
  } else {
    match = { userId: "no-data-user" };
  }

  const listCountry = await AdsenseRowSchema.aggregate([
    { $match: baseFilter },
    {
      $group: {
        _id: null,
        countries: { $addToSet: "$country" },
        totalCount: { $sum: 1 }
      }
    }
  ]);
  // Aggregate based on view type
  let result;
  if (isDomainView) {
    result = await aggregateDomainView(AdsenseRowSchema, match, sortObj, page, limit, includeDate);
  } else if (isCountryView) {
    result = await aggregateCountryView(AdsenseRowSchema, match, sortObj, page, limit, includeDate);
  } else {
    result = await aggregateDefaultView(AdsenseRowSchema, match, sortObj, projection, page, limit, includeDate, hasDomain, hasCountry);
  }
  const revenueSummary = await getAdsRevenueSummary(AdsenseRowSchema, baseFilter);

  // Safe extract
  const safeResult = Array.isArray(result) && result.length > 0 ? result : [{}];
  const paginatedResults = safeResult[0]?.paginatedResults || [];
  const totalsData = safeResult[0]?.totals?.[0] || { estimatedEarnings: 0, clicks: 0, impressions: 0, pageViews: 0 };
  totalsData.ctr = totalsData.impressions > 0 ? +(totalsData.clicks / totalsData.impressions * 100).toFixed(2) : 0;
  totalsData.cpc = totalsData.clicks > 0 ? +(totalsData.estimatedEarnings / totalsData.clicks).toFixed(2) : 0;
  // dateRange = today OR yesterday ⇒ use match.date.$in
  if (adsenseFilter.dateRange === "today" || adsenseFilter.dateRange === "yesterday") {
    if (match.date && match.date.$in && match.date.$in.length > 0) {
      totalsData.date = match.date.$in[0];      // ✅ Single date return
    }
  }
  else {
    totalsData.date = null;
  }
  const totalCount = safeResult[0]?.totalCount?.[0]?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  return { listCountry, paginatedResults, totalsData, totalCount, page, totalPages,
    revenueSummary
   };
}

module.exports = { getAdsenseReport };
