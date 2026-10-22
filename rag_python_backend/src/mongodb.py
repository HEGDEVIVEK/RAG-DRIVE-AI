import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)

mongo_db = mongo_client[os.environ["MONGO_DB_NAME"]]

mongo_client.admin.command("ping")
print("MongoDB connected successfully")