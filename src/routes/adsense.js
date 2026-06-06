const express = require("express");

const router = express.Router();
const authMiddleware = require("../middleware");

const { getAdsenseAccounts,deleteAdsenseAccount, getAdsenseSites, getAllAdsenseSites } = require("../controller/adsensSiteController")
// ==============================
// Get AdSense Accounts
router.get("/accounts", authMiddleware, getAdsenseAccounts);

router.get("/sites/:accountId", authMiddleware, getAdsenseSites);
// ==============================
// Get ALL AdSense Sites (across accounts)
// ==============================
router.get("/sites", authMiddleware, getAllAdsenseSites);

// DELETE AdSense account from user's adsenseAccounts
// 🔹 Delete AdSense Account
router.delete("/accounts/:accountId", authMiddleware, deleteAdsenseAccount);


module.exports = router;
