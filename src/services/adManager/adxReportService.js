const { aggregateSiteView, aggregateCountryView,
    aggregateDefaultView } = require("../../helper/admanager/adxAggregation");
const { getDateFilter, getDatesArray } = require("../../../utils/dateFormate");
const { getAdxTotalSummary } = require("../../helper/admanager/adxTotalSummary")
async function getAdxReport(AdManagerRowsSchema, adxFilter, networkIds) {
    const { userId } = adxFilter;
    const sortKey = adxFilter.sortKey || "reportDate";
    const sortDirection = adxFilter.sortDirection === "desc" ? 1 : -1;
    const domain = adxFilter.domain;
    const countries = adxFilter?.country || [];
    let dateFilter = {};
    if (adxFilter.dateRange === "custom" && adxFilter.customRange) {
        const [startDate, endDate] = adxFilter.customRange;
        dateFilter.reportDate = { $in: getDatesArray(startDate, endDate) };
    } else if (adxFilter.dateRange) {
        dateFilter.reportDate = getDateFilter(adxFilter.dateRange);
    }

    const safeNetworkIds = (networkIds || []).filter(id => id && id !== "null");
    let match = {};
    if (Array.isArray(domain) && domain.length > 0) {
        match = {
            userId: userId,
            ...(safeNetworkIds.length ? { networkId: { $in: safeNetworkIds } } : {}),
            site: { $in: domain },
            ...dateFilter,
        };
    } else {
        match = { userId: "no-data-user" };
    }
    if (countries.length > 0) match.country = { $in: countries };
    const page = parseInt(adxFilter.page) || 1;
    const limit = parseInt(adxFilter.limit) || 50;
    const columnsArray = adxFilter?.column || [];

    const hasDomain = columnsArray.includes("site");
    const hasCountry = columnsArray.includes("country");
    const hasDate = columnsArray.includes("reportDate");
    const isSiteView = hasDomain && !hasCountry;
    const isCountryView = hasCountry && !hasDomain;

    // const sortObj = { [sortKey]: sortDirection };
    // const isSortingCountry = sortKey === "country";
    // const isSortingDomain = sortKey === "domain";
    // if ((isSortingCountry || isSortingDomain) && !sortObj["reportDate"]) {
    //     sortObj["reportDate"] = sortDirection;
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

    let baseFilter = {};
    if (Array.isArray(adxFilter.domain) && adxFilter.domain.length > 0) {
        baseFilter = {
            userId: userId,
            ...(Array.isArray(safeNetworkIds) && safeNetworkIds.length > 0 ? { networkId: { $in: safeNetworkIds } } : {}),
            site: { $in: adxFilter.domain },
            ...dateFilter
        };
    } else {
        baseFilter = { userId: "no-data-user" };
    }

    // 🔹 Aggregation call
    let result;
    if (isSiteView) {
        result = await aggregateSiteView(AdManagerRowsSchema, match, sortObj, page, limit, hasDate);
    } else if (isCountryView) {
        result = await aggregateCountryView(AdManagerRowsSchema, match, sortObj, page, limit);
    } else {
        result = await aggregateDefaultView(AdManagerRowsSchema, match, sortObj, page, limit, hasDate, hasDomain, hasCountry);
    }

    const revenueSummary = await getAdxTotalSummary(AdManagerRowsSchema, baseFilter);
    const listCountry = await AdManagerRowsSchema.aggregate([
        { $match: baseFilter },
        {
            $group: {
                _id: null,
                countries: { $addToSet: "$country" },
                totalCount: { $sum: 1 }
            }
        }
    ]);
    const reports = result[0]?.paginatedResults || [];
    console.group(reports,"reports")
    const rawTotals = result[0]?.totals[0] || {};
    const totalCount = result[0]?.totalCount[0]?.count || 0;
    if (adxFilter.dateRange === "today" || adxFilter.dateRange === "yesterday") {
        if (match.reportDate && match.reportDate.$in && match.reportDate.$in.length > 0) {
            rawTotals.reportDate = match.reportDate.$in[0];   // ✅ Single date from match
        } else {
            rawTotals.reportDate = null;
        }
    } else {
        rawTotals.reportDate = null;
    }
    return {
        total: totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
        count: reports.length,
        reports,
        totals: rawTotals,
        listCountry,
        revenueSummary
    };
}

module.exports = { getAdxReport };
