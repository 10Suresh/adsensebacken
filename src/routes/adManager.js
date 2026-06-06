// routes/admanager.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware");

const {
  getAdManagerAccounts,
  deleteAdManagerAccount, getSingleAdManagerAccountSites,
  getAdManagerReport, } = require("../controller/adManagerController")

// ✅ Ad Manager Accounts
router.get("/accounts", authMiddleware, getAdManagerAccounts);
router.delete("/accounts/:networkId", authMiddleware, deleteAdManagerAccount);
router.get("/accounts/:networkId/sites", authMiddleware, getSingleAdManagerAccountSites);// ✅ Reports
router.get("/report", authMiddleware, getAdManagerReport);


module.exports = router;
