const User = require("../models/User");
const AdManagerRowsSchema = require("../models/AdManagerRowsSchema");
const { getDateFilter, getDatesArray } = require("../../utils/dateFormate");
const normalizeTotals = require("../../utils/normalizeTotals.js")
const { aggregateSiteView, aggregateCountryView, aggregateDefaultView } = require("../helper/admanager/adxAggregation.js")
const logger = require("../logger");
const { getAdManagerRevenueSummary } = require("../helper/admanager/adxRevenueSummary.js")
const WebsiteSchema = require("../models/Website.js")
/**
 *  Get Ad Manager Accounts of user
 */
const getAdManagerAccounts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("adManagerAccounts");
    if (!user) {
      logger.warn({
        message: "Ad Manager accounts fetch failed - user not found",
        userId: req.user.id,
        route: "getAdManagerAccounts",
        method: req.method,
      });
      return res.status(404).json({ msg: "User not found" });
    }
    const accountsWithNetworkId = (user.adManagerAccounts || []).filter(
      (acc) => acc.networkId
    );
    logger.info({
      message: "Ad Manager accounts fetched successfully",
      userId: req.user.id,
      accountsCount: accountsWithNetworkId.length,
    });

    res.json(accountsWithNetworkId);
  } catch (err) {
    logger.error({
      message: "Error fetching Ad Manager accounts",
      userId: req.user?.id,
      error: err.message,
      stack: err.stack,
      route: "getAdManagerAccounts",
      method: req.method,
    }); res.status(500).json({ msg: "Server error fetching Ad Manager accounts" });
  }
};
/**
 *  Delete Ad Manager Account by networkId
 */
