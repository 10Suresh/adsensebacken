const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");
const { REDIS_URL, JWT_SECRET, NODE_ENV } = require("../config/config");

// ✅ Create Redis client
const redisClient = createClient({
  url: REDIS_URL,
});
console.log(redisClient, "datasss aredis")
redisClient.on("connect", () => console.log("✅ Redis connected"));
redisClient.on("error", (err) => console.error("❌ Redis error:", err));

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
})();

// ✅ Create Redis session store
const store = new RedisStore({
  client: redisClient,
  prefix: "session:",
});

// ✅ Session cookie expiration: 30 days
const maxAgeForSessionCookie = 30 * 24 * 60 * 60 * 1000;

const options = {
  store,
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

module.exports = { store, options, redisClient };
