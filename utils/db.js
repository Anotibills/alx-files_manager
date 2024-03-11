import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '27017';
    const dbName = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${dbHost}:${dbPort}/${dbName}`;

    this.client = new MongoClient(url, { useUnifiedTopology: true });

    this.client.connect();
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    return this.client.db().collection('users').countDocuments();
  }

  async nbFiles() {
    return this.client.db().collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
