const cron = require("node-cron");
const User = require("../models/User");
const {
  fetchAndSaveReportCron,
  fetchAdManagerReportCron,
} = require("../../utils/googleClient");
const { fetchAndSaveSites } = require("../services/googleAuth")
const { deleteOldAdManagerReports } = require("../helper/admanager/adxCron/deleteData");
const { deleteOldAdsenseReports } = require("../helper/adSense/adsenseCron/deleteData")
// Run every 1 hour
cron.schedule("0 * * * *", async () => {
  console.log("⏳ Starting AdSense & AdManager cron job...");

  try {
    const users = await User.find();

    // Process each user in parallel
    await Promise.all(
      users.map(async (user) => {
        const adsenseTasks = [];
        const adManagerTasks = [];
        const cleanupTasks = [];
        const siteDelete = [];
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
                // ✅ Add this like others (proper async handling)
                siteDelete.push(
                  fetchAndSaveSites(user._id, accountId)
                    .then(() =>
                      console.log(
                        `✅ AdSense sites saved | User: ${user._id} | Account: ${accountId} | Email: ${email}`
                      )
                    )
                    .catch((err) =>
                      console.error(
                        `❌ Error saving AdSense sites | User: ${user._id} | Account: ${accountId} | Email: ${email} | ${err.message}`
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

    console.log("🎉 Cron finished successfully!");
  } catch (err) {
    console.error("❌ Global Cron failed:", err.message);
  }
});
