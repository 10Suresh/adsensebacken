const dotenv = require("dotenv");
dotenv.config();

module.exports = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || 5000,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET || "supersecretkey",
    REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
    FRONTEND_REDIRECT_URL: process.env.FRONTEND_REDIRECT_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    TOKEN_EXPIRE: process.env.TOKEN_EXPIRE,
};