const deleteAdManagerAccount = async (req, res) => {
  const startTime = Date.now();
  try {
    const { networkId } = req.params;
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      const durationMs = Date.now() - startTime;
      logger.warn({
        message: "Delete failed - user not found",
        userId,
        networkId,
        route: "deleteAdManagerAccount",
        durationMs,
      });
      return res.status(404).json({ msg: "User not found" });
    }
    user.adManagerAccounts = user.adManagerAccounts.filter(
      (acc) => acc.networkId !== networkId
    );
    const deleteResult = await AdManagerRowsSchema.deleteMany({
      userId: userId,
      networkId: networkId,
    });
    const result = await WebsiteSchema.deleteMany({
      userId: userId.toString(),
      networkId: networkId,
      isAdsense: false,
    });
    await user.save();
    const durationMs = Date.now() - startTime;
    logger.info({
      message: "Ad Manager account deleted successfully",
      userId,
      networkId,
      route: "deleteAdManagerAccount",
      deletedReports: deleteResult.deletedCount,
      remainingAccounts: user.adManagerAccounts.length,
      durationMs,
    });
    res.json({
      success: true,
      message: "Ad Manager account and related rows deleted successfully",
      deletedReports: deleteResult.deletedCount,
      adManagerAccounts: user.adManagerAccounts,
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logger.error({
      message: "Error deleting Ad Manager account",
      userId: req.user?.id,
      error: err.message,
      stack: err.stack,
      route: "deleteAdManagerAccount",
      method: req.method,
      durationMs
    });
    res.status(500).json({ msg: "Server error deleting Ad Manager account" });
  }
};

const getAdManagerReport = async (req, res) => {
  const startTime = Date.now();
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const networkId = req.query.networkId;
    const columns = req.query["columns[]"]
      ? Array.isArray(req.query["columns[]"])
        ? req.query["columns[]"]
        : [req.query["columns[]"]]
      : req.query.columns
        ? req.query.columns.split(",")
        : [];
    const countries = req.query["country[]"]
      ? Array.isArray(req.query["country[]"])
        ? req.query["country[]"]
        : [req.query["country[]"]]
      : req.query.country
        ? req.query.country.split(",")
        : [];

    const sites = req.query["domain[]"]
      ? Array.isArray(req.query["domain[]"])
        ? req.query["domain[]"]
        : [req.query["domain[]"]]
      : req.query.site
        ? req.query.site.split(",")
        : [];
    const dateRange = req.query.dateRange || "today";
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const sortKey = req.query.sortKey || "reportDate";
    const sortDirection = req.query.sortDirection === "desc" ? 1 : -1;
    const userId = req.user._id;
    if (!userId || !networkId) {
      return res
        .status(400)
        .json({ error: "userId and networkId are required" });
    }
    // Date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.reportDate = { $in: getDatesArray(startDate, endDate) };
    } else if (dateRange) {
      dateFilter.reportDate = getDateFilter(dateRange);
    }

    // All countries/sites list
    const allLists = await AdManagerRowsSchema.aggregate([
      { $match: { userId, networkId, ...dateFilter } },
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

    // Main match
    const match = { userId, networkId, ...dateFilter };
    if (countries.length > 0) match.country = { $in: countries };
    if (sites.length > 0) match.site = { $in: sites };
    // Grouping logic
    const columnsArray = columns.map((c) => c.trim().toLowerCase());
    const hasSite = columnsArray.includes("site");
    const hasCountry = columnsArray.includes("country");
    const hasDate = columnsArray.includes("reportdate");
    const isSiteView = hasSite && !hasCountry;
    const isCountryView = hasCountry && !hasSite;
    // const sortObj = { [sortKey]: sortDirection };
    // const isSortingCountry = sortKey === "country";
    // const isSortingReportDate = sortKey === "reportdate";
    // const isSortingDomain = sortKey === "domain";
    // if ((isSortingCountry || isSortingDomain) && !sortObj["reportDate"]) {
    //   sortObj["reportDate"] = sortDirection;
    // }
    const sortObj = { [sortKey]: sortDirection };
    const isSortingCountry = sortKey === "country";
    const isSortingReportDate = sortKey === "reportdate";  // make sure key matches exactly
    const isSortingDomain = sortKey === "site";

    // ✅ 1) If sorting by COUNTRY or DOMAIN → then also sort by DATE
    if ((isSortingCountry || isSortingDomain) && sortObj["reportDate"] === undefined) {
      sortObj["reportDate"] = sortDirection;
    }

    // ✅ 2) If sorting by DATE → then also sort by DOMAIN (site)
    if (isSortingReportDate && sortObj["site"] === undefined) {
      sortObj["site"] = sortDirection;
    }

    let result;

    if (isSiteView) {
      result = await aggregateSiteView(AdManagerRowsSchema, match, sortObj, page, limit, hasDate);
    }
    else if (isCountryView) {
      result = await aggregateCountryView(AdManagerRowsSchema, match, sortObj, page, limit, hasDate);
    }
    else {
      result = await aggregateDefaultView(AdManagerRowsSchema, match, sortObj, page, limit, hasDate, hasSite, hasCountry);
    }
    const revenueSummary = await getAdManagerRevenueSummary(AdManagerRowsSchema, userId, networkId);

    const reports = result[0]?.paginatedResults || [];
    const totals = normalizeTotals(result);

    if (dateRange === "today" || dateRange === "yesterday") {
      if (match.reportDate && match.reportDate.$in && match.reportDate.$in.length > 0) {
        totals.reportDate = match.reportDate.$in[0];   // ✅ Single date from match
      } else {
        totals.reportDate = null;
      }
    } else {
      totals.reportDate = null;
    }
    const totalCount = result[0]?.totalCount[0]?.count || 0;
    logger.info({
      message: "Ad Manager report fetched successfully",
      userId,
      networkId,
      page,
      limit,
      totalReports: reports.length,
      route: "getAdManagerReport",
      durationMs: Date.now() - startTime,
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
      allSites,
      revenueSummary
    });
  } catch (err) {
    logger.error({
      message: "Error fetching Ad Manager report",
      userId: req.user?._id,
      error: err.message,
      stack: err.stack,
      route: "getAdManagerReport",
      method: req.method,
      durationMs: Date.now() - startTime,
    });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getSingleAdManagerAccountSites = async (req, res) => {
  const startTime = Date.now();
  try {
    const { networkId } = req.params;
    const userId = req.user.id;

    logger.info({
      message: "Fetch Ad Manager account sites requested",
      userId,
      networkId,
      route: "getSingleAdManagerAccountSites",
      method: req.method,
    });

    const user = await User.findById(userId);
    if (!user) {
      logger.warn({
        message: "User not found while fetching Ad Manager account sites",
        userId,
        networkId,
      });
      return res.status(404).json({ msg: "User not found" });
    }

    const account = user.adManagerAccounts.find(
      (acc) => acc.networkId === networkId
    );

    if (!account) {
      const durationMs = Date.now() - startTime;
      logger.warn({
        message: "Ad Manager account not found for user",
        userId,
        networkId,
        durationMs
      });
      return res.status(404).json({ msg: "Ad Manager account not found" });
    }

    const siteUrls = account.sites || [];
    const durationMs = Date.now() - startTime;
    logger.info({
      message: "Fetched Ad Manager account sites successfully",
      userId,
      networkId,
      siteCount: siteUrls.length,
      durationMs
    });

    res.json({ success: true, networkId, siteUrls });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logger.error({
      message: "Error fetching Ad Manager account sites",
      userId: req.user?.id,
      error: err.message,
      stack: err.stack,
      route: "getSingleAdManagerAccountSites",
      method: req.method,
      durationMs
    });
    res.status(500).json({ msg: "Server error fetching sites" });
  }
};
module.exports = {
  getAdManagerAccounts,
  deleteAdManagerAccount,
  getAdManagerReport,
  getSingleAdManagerAccountSites,
};
