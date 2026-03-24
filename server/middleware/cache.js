const { getClient, isReady } = require('../utils/redis');

/**
 * Factory that returns an Express middleware which:
 *  1. Builds a per-user cache key from userId + path + query params
 *  2. Returns a cached JSON response on hit (adds X-Cache: HIT header)
 *  3. On miss, intercepts res.json() to store the response before sending it
 *  4. Falls through silently if Redis is unavailable — never breaks the API
 *
 * @param {number} ttlSeconds  How long to cache the response (in seconds)
 * @returns Express middleware function
 */
function createCacheMiddleware(ttlSeconds) {
  return async function cacheMiddleware(req, res, next) {
    // Only cache authenticated GET requests
    if (req.method !== 'GET' || !req.user) {
      return next();
    }

    // Bail out gracefully if Redis isn't up
    if (!isReady()) {
      return next();
    }

    const redis = getClient();
    const userId = req.user._id.toString();
    const queryStr = Object.keys(req.query).length
      ? JSON.stringify(req.query)
      : '';
    const cacheKey = `${userId}:${req.path}:${queryStr}`;

    try {
      // ── Cache HIT ─────────────────────────────────────────────────────────
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-TTL', ttlSeconds);
        return res.json(JSON.parse(cached));
      }

      // ── Cache MISS — intercept res.json to store after response ───────────
      res.setHeader('X-Cache', 'MISS');
      const originalJson = res.json.bind(res);

      res.json = function (body) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Fire-and-forget — never delay the response for a cache write
          redis.set(cacheKey, JSON.stringify(body), 'EX', ttlSeconds).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      // Redis command failed — fall through so the API still works
      console.warn('Cache middleware error (falling through):', err.message);
      next();
    }
  };
}

/**
 * Delete all cached analytics keys for a given user.
 * Called after CREATE / UPDATE / DELETE on expenses so the dashboard
 * immediately reflects the new data.
 *
 * Uses SCAN instead of KEYS to avoid blocking Redis on large keyspaces.
 *
 * @param {string} userId  MongoDB ObjectId string
 */
async function invalidateUserCache(userId) {
  if (!isReady()) return;

  const redis = getClient();
  const pattern = `${userId}:*`;

  try {
    // SCAN with COUNT hint — non-blocking alternative to KEYS
    const keys = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    if (keys.length > 0) {
      // DEL accepts multiple keys in one command
      await redis.del(...keys);
    }
  } catch (err) {
    // Invalidation failure is non-critical — log and continue
    console.warn('Cache invalidation error (non-critical):', err.message);
  }
}

module.exports = { createCacheMiddleware, invalidateUserCache };
