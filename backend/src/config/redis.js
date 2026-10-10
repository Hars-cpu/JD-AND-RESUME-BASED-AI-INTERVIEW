/**
 * @file redis.js
 * @summary Redis database connection config. Configures the database socket parameters (timeout, retries),
 *          registers event listeners for logging socket transitions, and hooks into OS signals (SIGINT/SIGTERM)
 *          to perform clean shutdown sequences.
 * 
 * @functions
 * - reconnectStrategy: Custom retry calculator that applies linear backoff delay capped at 3 seconds.
 * - connectRedis: Async boot loader checking client status and triggering connection requests.
 * - process.on('SIGINT' / 'SIGTERM'): Catch OS termination commands to run graceful Redis client quit cycles.
 */

const { createClient } = require('redis');

// ✅ Use REDIS_URL from environment (Render / Redis Cloud)
const redisClient = createClient({
    url: process.env.REDIS_URL,   // ⭐ MAIN CHANGE
    socket: {
        reconnectStrategy: (retries) => {
            console.log(`Redis reconnection attempt: ${retries}`);
            return Math.min(retries * 100, 3000);
        },
        connectTimeout: 10000
    }
});

// ---------- Events ----------
redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err.message);
});

redisClient.on('connect', () => {
    console.log('Redis Client Connected');
});

redisClient.on('ready', () => {
    console.log('Redis Client Ready');
});

redisClient.on('reconnecting', () => {
    console.log('Redis Client Reconnecting...');
});

redisClient.on('end', () => {
    console.log('Redis Client Connection Closed');
});

// ---------- Connect ----------
const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
            console.log('✅ Successfully connected to Redis');
        }
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error.message);
    }
};

// Auto connect
connectRedis();

// ---------- Graceful shutdown ----------
process.on('SIGINT', async () => {
    await redisClient.quit();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await redisClient.quit();
    process.exit(0);
});

module.exports = redisClient;
