// routes/websiteRoutes.js
const express = require("express");
const authMiddleware = require("../middleware")
const { addWebsite, getWebsites, deleteWebsite } = require("../controller/websiteController");

const router = express.Router();

// Add a website
router.post("/websites",authMiddleware, addWebsite);

// Get all websites
router.get("/websites",authMiddleware, getWebsites);

// Delete a website by ID
router.delete("/websites/:id",authMiddleware, deleteWebsite);

module.exports = router;
