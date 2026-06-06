
const AdManagerRowsSchema = require("../../../models/AdManagerRowsSchema");

/**
 * Delete Ad Manager report data older than `days` for a specific user/network
 * @param {string} userId - MongoDB user ID
 * @param {string} networkId - Ad Manager network ID
 * @param {number} days - number of days to keep (default 60)
 */
async function deleteOldAdManagerReports(userId, networkId, days = 60) {
    try {
        if (!userId || !networkId) {
            throw new Error("userId and networkId are required");
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const result = await AdManagerRowsSchema.deleteMany({
            userId,
            networkId,
            $expr: {
                $lt: [
                    { $dateFromString: { dateString: "$reportDate" } },
                    cutoffDate,
                ],
            },
        });
        console.log(
            `✅ Deleted ${result.deletedCount} Ad Manager report rows older than ${days} days`
        );
        return result.deletedCount;
    } catch (error) {
        console.error("❌ Error deleting old Ad Manager reports:", error);
        throw error;
    }
}

module.exports = { deleteOldAdManagerReports }