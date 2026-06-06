const express = require("express");
const authMiddleware = require("../middleware"); // agar JWT/session check karna hai
const {
  getReports,
  getDashboardReport,
} = require("../controller/adsenseController");
const router = express.Router();

// ✅ GET saved Adsense Reports
router.get("/reports", authMiddleware, getReports);
router.get("/allresports", authMiddleware, getDashboardReport);

module.exports = router;
