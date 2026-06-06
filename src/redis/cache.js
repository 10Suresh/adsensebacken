const Redis = require("ioredis");
const config = require("../../config/config");

// default redis://127.0.0.1:6379
const redis = new Redis(config.REDIS_URL);

// TTL in seconds (adjust as needed)
const DEFAULT_TTL = 60; // cache 1 min

const setCache = async (key, value, ttl = DEFAULT_TTL) => {
  await redis.set(key, JSON.stringify(value), "EX", ttl);
};

const getCache = async (key) => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};
const clearUserCache = async (userId) => {
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
};
module.exports = { setCache, getCache, clearUserCache };
