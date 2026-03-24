const Redis = require('ioredis');

let client = null;
let isConnected = false;

function getClient() {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  client = new Redis(redisUrl, {
    // Don't crash the process on connection failure
    lazyConnect: true,
    // Limit reconnect attempts so a missing Redis doesn't stall startup
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // Give up after 3 attempts; cache middleware will fall through gracefully
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    enableOfflineQueue: false // reject commands immediately when disconnected
  });

  client.on('connect', () => {
    isConnected = true;
    console.log('✅ Redis connected');
  });

  client.on('error', (err) => {
    isConnected = false;
    // Log once per disconnect, not on every failed command
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.warn('⚠️  Redis unavailable — caching disabled, API continues normally');
    }
  });

  client.on('close', () => {
    isConnected = false;
  });

  // Trigger the lazy connection
  client.connect().catch(() => {
    // Swallow — retryStrategy handles reconnects
  });

  return client;
}

function isReady() {
  return isConnected && client && client.status === 'ready';
}

module.exports = { getClient, isReady };
