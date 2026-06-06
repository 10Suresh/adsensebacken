const Redis = require("ioredis");
const config = require("../../config/config");

// default redis://127.0.0.1:6379
let redis = null;
let redisConnected = false;

try {
  redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: false,
  });

  redis.on("connect", () => {
    redisConnected = true;
    console.log("✅ Redis connected for caching");
  });

  redis.on("error", (err) => {
    redisConnected = false;
    // Suppress repeated connection errors
    if (err.code !== "ENOTFOUND" && err.code !== "ECONNREFUSED") {
      console.error("⚠️ Redis error (caching disabled):", err.message);
    }
  });

  redis.on("close", () => {
    redisConnected = false;
  });
} catch (err) {
  console.warn("⚠️ Redis initialization skipped, caching will be disabled");
  redis = null;
}

// TTL in seconds (adjust as needed)
const DEFAULT_TTL = 60; // cache 1 min

const setCache = async (key, value, ttl = DEFAULT_TTL) => {
  if (!redis || !redisConnected) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch (err) {
    // Silently fail if Redis is unavailable
  }
};

const getCache = async (key) => {
  if (!redis || !redisConnected) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
};

const clearUserCache = async (userId) => {
  if (!redis || !redisConnected) return;
  try {
    const pattern = `dashboard:${userId}:*`;
    const stream = redis.scanStream({ match: pattern });
    const pipeline = redis.pipeline();

    stream.on("data", (keys) => {
      if (keys.length) {
        keys.forEach((key) => pipeline.del(key));
      }
    });

    return new Promise((resolve, reject) => {
      stream.on("end", async () => {
        await pipeline.exec();
        resolve();
      });
      stream.on("error", reject);
    });
  } catch (err) {
    // Silently fail
  }
};

module.exports = { setCache, getCache, clearUserCache };
