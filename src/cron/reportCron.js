const cron = require("node-cron");
const User = require("../models/User");
const {
  fetchAndSaveReportCron,
  fetchAdManagerReportCron,
} = require("../../utils/googleClient");
const { fetchAndSaveSites } = require("../services/googleAuth")
const { deleteOldAdManagerReports } = require("../helper/admanager/adxCron/deleteData");
const { deleteOldAdsenseReports } = require("../helper/adSense/adsenseCron/deleteData")

// 🔹 Hourly cron job for fetching reports and cleaning up old ones
cron.schedule("0 * * * *", async () => {
  console.log("⏳ Starting AdSense & AdManager hourly report cron job... " + new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));

  try {
    const users = await User.find();

    // Process each user in parallel
    await Promise.all(
      users.map(async (user) => {
        const adsenseTasks = [];
        const adManagerTasks = [];
        const cleanupTasks = [];
        
        // 🔹 Prepare AdSense tasks
        if (Array.isArray(user.adsenseAccounts)) {
          user.adsenseAccounts.forEach(
            ({ accountId, accessToken, refreshToken, email }) => {
              if (accountId && refreshToken) {
                // Fetch new AdSense reports
                adsenseTasks.push(
                  fetchAndSaveReportCron(
                    user._id,
                    accountId,
                    accessToken,
                    refreshToken
                  )
                    .then(() =>
                      console.log(
                        `✅ AdSense report saved | User: ${user._id} | Account: ${accountId} | Email: ${email}`
                      )
                    )
                    .catch((err) =>
                      console.error(
                        `❌ AdSense error | User: ${user._id} | Account: ${accountId} | Email: ${email} | ${err.message}`
                      )
                    )
                );
                
                // Cleanup old AdSense reports (older than 60 days)
                cleanupTasks.push(
                  deleteOldAdsenseReports(user._id, accountId, 60)
                    .then((deletedCount) =>
                      console.log(
                        `🗑 Deleted ${deletedCount} old AdSense rows | User: ${user._id} | Account: ${accountId}`
                      )
                    )
                    .catch((err) =>
                      console.error(
                        `❌ Error deleting old AdSense rows | User: ${user._id} | Account: ${accountId} | ${err.message}`
                      )
                    )
                );
              }
            }
          );
        }
        // 🔹 Prepare AdManager tasks
        if (Array.isArray(user.adManagerAccounts)) {
          user.adManagerAccounts.forEach(
            ({ networkId, accessToken, refreshToken }) => {
              if (networkId && refreshToken) {
                // Fetch new reports
                adManagerTasks.push(
                  fetchAdManagerReportCron(
                    user._id,
                    networkId,
                    accessToken,
                    refreshToken
                  )
                    .then(() =>
                      console.log(
                        `✅ Ad Manager report saved | User: ${user._id} | Network: ${networkId}`
                      )
                    )
                    .catch((err) =>
                      console.error(
                        `❌ Ad Manager error | User: ${user._id} | Network: ${networkId} | ${err.message}`
                      )
                    )
                );

                // Cleanup old reports (older than 60 days)
                cleanupTasks.push(
                  deleteOldAdManagerReports(user._id, networkId, 60)
                    .then((deletedCount) =>
                      console.log(
                        `🗑 Deleted ${deletedCount} old Ad Manager rows | User: ${user._id} | Network: ${networkId}`
                      )
                    )
                    .catch((err) =>
                      console.error(
                        `❌ Error deleting old Ad Manager rows | User: ${user._id} | Network: ${networkId} | ${err.message}`
                      )
                    )
                );
              }
            }
          );
        }

        // 🔹 Run all tasks in parallel for this user
        await Promise.all([...adsenseTasks, ...adManagerTasks, ...cleanupTasks]);
      })
    );

    console.log("🎉 Hourly Cron finished successfully! " + new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
  } catch (err) {
    console.error("❌ Global Hourly Cron failed:", err.message);
  }
}, {
  timezone: "Asia/Kolkata"
});

// 🔹 Cron job to run at 12:30 AM, 1:30 AM, 2:30 AM, and 3:30 AM to fetch yesterday's data
cron.schedule("30 0,1,2,3 * * *", async () => {
  console.log("⏳ Starting AdSense & AdManager yesterday's data sync cron job... " + new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));

  try {
    const users = await User.find();

    // Process each user in parallel
    await Promise.all(
      users.map(async (user) => {
        const adsenseTasks = [];
        const adManagerTasks = [];
        
        // 🔹 Prepare AdSense tasks for YESTERDAY
        if (Array.isArray(user.adsenseAccounts)) {
          user.adsenseAccounts.forEach(
            ({ accountId, accessToken, refreshToken, email }) => {
              if (accountId && refreshToken) {
                // Fetch new AdSense reports for YESTERDAY
                adsenseTasks.push(
                  fetchAndSaveReportCron(
                    user._id,
                    accountId,
                    accessToken,
                    refreshToken,
                    "YESTERDAY"
                  )
                    .then(() =>
                      console.log(
                        `✅ AdSense yesterday's report saved | User: ${user._id} | Account: ${accountId} | Email: ${email}`
                      )
                    )
                    .catch((err) =>
                      console.error(
                        `❌ AdSense yesterday's report error | User: ${user._id} | Account: ${accountId} | Email: ${email} | ${err.message}`
                      )
                    )
                );
              }
            }
          );
        }

        // 🔹 Prepare AdManager tasks for YESTERDAY
        if (Array.isArray(user.adManagerAccounts)) {
          user.adManagerAccounts.forEach(
            ({ networkId, accessToken, refreshToken }) => {
              if (networkId && refreshToken) {
                // Fetch new reports for YESTERDAY
                adManagerTasks.push(
                  fetchAdManagerReportCron(
                    user._id,
                    networkId,
                    accessToken,
                    refreshToken,
                    "YESTERDAY"
                  )
                    .then(() =>
                      console.log(
                        `✅ Ad Manager yesterday's report saved | User: ${user._id} | Network: ${networkId}`
                      )
                    )
                    .catch((err) =>
                      console.error(
                        `❌ Ad Manager yesterday's report error | User: ${user._id} | Network: ${networkId} | ${err.message}`
                      )
                    )
                );
              }
            }
          );
        }

        // 🔹 Run all tasks in parallel for this user
        await Promise.all([...adsenseTasks, ...adManagerTasks]);
      })
    );

    console.log("🎉 Yesterday's Data Sync Cron finished successfully! " + new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
  } catch (err) {
    console.error("❌ Yesterday's Data Sync Cron failed:", err.message);
  }
}, {
  timezone: "Asia/Kolkata"
});
