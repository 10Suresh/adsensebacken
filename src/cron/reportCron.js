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
const { addDbStats, formatDbStats } = require("../../utils/bulkWriteStats");

const emptyDbStats = () => ({ processed: 0, inserted: 0, modified: 0, upserted: 0 });
const emptyCronStats = () => ({
  adsense: emptyDbStats(),
  adManager: emptyDbStats(),
  sites: { saved: 0 },
  deleted: { adsense: 0, adManager: 0 },
  errors: 0,
});

let isMainCronRunning = false;
let isYesterdayCronRunning = false;

const getIstTime = () =>
  new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

// 🔹 Main Cron: every hour at minute 0 (Asia/Kolkata)
const runMainCronJob = async () => {
  if (isMainCronRunning) {
    console.log(`⏭ [${getIstTime()}] Skipping main cron - previous run still in progress`);
    return;
  }

  isMainCronRunning = true;
  const startTime = getIstTime();
  console.log(`⏳ [${startTime}] Starting AdSense & AdManager main cron job...`);

  try {
    const users = await User.find();
    const cronStats = emptyCronStats();

    // Process each user in parallel
    await Promise.all(
      users.map(async (user) => {
        const adsenseTasks = [];
        const adManagerTasks = [];
        const cleanupTasks = [];
        const siteTasks = [];
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
                    .then((stats) => {
                      addDbStats(cronStats.adsense, stats);
                      console.log(
                        `✅ AdSense report saved | User: ${user._id} | Account: ${accountId} | Email: ${email} | ${formatDbStats(stats)}`
                      );
                    })
                    .catch((err) => {
                      cronStats.errors += 1;
                      console.error(
                        `❌ AdSense error | User: ${user._id} | Account: ${accountId} | Email: ${email} | ${err.message}`
                      );
                    })
                );
                siteTasks.push(
                  fetchAndSaveSites(user._id, accountId)
                    .then((result) => {
                      cronStats.sites.saved += result?.saved || 0;
                      console.log(
                        `✅ AdSense sites saved | User: ${user._id} | Account: ${accountId} | Email: ${email} | Sites: ${result?.saved || 0}`
                      );
                    })
                    .catch((err) => {
                      cronStats.errors += 1;
                      console.error(
                        `❌ Error saving AdSense sites | User: ${user._id} | Account: ${accountId} | Email: ${email} | ${err.message}`
                      );
                    })
                );
                // Cleanup old AdSense reports (older than 60 days)
                cleanupTasks.push(
                  deleteOldAdsenseReports(user._id, accountId, 60)
                    .then((deletedCount) => {
                      cronStats.deleted.adsense += deletedCount || 0;
                      console.log(
                        `🗑 Deleted ${deletedCount} old AdSense rows | User: ${user._id} | Account: ${accountId}`
                      );
                    })
                    .catch((err) => {
                      cronStats.errors += 1;
                      console.error(
                        `❌ Error deleting old AdSense rows | User: ${user._id} | Account: ${accountId} | ${err.message}`
                      );
                    })
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
                    .then((stats) => {
                      addDbStats(cronStats.adManager, stats);
                      console.log(
                        `✅ Ad Manager report saved | User: ${user._id} | Network: ${networkId} | ${formatDbStats(stats)}`
                      );
                    })
                    .catch((err) => {
                      cronStats.errors += 1;
                      console.error(
                        `❌ Ad Manager error | User: ${user._id} | Network: ${networkId} | ${err.message}`
                      );
                    })
                );

                // Cleanup old reports (older than 60 days)
                cleanupTasks.push(
                  deleteOldAdManagerReports(user._id, networkId, 60)
                    .then((deletedCount) => {
                      cronStats.deleted.adManager += deletedCount || 0;
                      console.log(
                        `🗑 Deleted ${deletedCount} old Ad Manager rows | User: ${user._id} | Network: ${networkId}`
                      );
                    })
                    .catch((err) => {
                      cronStats.errors += 1;
                      console.error(
                        `❌ Error deleting old Ad Manager rows | User: ${user._id} | Network: ${networkId} | ${err.message}`
                      );
                    })
                );
              }
            }
          );
        }

        // 🔹 Run all tasks in parallel for this user
        await Promise.all([...adsenseTasks, ...adManagerTasks, ...siteTasks, ...cleanupTasks]);
      })
    );

    const endTime = getIstTime();
    console.log(`📊 [${endTime}] Main Cron Summary:`);
    console.log(`   AdSense    → ${formatDbStats(cronStats.adsense)} | Deleted: ${cronStats.deleted.adsense}`);
    console.log(`   Ad Manager → ${formatDbStats(cronStats.adManager)} | Deleted: ${cronStats.deleted.adManager}`);
    console.log(`   Sites      → Saved: ${cronStats.sites.saved}`);
    if (cronStats.errors > 0) {
      console.log(`   Errors     → ${cronStats.errors}`);
    }
    console.log(`🎉 [${endTime}] Main Cron finished successfully!`);
  } catch (err) {
    console.error(`❌ [${getIstTime()}] Global Main Cron failed:`, err.message);
  } finally {
    isMainCronRunning = false;
  }
};

// 🔹 Yesterday Cron logic
const runYesterdayCronJob = async () => {
  if (isYesterdayCronRunning) {
    console.log(`⏭ [${getIstTime()}] Skipping yesterday cron - previous run still in progress`);
    return;
  }

  isYesterdayCronRunning = true;
  const startTime = getIstTime();
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
                    .then(() =>
                      console.log(
                        `✅ AdSense yesterday report saved | User: ${user._id} | Account: ${accountId} | Email: ${email}`
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
                    .then(() =>
                      console.log(
                        `✅ Ad Manager yesterday report saved | User: ${user._id} | Network: ${networkId}`
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

    const endTime = getIstTime();
    console.log(`🎉 [${endTime}] Yesterday Cron finished successfully!`);
  } catch (err) {
    console.error(`❌ [${getIstTime()}] Global Yesterday Cron failed:`, err.message);
  } finally {
    isYesterdayCronRunning = false;
  }
};

function initCrons() {
  cron.schedule("0 * * * *", runMainCronJob, {
    timezone: "Asia/Kolkata",
    recoverMissedExecutions: true,
  });

  // 12:30 AM, 1:30 AM, 2:30 AM, 3:30 AM IST
  cron.schedule("30 0,1,2,3 * * *", runYesterdayCronJob, {
    timezone: "Asia/Kolkata",
    recoverMissedExecutions: true,
  });

  console.log("✅ Crons scheduled → Main: every hour at :00 IST | Yesterday: 12:30–3:30 AM IST");
}

module.exports = { initCrons };