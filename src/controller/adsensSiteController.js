const { google } = require("googleapis");
const { getAuthorizedClient } = require("../../src/services/googleAuth");
const AdsenseSiteSchema = require("../models/Sites");
const User = require("../models/User");
const logger = require("../logger");
const AdsenseRowSchema = require("../models/AdsenseRowSchema");
const WebsiteSchema = require("../models/Website");
// 🔹 Fetch AdSense Accounts
const getAdsenseAccounts = async (req, res) => {
    try {
        if (!req.user) {
            logger.warn("Unauthorized access attempt to getAdsenseAccounts");
            return res.status(401).json({ error: "Not authenticated" });
        }
        // Authorized OAuth client
        const auth = await getAuthorizedClient(req.user._id);
        const adsense = google.adsense("v2");

        const accountsRes = await adsense.accounts.list({ auth });
        const accounts = accountsRes.data.accounts || [];

        logger.info(`Fetched ${accounts.length} AdSense accounts for user ${req.user._id}`);
        res.json({ accounts });
    } catch (err) {
        logger.error({
            message: "AdSense API error",
            error: err.response?.data || err.message,
            stack: err.stack,
        });
        res.status(500).json({ error: "Failed to fetch AdSense accounts" });
    }
};

// 🔹 Get AdSense Sites (by accountId for current user)
const getAdsenseSites = async (req, res) => {
    const userId = req.user._id;
    try {
        const { accountId } = req.params;

        const sites = await AdsenseSiteSchema.find({ userId, accountId });

        logger.info(
            `Fetched ${sites.length} sites for user ${userId}, accountId ${accountId}`
        );

        res.json({
            success: true,
            count: sites.length,
            sites,
        });
    } catch (error) {
        logger.error({
            message: "Error fetching sites",
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

const getAllAdsenseSites = async (req, res) => {
    try {
        const userId = String(req.user._id);  

        const sites = await AdsenseSiteSchema.find({ userId });

        logger.info(`Fetched AdSense sites for user ${userId}. Total: ${sites.length}`);

        res.json({
            success: true,
            count: sites.length,
            sites,
        });
    } catch (error) {
        logger.error({
            message: "Error fetching user sites",
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// 🔹 Delete AdSense Account
const deleteAdsenseAccount = async (req, res) => {
    try {
        const { accountId } = req.params;
        const userId = req.user._id;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $pull: { adsenseAccounts: { accountId } } },
            { new: true }
        );

        if (!updatedUser) {
            logger.warn(`User ${userId} not found while deleting AdSense account ${accountId}`);
            return res.status(404).json({ error: "User not found" });
        }
        const deleteResult = await AdsenseRowSchema.deleteMany({
            userId: userId.toString(),
            accountId,
        });

        const result = await WebsiteSchema.deleteMany({
            userId: userId.toString(),
            accountId:accountId,
            isAdsense: true,
        });
        const SiteMain = await AdsenseSiteSchema.deleteMany({
            userId: userId.toString(),
            accountId:accountId,
        });
        console.log(`${result.deletedCount} document(s) deleted.`);


        logger.info(
            `Deleted AdSense account ${accountId} for user ${userId}, removed ${deleteResult.deletedCount} reports`
        );

        res.json({
            success: true,
            message: "AdSense account and related reports deleted successfully",
            deletedReports: deleteResult.deletedCount,
        });
    } catch (err) {
        logger.error({
            message: "Error deleting AdSense account",
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({ error: "Failed to delete AdSense account" });
    }
};

module.exports = {
    getAllAdsenseSites,
    deleteAdsenseAccount,
    getAdsenseAccounts,
    getAdsenseSites,
};
