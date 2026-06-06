const jwt = require("jsonwebtoken");
const User = require("./models/User");
const logger = require("./logger");
const {JWT_SECRET} = require("../config/config")
const secret = JWT_SECRET || "supersecretkey";

const authMiddleware = async (req, res, next) => {
  const start = Date.now(); // start timer
  try {
    const token = req.headers.authorization?.split(" ")[1]; // "Bearer <token>"
    if (!token) {
      const duration = Date.now() - start;
      logger.warn({
        message: "No token provided",
        route: req.originalUrl,
        method: req.method,
        executionTime: `${duration} ms`,
      });
      return res.status(401).json({ msg: "No token provided" });
    }

    const decoded = jwt.verify(token, secret);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      const duration = Date.now() - start;
      logger.warn({
        message: "User not found",
        route: req.originalUrl,
        method: req.method,
        executionTime: `${duration} ms`,
      });
      return res.status(401).json({ msg: "User not found" });
    }

    const duration = Date.now() - start;
    // logger.info({
    //   message: "Auth successful",
    //   userId: decoded.id,
    //   route: req.originalUrl,
    //   method: req.method,
    //   executionTime: `${duration} ms`,
    // });

    next();
  } catch (err) {
    const duration = Date.now() - start;
    logger.error("Auth Error", {
      message: err.message,
      stack: err.stack,
      route: req.originalUrl,
      method: req.method,
      executionTime: `${duration} ms`,
    });
    res.status(401).json({ msg: "Unauthorized" });
  }
};

module.exports = authMiddleware;
