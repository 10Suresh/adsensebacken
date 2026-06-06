const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const logger = require("../logger");
const { JWT_SECRET, TOKEN_EXPIRE } = require("../../config/config");
// 🔹 Signup
const signup = async (req, res) => {
  try {
    const { fname, lname, email, password } = req.body;

    if (!fname || !lname || !email || !password) {
      logger.warn({
        message: "Signup failed - missing fields",
        body: req.body,
        route: req.originalUrl,
        method: req.method,
      });
      return res.status(400).json({ msg: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn({
        message: "Signup failed - user already exists",
        email,
        route: req.originalUrl,
        method: req.method,
      });
      return res.status(400).json({ msg: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ fname, lname, email, password: hashedPassword });
    await newUser.save();

    logger.info({
      message: "User registered successfully",
      userId: newUser._id,
      email: newUser.email,
    });

    res.status(201).json({ msg: "User registered successfully " });
  } catch (err) {
    logger.error({
      message: "Signup Error",
      error: err.message,
      stack: err.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ msg: "Server error" });
  }
};
// 🔹 Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn({
        message: "Login failed - user not found",
        email,
        route: req.originalUrl,
        method: req.method,
      });
      return res.status(401).json({ msg: "Invalid credentials!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn({
        message: "Login failed - wrong password",
        email,
        route: req.originalUrl,
        method: req.method,
      });
      return res.status(401).json({ msg: "Invalid credentials!" });
    }

    const payload = {
      id: user._id,
      fname: user.fname,
      lname: user.lname,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRE || "5d" });

    logger.info({
      message: "Login successful",
      userId: user._id,
      email,
      route: req.originalUrl,
      method: req.method,
    });

    res.status(200).json({ msg: "Login successful ", token });
  } catch (err) {
    logger.error({
      message: "Login Error",
      error: err.message,
      stack: err.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ msg: "Server error" });
  }
};

// 🔹 Change password
const changePassword = async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      logger.warn({
        message: "Change password failed - missing fields",
        body: req.body,
        route: req.originalUrl,
        method: req.method,
      });
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      logger.warn({
        message: "Change password failed - user not found",
        userId,
        route: req.originalUrl,
        method: req.method,
      });
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      logger.warn({
        message: "Change password failed - incorrect old password",
        userId,
        route: req.originalUrl,
        method: req.method,
      });
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    logger.info({
      message: "Password changed successfully",
      userId: user._id,
      route: req.originalUrl,
      method: req.method,
    });

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    logger.error({
      message: "Change password Error",
      error: err.message,
      stack: err.stack,
      route: req.originalUrl,
      method: req.method,
    });
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  signup,
  login,
  changePassword,
};
