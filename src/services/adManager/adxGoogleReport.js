const adManagerReportSchema = require("../../models/AdManagerRowsSchema")
const soap = require("soap");
const csvParser = require("csv-parser");
const zlib = require("zlib");
const axios = require("axios");
async function fetchAdManagerReportLast30Days(userId, bearer, networkId) {
    try {
        const WSDL =
            "https://ads.google.com/apis/ads/publisher/v202505/ReportService?wsdl";
        const client = await soap.createClientAsync(WSDL);
        client.addHttpHeader("Authorization", `Bearer ${bearer}`);

        const NS = "https://www.google.com/apis/ads/publisher/v202505";
        client.addSoapHeader(`
      <tns:RequestHeader xmlns:tns="${NS}">
        <tns:networkCode>${networkId}</tns:networkCode>
        <tns:applicationName>DashboardApp-Prod</tns:applicationName>
      </tns:RequestHeader>
    `);

        // ✅ Safe float parser
        const parseFloatSafe = (val) => {
            if (!val || val === "--") return 0;
            return parseFloat(val.toString().replace(/,/g, "")) || 0;
        };

        // ✅ Calculate 30-day custom range
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 60);

        const toGAMDate = (d) => ({
            year: d.getUTCFullYear(),
            month: d.getUTCMonth() + 1,
            day: d.getUTCDate(),
        });

        // ✅ Step 1: Define report query
        const reportQuery = {
            dimensions: ["DATE", "SITE_NAME", "COUNTRY_NAME"],
            columns: [
                "AD_EXCHANGE_LINE_ITEM_LEVEL_IMPRESSIONS",
                "AD_EXCHANGE_LINE_ITEM_LEVEL_CLICKS",
                "AD_EXCHANGE_LINE_ITEM_LEVEL_REVENUE",
                "AD_EXCHANGE_LINE_ITEM_LEVEL_AVERAGE_ECPM",
                "AD_EXCHANGE_LINE_ITEM_LEVEL_CTR",
                "AD_EXCHANGE_COST_PER_CLICK",
            ],
            startDate: toGAMDate(startDate),
            endDate: toGAMDate(today),
            dateRangeType: "CUSTOM_DATE",
            reportCurrency: "USD",
            timeZoneType: "PUBLISHER",
        };

        // ✅ Step 2: Run report job
        const [jobResult] = await client.runReportJobAsync({
            reportJob: { reportQuery },
        });
        const jobId = jobResult?.rval?.id;
        if (!jobId) throw new Error("❌ Failed to start report job.");

        // ✅ Step 3: Poll until report completes (max retries = 12 → 1 min)
        let status = "IN_PROGRESS";
        let retries = 0;
        while ((status === "IN_PROGRESS" || status === "WAITING") && retries < 12) {
            await new Promise((r) => setTimeout(r, 5000));
            const [jobStatus] = await client.getReportJobStatusAsync({
                reportJobId: jobId,
            });
            status = jobStatus?.rval;
            retries++;
        }
        if (status !== "COMPLETED") {
            throw new Error(`❌ Report failed with status: ${status}`);
        }

        // ✅ Step 4: Download CSV
        const [download] = await client.getReportDownloadURLAsync({
            reportJobId: jobId,
            exportFormat: "CSV_DUMP",
        });

        const downloadUrl = download?.rval;
        if (!downloadUrl) throw new Error("❌ Could not get download URL");

        const response = await axios.get(downloadUrl, { responseType: "stream" });

        // ✅ Step 5: Parse CSV directly from stream
        const rows = await new Promise((resolve, reject) => {
            const parsedRows = [];
            let stream = response.data;

            // try to gunzip, fallback to raw if fails
            const gunzip = zlib.createGunzip();
            stream = stream.pipe(gunzip).on("error", () => response.data);

            stream
                .pipe(csvParser())
                .on("data", (data) => {
                    parsedRows.push({
                        updateOne: {
                            filter: {
                                userId,
                                networkId,
                                reportDate: data["Dimension.DATE"],
                                site: data["Dimension.SITE_NAME"],
                                country: data["Dimension.COUNTRY_NAME"],
                            },
                            update: {
                                $set: {
                                    // reportJobId removed from uniqueness
                                    reportJobId: jobId,
                                    adxExchangeLineItemLevelImpressions:
                                        parseInt(
                                            data["Column.AD_EXCHANGE_LINE_ITEM_LEVEL_IMPRESSIONS"]
                                        ) || 0,
                                    adxExchangeLineItemLevelClicks:
                                        parseInt(
                                            data["Column.AD_EXCHANGE_LINE_ITEM_LEVEL_CLICKS"]
                                        ) || 0,
                                    adxExchangeLineItemLevelRevenue: parseFloatSafe(
                                        data["Column.AD_EXCHANGE_LINE_ITEM_LEVEL_REVENUE"]
                                    ),
                                    adxExchangeLineItemLevelAverageECPM: parseFloatSafe(
                                        data["Column.AD_EXCHANGE_LINE_ITEM_LEVEL_AVERAGE_ECPM"]
                                    ),
                                    adxExchangeLineItemLevelCtr: parseFloatSafe(
                                        data["Column.AD_EXCHANGE_LINE_ITEM_LEVEL_CTR"]
                                    ),
                                    adxExchangeCostPerClick: parseFloatSafe(
                                        data["Column.AD_EXCHANGE_COST_PER_CLICK"]
                                    ),
                                    site: data["Dimension.SITE_NAME"],
                                    country: data["Dimension.COUNTRY_NAME"],
                                },
                            },
                            upsert: true,
                        },
                    });
                })
                .on("end", () => resolve(parsedRows))
                .on("error", reject);
        });

        // ✅ Step 6: Bulk upsert into DB
        if (rows.length > 0) {
            await adManagerReportSchema.bulkWrite(rows, { ordered: false });
        }
    } catch (error) {
        console.error("❌ Error in fetchAdManagerReportLast30Days:", error);
    }
}
async function fetchAdManagerReportToday(userId, bearer, networkId, dateRangeType = "TODAY") {
    if (!networkId) {
        console.log("Network id not found");
    }
    try {
        const WSDL =
            "https://ads.google.com/apis/ads/publisher/v202505/ReportService?wsdl";
        const client = await soap.createClientAsync(WSDL);
        client.addHttpHeader("Authorization", `Bearer ${bearer}`);

        const NS = "https://www.google.com/apis/ads/publisher/v202505";
        client.addSoapHeader(`
      <tns:RequestHeader xmlns:tns="${NS}">
        <tns:networkCode>${networkId}</tns:networkCode>
        <tns:applicationName>DashboardApp-Prod</tns:applicationName>
      </tns:RequestHeader>
    `);
        const parseFloatSafe = (val) => {
            if (!val || val === "--") return 0;
            return parseFloat(val.toString().replace(/,/g, "")) || 0;
        };
        // ✅ Step 1: Define TODAY report
        const reportQuery = {
            dimensions: ["DATE", "SITE_NAME", "COUNTRY_NAME"],
            columns: [
                "AD_EXCHANGE_LINE_ITEM_LEVEL_IMPRESSIONS",
                "AD_EXCHANGE_LINE_ITEM_LEVEL_CLICKS",
                "AD_EXCHANGE_LINE_ITEM_LEVEL_REVENUE",
                "AD_EXCHANGE_LINE_ITEM_LEVEL_AVERAGE_ECPM",
                "AD_EXCHANGE_LINE_ITEM_LEVEL_CTR",
                "AD_EXCHANGE_COST_PER_CLICK",
            ],
            dateRangeType: dateRangeType, // ✅ Use the parameter
            reportCurrency: "USD",
            timeZoneType: "PUBLISHER",
        };

        // ✅ Step 2: Run report job
        const [jobResult] = await client.runReportJobAsync({
            reportJob: { reportQuery },
        });
        const jobId = jobResult?.rval?.id;
        if (!jobId) throw new Error("❌ Failed to start TODAY report job.");

        // ✅ Step 3: Poll until ready
        let status = "IN_PROGRESS";
        let retries = 0;
        while ((status === "IN_PROGRESS" || status === "WAITING") && retries < 12) {
            await new Promise((r) => setTimeout(r, 5000));
            const [jobStatus] = await client.getReportJobStatusAsync({
                reportJobId: jobId,
            });
            status = jobStatus?.rval;
            retries++;
        }
        if (status !== "COMPLETED") {
            throw new Error(`❌ TODAY Report failed with status: ${status}`);
        }

        // ✅ Step 4: Download CSV
        const [download] = await client.getReportDownloadURLAsync({
            reportJobId: jobId,
            exportFormat: "CSV_DUMP",
        });

        const downloadUrl = download?.rval;
        if (!downloadUrl)
            throw new Error("❌ Could not get download URL for TODAY");

        const response = await axios.get(downloadUrl, { responseType: "stream" });

        // ✅ Step 5: Parse + Upsert
        const rows = await new Promise((resolve, reject) => {
            const parsedRows = [];
            let stream = response.data;

            const gunzip = zlib.createGunzip();
            stream = stream.pipe(gunzip).on("error", () => response.data);

            stream
                .pipe(csvParser())
                .on("data", (data) => {

                    parsedRows.push({
                        updateOne: {
                            filter: {
                                userId,
                                networkId,
                                reportDate: data["Dimension.DATE"],
                                site: data["Dimension.SITE_NAME"],
                                country: data["Dimension.COUNTRY_NAME"],
                            },
                            update: {
                                $set: {
                                    // reportJobId removed from uniqueness
                                    reportJobId: jobId,
                                    adxExchangeLineItemLevelImpressions:
                                        parseInt(
                                            data["Column.AD_EXCHANGE_LINE_ITEM_LEVEL_IMPRESSIONS"]
                                        ) || 0,
                                    adxExchangeLineItemLevelClicks:
                                        parseInt(
                                            data["Column.AD_EXCHANGE_LINE_ITEM_LEVEL_CLICKS"]
                                        ) || 0,
                                    adxExchangeLineItemLevelRevenue: parseFloatSafe(
                                        data["Column.AD_EXCHANGE_LINE_ITEM_LEVEL_REVENUE"]
                                    ),
                                    adxExchangeLineItemLevelAverageECPM: parseFloatSafe(
                                        data["Column.AD_EXCHANGE_LINE_ITEM_LEVEL_AVERAGE_ECPM"]
                                    ),
                                    adxExchangeLineItemLevelCtr: parseFloatSafe(
                                        data["Column.AD_EXCHANGE_LINE_ITEM_LEVEL_CTR"]
                                    ),
                                    adxExchangeCostPerClick: parseFloatSafe(
                                        data["Column.AD_EXCHANGE_COST_PER_CLICK"]
                                    ),
                                    site: data["Dimension.SITE_NAME"],
                                    country: data["Dimension.COUNTRY_NAME"],
                                },
                            },
                            upsert: true,
                        },
                    });
                })
                .on("end", () => resolve(parsedRows))
                .on("error", reject);
        });

        if (rows.length > 0) {
            const data = await adManagerReportSchema.bulkWrite(rows, { ordered: false });
        } else {
            console.log("⚠️ No TODAY rows parsed");
        }
    } catch (error) {
        console.error("❌ Error in fetchAdManagerReportToday:", error);
    }
}

module.exports = { fetchAdManagerReportLast30Days, fetchAdManagerReportToday };