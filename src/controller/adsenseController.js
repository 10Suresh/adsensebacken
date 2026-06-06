const AdsenseRowSchema = require("../models/AdsenseRowSchema");
const { getDateFilter, getDatesArray } = require("../../utils/dateFormate");
const AdManagerRowsSchema = require("../models/AdManagerRowsSchema");
const { getAdManagerDashboardSites } = require("../helper/admanager/adManagerDashboardSites")
const { getAdsenseDashboardSites } = require("../helper/adSense/adSenseDashboardsites")
const { mergeSites, parseNestedFilter } = require("../../utils/dashboardUtils")
const { getAdsenseReport } = require("../services/adsenseService/adsenseReportService")
const { getAdxReport } = require("../services/adManager/adxReportService")
const {
  aggregateDomainView,
  aggregateCountryView,
  aggregateDefaultView, getRevenueSummary
} = require("../helper/adSense/adsenseAggregation");
const logger = require("../logger")


const getReports = async (req, res) => {
  const startTime = Date.now();
  try {
    // 📌 Pagination & Query Params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const columns = req.query.columns || "";
    const accountId = req.query.accountId;
    const countries = req.query.country
      ? req.query.country.split(",")
      : undefined;
    const domains = req.query.domain ? req.query.domain.split(",") : undefined;
    const dateRange = req.query.dateRange;
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const columnsArray = columns.split(",").map((c) => c.trim().toLowerCase());

    //
    const sortKey = req.query.sortKey || "date";

    // ✅ Correct mapping: desc = -1 (Mongo DESC)
    const sortDirection = req.query.sortDirection === "desc" ? 1 : -1;


    function buildSortObject(sortKey, sortDirection) {
      const sortObj = {};

      // ✅ If sorting by DATE
      if (sortKey === "date") {
        sortObj["date"] = sortDirection;
        sortObj["estimatedEarnings"] = 1;
        sortObj["clicks"] = 1;
        sortObj["pageViews"] = 1;
        sortObj["impressions"] = 1;
        sortObj["ctr"] = 1;
        sortObj["rpm"] = 1;
        sortObj["cpc"] = 1;

        // 3) At end domain/country if needed
        sortObj["domain"] = -1;
        sortObj["country"] = -1;

        return sortObj;
      }

      // ✅ If sorting by DOMAIN or COUNTRY
      // (normal behavior, same as before)
      sortObj[sortKey] = sortDirection;
      sortObj["date"] = -1;  // Latest date first
      return sortObj;
    }


    const sortObj = buildSortObject(sortKey, sortDirection);

    if (!accountId) {
      logger.warn({
        message: "accountId missing in getReports",
        userId: req.user?._id,
        query: req.query,
        route: "getReports",
      });
      return res.status(400).json({ error: "accountId is required" });
    }
    logger.info({
      message: "Fetching AdSense reports",
      userId: req.user._id,
      accountId,
      filters: { countries, domains, dateRange, startDate, endDate },
      pagination: { page, limit },
      sort: { sortKey, sortDirection },
    });
    // 📌 Projection for normal rows
    const projection = {};
    if (columns) {
      columns.split(",").forEach((col) => {
        if (
          [
            "date",
            "domain",
            "country",
            "userId",
            "_id",
            "accountId",
            "createdAt",
          ].includes(col)
        ) {
          projection[col] = 1;
        } else {
          projection[`metrics.${col}`] = 1;
        }
      });
    }

    // 📌 Date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date = { $in: getDatesArray(startDate, endDate) };
    } else if (dateRange) {
      dateFilter.date = getDateFilter(dateRange);
    }

    const allLists = await AdsenseRowSchema.aggregate([
      { $match: { accountId, userId: req.user._id, ...dateFilter } },
      {
        $group: {
          _id: null,
          allCountries: { $addToSet: "$country" },
          allDomains: { $addToSet: "$domain" },
        },
      },
    ]);

    const allCountries = (allLists[0]?.allCountries || []).sort();
    const allDomains = (allLists[0]?.allDomains || []).sort();

    // 📌 Main match
    const match = { accountId, userId: req.user._id, ...dateFilter };
    if (Array.isArray(countries) && countries.length > 0)
      match.country = { $in: countries };
    if (Array.isArray(domains) && domains.length > 0)
      match.domain = { $in: domains };

    // 📌 Grouping logic
    const hasDomain = columnsArray.includes("domain");
    const hasDate = columnsArray.includes("date");
    const hasCountry = columnsArray.includes("country");
    const isDomainView = hasDomain && !hasCountry;
    const isCountryView = hasCountry && !hasDomain;

    // 📌 Helper: dynamic sort

    const revenueSummary = await getRevenueSummary(AdsenseRowSchema, req.user._id, accountId);


    let result;

    if (isDomainView) {
      result = await aggregateDomainView(
        AdsenseRowSchema,
        match,
        sortObj,
        page,
        limit,
        hasDate
      );
    } else if (isCountryView) {
      result = await aggregateCountryView(AdsenseRowSchema, match, sortObj, page, limit, hasDate);

    } else {
      result = await aggregateDefaultView(
        AdsenseRowSchema,
        match,
        sortObj,
        projection,
        page,
        limit, hasDate, hasDomain, hasCountry
      );
    }
    // 📌 Format result
    const reports = result[0]?.paginatedResults || [];
    const totals = result[0]?.totals[0] || {
      estimatedEarnings: 0,
      clicks: 0,
      pageViews: 0,
      impressions: 0,
    };
    const totalCount = result[0]?.totalCount[0]?.count || 0;
    totals.ctr =
      totals.impressions > 0
        ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2))
        : 0;
    totals.cpc =
      totals.clicks > 0
        ? Number((totals.estimatedEarnings / totals.clicks).toFixed(2))
        : 0;
    if (req.query?.dateRange === "today" || req.query?.dateRange === "yesterday") {
      if (match.date && match.date.$in && match.date.$in.length > 0) {
        totals.date = match.date.$in[0];      // ✅ Single date return
      }
    }
    else {
      totals.date = null;
    }
    const durationMs = Date.now() - startTime;
    logger.info({
      message: "Reports fetched successfully",
      userId: req.user._id,
      accountId,
      reportsCount: reports.length,
      totalCount,
      totals,
      filtersApplied: { countries, domains, dateFilter },
      durationMs,
    });
    res.status(200).json({
      success: true,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      count: reports.length,
      reports,
      totals,
      allCountries,
      allDomains,
      revenueSummary
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logger.error({
      message: "Error fetching reports",
      userId: req.user?._id,
      error: err.message,
      stack: err.stack,
      route: "getReports",
      method: req.method,
      durationMs,
    });
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};
const getDashboardReport = async (req, res) => {
  try {
    const user = req.user;
    const userId = user._id;
    const adsenseFilter = parseNestedFilter(req.query, "adsenseFilter");
    const adxFilter = parseNestedFilter(req.query, "adxFilter");


    const [adManagerData, adsenseData] = await Promise.all([
      getAdManagerDashboardSites(user),
      getAdsenseDashboardSites(user),
    ]);
    const mergedAllSites = mergeSites(adsenseData, adManagerData);
    const accountIds = adsenseData.accountIds;
    const networkIds = adManagerData.networkIds;
    const startTime = Date.now();
    const [adsenseReport, adxReport] = await Promise.all([
      getAdsenseReport(AdsenseRowSchema, { ...adsenseFilter, userId: user._id }, accountIds),
      getAdxReport(AdManagerRowsSchema, { ...adxFilter, userId: userId }, networkIds)
    ]);
    const endTime = Date.now();
    console.log(`Execution time: ${endTime - startTime} ms`);
    res.status(200).json({
      adsenseReport,
      mergedAllSites,
      adxReport
    });
  } catch (err) {
    console.error("Error in getDashboardReport:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


module.exports = {
  getReports,
  getDashboardReport,
};
