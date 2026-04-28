const { MongoClient } = require("mongodb");

let db;

async function connectMongo() {
  const client = await MongoClient.connect(process.env.MONGO_URI, { tls: true });
  db = client.db("minidriveAi");
  console.log("Mongo connected");
  return db;
}

function getDb() {
  if (!db) throw new Error("MongoDB not connected yet");
  return db;
}

module.exports = { connectMongo, getDb };