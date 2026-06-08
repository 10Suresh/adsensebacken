const { google } = require("googleapis");
const soap = require("soap");
const { getFreshAccessToken, getAuthorizedClient } = require("../src/services/googleAuth")
const AdsenseRowSchema = require("../src/models/AdsenseRowSchema");
const REPORT_CONFIG = require("../config/reportConfig");
const { fetchAdManagerReportLast30Days, fetchAdManagerReportToday , fetchAdManagerReportYesterday} = require("../src/services/adManager/adxGoogleReport")
//adsens data fetch
async function fetchAndSaveReport2(userId, accountId) {
  try {
    const auth = await getAuthorizedClient(userId, accountId);
    const adsense = google.adsense("v2");

    const today = new Date();
    const startDateRaw = new Date(today);
    startDateRaw.setDate(today.getDate() - 365);

    const startDate = {
      year: startDateRaw.getFullYear(),
      month: startDateRaw.getMonth() + 1,
      day: startDateRaw.getDate(),
    };
    const endDate = {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    };
    const report = await adsense.accounts.reports.generate({
      account: `accounts/${accountId}`,
      auth,
      dateRange: "CUSTOM",
      "startDate.year": startDate.year,
      "startDate.month": startDate.month,
      "startDate.day": startDate.day,
      "endDate.year": endDate.year,
      "endDate.month": endDate.month,
      "endDate.day": endDate.day,
      metrics: REPORT_CONFIG.adsense.metrics,
      dimensions: REPORT_CONFIG.adsense.dimensions,
    });
    if (!report?.data?.rows || report.data.rows.length === 0) {
      console.warn(
        `[CRON] No rows returned for custom 60-day report (userId=${userId}, accountId=${accountId})`
      );
      return;
    }

    const bulkOps = report.data.rows.map((row) => {
      const [
        dateStr,
        domain,
        country,
        earnings,
        clicks,
        pageViews,
        impressions,
        ctr,
        cpc,
        rpm
      ] = row.cells.map((c) => c.value);

      return {
        updateOne: {
          filter: { userId, accountId, date: dateStr, domain, country },
          update: {
            $set: {
              metrics: {
                estimatedEarnings: parseFloat(earnings) || 0,
                clicks: parseInt(clicks) || 0,
                pageViews: parseInt(pageViews) || 0,
                impressions: parseInt(impressions) || 0,
                ctr: parseFloat(ctr) || 0,
                cpc: parseFloat(cpc) || 0,
                rpm: parseFloat(rpm) || 0,
              },
              fetchedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await AdsenseRowSchema.bulkWrite(bulkOps, { ordered: false });
      console.log(
        `[CRON] Saved ${bulkOps.length} AdSense rows for user ${userId}, account ${accountId}`
      );
    }
  } catch (err) {
    console.error(
      `[CRON ERROR] fetchAndSaveLast60DaysReport failed (userId=${userId}, accountId=${accountId}):`,
      err.message
    );
  }
}
async function fetchAndSaveReportYesterdayCron(userId, accountId) {
  try {
    const auth = await getAuthorizedClient(userId, accountId);
    const adsense = google.adsense("v2");

    const baseOptions = {
      auth,
      account: `accounts/${accountId}`,
      metrics: REPORT_CONFIG.adsense.metrics,
      dimensions: REPORT_CONFIG.adsense.dimensions,
    };

    // Get YESTERDAY's report
    const reportYesterday = await adsense.accounts.reports.generate({
      ...baseOptions,
      dateRange: "YESTERDAY",
    });

    if (!reportYesterday?.data?.rows || reportYesterday.data.rows.length === 0) {
      console.warn(
        `[CRON] No rows returned for YESTERDAY (userId=${userId}, accountId=${accountId})`
      );
      return;
    }
    const bulkOps = [];

    for (const row of reportYesterday.data.rows) {
      const [
        dateStr,
        domain,
        country,
        earnings,
        clicks,
        pageViews,
        impressions,
        ctr,
        cpc,
        rpm,
      ] = row.cells.map((c) => c.value);
      const date = dateStr;

      bulkOps.push({
        updateOne: {
          filter: { userId, accountId, date, domain, country },
          update: {
            $set: {
              metrics: {
                estimatedEarnings: parseFloat(earnings) || 0,
                clicks: parseInt(clicks) || 0,
                pageViews: parseInt(pageViews) || 0,
                impressions: parseInt(impressions) || 0,
                ctr: parseFloat(ctr) || 0,
                cpc: parseFloat(cpc) || 0,
                rpm: parseFloat(rpm) || 0,
              },
              fetchedAt: new Date(),
            },
          },
          upsert: true, //  will only insert new or update if changed
        },
      });
    }

    if (bulkOps.length > 0) {
      const result = await AdsenseRowSchema.bulkWrite(bulkOps, {
        ordered: false,
      });
      return {
        total: bulkOps.length,
        upserted: result?.upsertedCount || 0,
        modified: result?.modifiedCount || 0,
        inserted: result?.insertedCount || 0
      };
    }
    return { total: 0, upserted: 0, modified: 0, inserted: 0 };
  } catch (err) {
    console.error(
      `[CRON ERROR] fetchAndSaveReportYesterdayCron failed (userId=${userId}, accountId=${accountId}):`,
      err
    );
  }
}

async function fetchAndSaveReportCron(userId, accountId) {
  try {

    const auth = await getAuthorizedClient(userId, accountId);
    const adsense = google.adsense("v2");

    const baseOptions = {
      auth,
      account: `accounts/${accountId}`,
      metrics: REPORT_CONFIG.adsense.metrics,
      dimensions: REPORT_CONFIG.adsense.dimensions,
    };

    // Get TODAY’s report
    const reportToday = await adsense.accounts.reports.generate({
      ...baseOptions,
      dateRange: "TODAY",
    });

    if (!reportToday?.data?.rows || reportToday.data.rows.length === 0) {
      console.warn(
        `[CRON] No rows returned for TODAY (userId=${userId}, accountId=${accountId})`
      );
      return;
    }
    const bulkOps = [];

    for (const row of reportToday.data.rows) {

      const [
        dateStr,
        domain,
        country,
        earnings,
        clicks,
        pageViews,
        impressions,
        ctr,
        cpc,
        rpm,
      ] = row.cells.map((c) => c.value);
      const date = dateStr;

      bulkOps.push({
        updateOne: {
          filter: { userId, accountId, date, domain, country },
          update: {
            $set: {
              metrics: {
                estimatedEarnings: parseFloat(earnings) || 0,
                clicks: parseInt(clicks) || 0,
                pageViews: parseInt(pageViews) || 0,
                impressions: parseInt(impressions) || 0,
                ctr: parseFloat(ctr) || 0,
                cpc: parseFloat(cpc) || 0,
                rpm: parseFloat(rpm) || 0,
              },
              fetchedAt: new Date(),
            },
          },
          upsert: true, //  will only insert new or update if changed
        },
      });
    }

    if (bulkOps.length > 0) {
      const result = await AdsenseRowSchema.bulkWrite(bulkOps, {
        ordered: false,
      });
      return {
        total: bulkOps.length,
        upserted: result?.upsertedCount || 0,
        modified: result?.modifiedCount || 0,
        inserted: result?.insertedCount || 0
      };
    }
    return { total: 0, upserted: 0, modified: 0, inserted: 0 };
  } catch (err) {
    console.error(
      `[CRON ERROR] fetchAndSaveReportNew failed (userId=${userId}, accountId=${accountId}):`,
      err
    );
  }
}
//ad mangaer data fetch
async function fetchAdManagerReport(
  userId,
  networkId,
  accessToken,
  refreshToken
) {
  try {
    const bearer = await getFreshAccessToken(accessToken, refreshToken);

    const WSDL =
      "https://ads.google.com/apis/ads/publisher/v202505/ReportService?wsdl";
    const client = await soap.createClientAsync(WSDL);
    client.addHttpHeader("Authorization", `Bearer ${bearer}`);

    const NS = "https://www.google.com/apis/ads/publisher/v202505";
    client.addSoapHeader(`
      <tns:RequestHeader xmlns:tns="${NS}">
        <tns:networkCode>${networkId}</tns:networkCode>
        <tns:applicationName>DashboardApp</tns:applicationName>
      </tns:RequestHeader>
    `);

    // Helper to run report for a given dateRangeType
    await fetchAdManagerReportLast30Days(userId, bearer, networkId);
  } catch (error) {
    console.error(" Error in fetchAdManagerReports:", error);
  }
}
async function fetchAdManagerReportCron(
  userId,
  networkId,
  accessToken,
  refreshToken
) {
  try {
    const bearer = await getFreshAccessToken(accessToken, refreshToken);

    const WSDL =
      "https://ads.google.com/apis/ads/publisher/v202505/ReportService?wsdl";
    const client = await soap.createClientAsync(WSDL);
    client.addHttpHeader("Authorization", `Bearer ${bearer}`);

    const NS = "https://www.google.com/apis/ads/publisher/v202505";
    client.addSoapHeader(`
      <tns:RequestHeader xmlns:tns="${NS}">
        <tns:networkCode>${networkId}</tns:networkCode>
        <tns:applicationName>DashboardApp</tns:applicationName>
      </tns:RequestHeader>
    `);

    // Helper to run report for a given dateRangeType
    return await fetchAdManagerReportToday(userId, bearer, networkId);
  } catch (error) {
    console.error(" Error in fetchAdManagerReports:", error);
  }
}

async function fetchAdManagerReportYesterdayCron(
  userId,
  networkId,
  accessToken,
  refreshToken
) {
  try {
    const bearer = await getFreshAccessToken(accessToken, refreshToken);

    const WSDL =
      "https://ads.google.com/apis/ads/publisher/v202505/ReportService?wsdl";
    const client = await soap.createClientAsync(WSDL);
    client.addHttpHeader("Authorization", `Bearer ${bearer}`);

    const NS = "https://www.google.com/apis/ads/publisher/v202505";
    client.addSoapHeader(`
      <tns:RequestHeader xmlns:tns="${NS}">
        <tns:networkCode>${networkId}</tns:networkCode>
        <tns:applicationName>DashboardApp</tns:applicationName>
      </tns:RequestHeader>
    `);

    // Helper to run report for a given dateRangeType
    return await fetchAdManagerReportYesterday(userId, bearer, networkId);
  } catch (error) {
    console.error(" Error in fetchAdManagerReportYesterdayCron:", error);
  }
}

module.exports = {
  getAuthorizedClient,
  fetchAdManagerReport,
  fetchAndSaveReport2,
  fetchAndSaveReportCron,
  fetchAndSaveReportYesterdayCron,
  fetchAdManagerReportCron,
  fetchAdManagerReportYesterdayCron,
};
