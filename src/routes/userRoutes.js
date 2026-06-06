const express = require("express");
const authMiddleware = require("../middleware")
const { changePassword, signup, login } = require("../controller/authController")
const router = express.Router();

// Change password
router.post("/change-password", authMiddleware, changePassword);
router.post("/signup", signup);
router.post("/login", login);
router.get("/logout", (req, res) => {
    res.json({ success: true, msg: "Logged out" });
});

module.exports = router;
