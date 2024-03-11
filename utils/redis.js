import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    // Create a Redis client
    this.client = createClient();
    this.client.connected = true;

    // Log Redis errors to the console
    this.client.on('error', (error) => {
      console.error('Redis failed to connect:', error);
    });
  }

  isAlive() {
    // Check if the Redis client is connected
    return this.client.connected;
  }

  async get(key) {
    // Promisify the get method of the Redis client
    const getAsync = promisify(this.client.get).bind(this.client);
    // Return the result of the get method
    return await getAsync(key);
  }

  async set(key, value, durationInSeconds) {
    // Promisify the set method of the Redis client
    const setAsync = promisify(this.client.set).bind(this.client);
    // Set the key-value pair with an expiration time
    await setAsync(key, value, 'EX', durationInSeconds);
  }

  async del(key) {
    // Promisify the del method of the Redis client
    const delAsync = promisify(this.client.del).bind(this.client);
    // Delete the value associated with the key
    await delAsync(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
