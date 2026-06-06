const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");
const { REDIS_URL, JWT_SECRET, NODE_ENV } = require("../config/config");

// ✅ Create Redis client with graceful error handling
let redisClient = null;
let store = null;
let redisAvailable = false;

try {
  redisClient = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          console.warn("⚠️ Redis reconnect attempts exceeded, giving up");
          return new Error("Max retries exceeded");
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  redisClient.on("connect", () => {
    redisAvailable = true;
    console.log("✅ Redis connected");
  });

  redisClient.on("error", (err) => {
    redisAvailable = false;
    // Suppress repeated connection errors - only log ENOTFOUND once
    if (!err.message.includes("ENOTFOUND")) {
      console.error("⚠️ Redis error:", err.message);
    }
  });

  redisClient.on("close", () => {
    redisAvailable = false;
  });

  // Attempt to connect without blocking
  (async () => {
    try {
      await redisClient.connect();
    } catch (err) {
      console.warn("⚠️ Redis connection failed, using in-memory sessions:", err.message);
      redisAvailable = false;
    }
  })();

  // Create RedisStore if connection succeeds
  store = new RedisStore({
    client: redisClient,
    prefix: "session:",
  });
} catch (err) {
  console.warn("⚠️ Redis setup failed, will use in-memory sessions");
}

// ✅ Session cookie expiration: 30 days
const maxAgeForSessionCookie = 30 * 24 * 60 * 60 * 1000;

const options = {
  store: store || undefined, // Use in-memory if Redis unavailable
  secret: JWT_SECRET || "supersecretkey",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: maxAgeForSessionCookie,
    secure: NODE_ENV === "production",
    sameSite: NODE_ENV === "production" ? "none" : "lax",
  },
};

module.exports = { store, options, redisClient, redisAvailable };
