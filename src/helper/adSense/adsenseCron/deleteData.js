const AdsenseRowSchema = require("../../../models/AdsenseRowSchema");

/**
 * Delete AdSense report data older than `days` for a specific user/account
 * @param {string} userId - MongoDB user ID
 * @param {string} accountId - AdSense account ID
 * @param {number} days - number of days to keep (default 60)
 */
async function deleteOldAdsenseReports(userId, accountId, days = 60) {
  try {
    if (!userId || !accountId) {
      throw new Error("userId and accountId are required");
    }

    // Calculate cutoff date in YYYY-MM-DD format
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split("T")[0]; // e.g., "2025-07-22"
    const result = await AdsenseRowSchema.deleteMany({
      userId,
      accountId,
      date: { $lt: cutoffStr },
    });

    console.log(
      `✅ Deleted ${result.deletedCount} AdSense report rows older than ${days} days`
    );
    return result.deletedCount;
  } catch (error) {
    console.error("❌ Error deleting old AdSense reports:", error);
    throw error;
  }
}

module.exports = { deleteOldAdsenseReports };
