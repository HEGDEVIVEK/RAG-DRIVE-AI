import os
import json
from dotenv import load_dotenv

from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, File, UploadFile
from uuid import uuid4
from datetime import datetime, timezone

from src.auth import get_current_user
from src.mongodb import mongo_client, mongo_db
from src.awsS3 import s3, S3_BUCKET_NAME
from src.awsSQS import sqs, SQS_QUEUE_URL
from src.openai import openai_client

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield
    finally:
        mongo_client.close()
        s3.close()
        sqs.close()
        openai_client.close()

        print("Service clients closed")

app_name = os.getenv("APP_NAME", "DRIVE AI RAG Backend")
app = FastAPI(title=app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CLIENT_URL")],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)







@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "message" :  "FastAPI is running"
    }


@app.get("/debug-auth")
def debug_auth(user_id = Depends(get_current_user)):
    return {
        "user_id" : user_id,
        "status" : "ok"
    }


@app.post("/files/upload")
def upload_file(
    file : UploadFile = File(..., alias="files"),
    user_id: str = "123"
):

    s3_key = f"{uuid4()}_{file.filename}"

    s3.upload_fileobj(
        Fileobj = file.file,
        Bucket = S3_BUCKET_NAME,
        Key = s3_key,
        ExtraArgs={
            "ContentType" : file.content_type
        }
    )

    s3_url = f"https://{S3_BUCKET_NAME}.s3.{os.getenv("AWS_REGION")}.amazonaws.com/{s3_key}"

    # presigned_url = s3.generate_presigned_url(
    #     "get_object",
    #     Params={
    #         "Bucket" : S3_BUCKET_NAME,
    #         "Key" : s3_key
    #     },
    #     ExpiresIn = 3600
    # )

    file_document = {
        "owner" : user_id,
        "filename" : file.filename,
        "mimetype" : file.content_type,
        "s3Url" : s3_url,
        "s3Key" : s3_key,
        "uploadedAt" : datetime.now(timezone.utc),
        "status" : "UPLOADED"
    }

    response = mongo_db["files"].insert_one(file_document)

    sqs.send_message(
        QueueUrl=SQS_QUEUE_URL,
        MessageBody=json.dumps({
            "fileId" : str(response.inserted_id),
            "owner" : user_id,
            "s3Key" : s3_key,
            "mimetype" : file.content_type,
            "filename" : file.filename
        })
    )

    return{
        "status" : "success",
        "message" : "File uploaded and metadata saved successfully",
        "filename" : file.filename,
        "file_id" : str(response.inserted_id),
        "s3Url" : s3_url
    }


@app.get("files")
def list_files(user_id : str = Depends(get_current_user)):
    documents = mongo_db["files"].find({"owner" : user_id}).sort("uploadedAt", -1)

    file_list = []

    for doc in documents:
        file_list.append({
            "id" : str(doc["_id"]),
            "filename" : doc["filename"],
            "mimetype" : doc["mimetype"],
            "s3Url" : doc["s3Url"],
            "s3Key" : doc["s3Key"],
            "uploadedAt" : doc["uploadedAt"],
            "status" : doc["status"]
        })

    return {
        "status" : "success",
        "message" : "File list retrieved successfully",
        "file_list" : file_list
    }

