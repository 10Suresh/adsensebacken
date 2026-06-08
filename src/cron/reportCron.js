const cron = require("node-cron");
const User = require("../models/User");
const {
  fetchAndSaveReportCron,
  fetchAndSaveReportYesterdayCron,
  fetchAdManagerReportCron,
  fetchAdManagerReportYesterdayCron,
} = require("../../utils/googleClient");
const { fetchAndSaveSites } = require("../services/googleAuth")
const { deleteOldAdManagerReports } = require("../helper/admanager/adxCron/deleteData");
const { deleteOldAdsenseReports } = require("../helper/adSense/adsenseCron/deleteData")

// 🔹 Main Cron: Run every 1 hour (at minute 0)
cron.schedule("0 * * * *", async () => {
  const startTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`⏳ [${startTime}] Starting AdSense & AdManager main cron job...`);

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
                    .then((result) =>
                      console.log(
                        `✅ AdSense report saved | User: ${user._id} | Account: ${accountId} | Email: ${email} | Total: ${result?.total||0}, Upserted: ${result?.upserted||0}, Modified: ${result?.modified||0}, Inserted: ${result?.inserted||0}`
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
                    .then((result) =>
                      console.log(
                        `✅ Ad Manager report saved | User: ${user._id} | Network: ${networkId} | Total: ${result?.total||0}, Upserted: ${result?.upserted||0}, Modified: ${result?.modified||0}, Inserted: ${result?.inserted||0}`
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

    const endTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    console.log(`🎉 [${endTime}] Main Cron finished successfully!`);
  } catch (err) {
    const errorTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    console.error(`❌ [${errorTime}] Global Main Cron failed:`, err.message);
  }
}, {
  timezone: "Asia/Kolkata"
});

// 🔹 Yesterday Cron logic
const runYesterdayCronJob = async () => {
  const startTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`⏳ [${startTime}] Starting AdSense Yesterday cron job...`);

  try {
    const users = await User.find();

    // Process each user in parallel
    await Promise.all(
      users.map(async (user) => {
        const yesterdayTasks = [];
        
        // 🔹 Prepare AdSense tasks for Yesterday
        if (Array.isArray(user.adsenseAccounts)) {
          user.adsenseAccounts.forEach(
            ({ accountId, accessToken, refreshToken, email }) => {
              if (accountId && refreshToken) {
                // Fetch Yesterday's AdSense reports
                yesterdayTasks.push(
                  fetchAndSaveReportYesterdayCron(
                    user._id,
                    accountId,
                    accessToken,
                    refreshToken
                  )
                    .then((result) =>
                      console.log(
                        `✅ AdSense yesterday report saved | User: ${user._id} | Account: ${accountId} | Email: ${email} | Total: ${result?.total||0}, Upserted: ${result?.upserted||0}, Modified: ${result?.modified||0}, Inserted: ${result?.inserted||0}`
                      )
                    )
                    .catch((err) =>
                      console.error(
                        `❌ AdSense yesterday error | User: ${user._id} | Account: ${accountId} | Email: ${email} | ${err.message}`
                      )
                    )
                );
              }
            }
          );
        }

        // 🔹 Prepare AdManager tasks for Yesterday
        if (Array.isArray(user.adManagerAccounts)) {
          user.adManagerAccounts.forEach(
            ({ networkId, accessToken, refreshToken }) => {
              if (networkId && refreshToken) {
                // Fetch Yesterday's reports
                yesterdayTasks.push(
                  fetchAdManagerReportYesterdayCron(
                    user._id,
                    networkId,
                    accessToken,
                    refreshToken
                  )
                    .then((result) =>
                      console.log(
                        `✅ Ad Manager yesterday report saved | User: ${user._id} | Network: ${networkId} | Total: ${result?.total||0}, Upserted: ${result?.upserted||0}, Modified: ${result?.modified||0}, Inserted: ${result?.inserted||0}`
                      )
                    )
                    .catch((err) =>
                      console.error(
                        `❌ Ad Manager yesterday error | User: ${user._id} | Network: ${networkId} | ${err.message}`
                      )
                    )
                );
              }
            }
          );
        }

        // 🔹 Run yesterday tasks in parallel for this user
        await Promise.all(yesterdayTasks);
      })
    );

    const endTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    console.log(`🎉 [${endTime}] Yesterday Cron finished successfully!`);
  } catch (err) {
    const errorTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    console.error(`❌ [${errorTime}] Global Yesterday Cron failed:`, err.message);
  }
};

// 🔹 Schedule Yesterday Cron: 12:30 AM, 1:30 AM, 2:30 AM, 3:30 AM
cron.schedule("30 0,1,2,3 * * *", runYesterdayCronJob, {
  timezone: "Asia/Kolkata"
});