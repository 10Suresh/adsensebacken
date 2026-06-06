const express = require("express");
const authMiddleware = require("../middleware");
const router = express.Router();

const {googleAuth, googleCallback } = require("../controller/userController")
const { getAdsenseAccounts } = require("../controller/userController")


// GOOGLE LOGIN ROUTE
router.get("/google", googleAuth);

//  Google OAuth Callback
router.get("/google/callback", googleCallback);
//  Get linked AdSense accounts
router.get("/accounts", authMiddleware, getAdsenseAccounts);


module.exports = router;
