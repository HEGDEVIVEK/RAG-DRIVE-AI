from requests_toolbelt.adapters import source
import os
import json
from dotenv import load_dotenv

from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, File, UploadFile, HTTPException
from uuid import uuid4
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from bson import ObjectId

from src.auth import get_current_user
from src.mongodb import mongo_client, mongo_db
from src.awsS3 import s3, S3_BUCKET_NAME
from src.awsSQS import sqs, SQS_QUEUE_URL

from src.generation import generate_answer
from src.fileVerification import file_verifiation


load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield
    finally:
        mongo_client.close()
        s3.close()
        sqs.close()

        print("Service clients closed")

app_name = os.getenv("APP_NAME", "DRIVE AI RAG Backend")
app = FastAPI(title=app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CLIENT_URL")],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)




class ChatRequest(BaseModel):
    fileId: str = Field(min_length=1)
    query: str = Field(min_length=1, max_length=5000)



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
    user_id: str = Depends(get_current_user)
):

    s3key = f"{uuid4()}_{file.filename}"

    s3.upload_fileobj(
        Fileobj = file.file,
        Bucket = S3_BUCKET_NAME,
        Key = s3key,
        ExtraArgs={
            "ContentType" : file.content_type
        }
    )

    s3Url = f"https://{S3_BUCKET_NAME}.s3.{os.getenv("AWS_REGION")}.amazonaws.com/{s3key}"

    file_document = {
        "owner" : user_id,
        "filename" : file.filename,
        "mimetype" : file.content_type,
        "s3Url" : s3Url,
        "s3Key" : s3key,
        "uploadedAt" : datetime.now(timezone.utc),
        "status" : "UPLOADED"
    }

    response = mongo_db["files"].insert_one(file_document)

    sqs.send_message(
        QueueUrl=SQS_QUEUE_URL,
        MessageBody=json.dumps({
            "fileId" : str(response.inserted_id),
            "s3Key" : s3key
        })
    )

    return{
        "status" : "success",
        "message" : "File uploaded and metadata saved successfully",
        "filename" : file.filename,
        "fileId" : str(response.inserted_id),
        "s3Url" : s3Url
    }


@app.get("/files")
def list_files(
    user_id : str = Depends(get_current_user)
):

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


@app.post("/chats/ask")
def ask_question(
    request: ChatRequest,
    user_id: str = Depends(get_current_user)
):

    try:
        file_document = file_verifiation(fileId=request.fileId, owner=user_id)
        valid_fileId = str(file_document["_id"])
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))

    try:
        #Save the user's question in th mongodb before generating the answer
        mongo_db["messages"].insert_one({
            "owner": user_id,
            "fileId": valid_fileId,
            "text": request.query,
            "role" : "user",
            "sources": [],
            "timestamp": datetime.now(timezone.utc),
        })
    except Exception as e:
        print(f"Error saving user question to MongoDB: {e}")
        raise HTTPException(status_code=500, detail= "Failed to save the user question in the database. Please try again")


    try:
        #Generate the answer
        result = generate_answer(question=request.query, fileId=valid_fileId, owner=user_id)
    except Exception as e:
        print(f"Error generating answer: {e}")
        raise HTTPException(status_code=500, detail= "User question is saved but failed to generate the answer. Please try again")

    
    #Svaing the LLM answer in the database
    try:
        mongo_db["messages"].insert_one({
            "owner": user_id,
            "fileId": valid_fileId,
            "text": result["answer"],
            "role" : "assistant",
            "sources": result["sources"], 
            "timestamp": datetime.now(timezone.utc)
        })
    except Exception as e:
        print(f"Error saving LLM answer to MongoDB: {e}")
        raise HTTPException(status_code=500, detail= "Failed to save the LLM answer in the database. Please try again")

    return {
        "status" : "success",
        "fileId" : valid_fileId,
        "message" : {
            "id" : valid_fileId,
            "role" : "assistant",
            "text" : result["answer"],
            "sources" : result["sources"],
            "timestamp": datetime.now(timezone.utc)
        }
    }


@app.get("/{fileId}/getchats")
def get_chats(
    fileId : str, 
    user_id : str = Depends(get_current_user)
):
    try:
        file_document = file_verifiation(fileId=fileId, owner=user_id)
        valid_fileId = str(file_document["_id"])
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))

    try:
        messages = mongo_db["messages"].find({
            "fileId": valid_fileId,
            "owner": user_id
        }).sort("timestamp", 1)

        print(messages)

        chat_history = []
        for msg in messages:
            clean_msg = {
                "id": str(msg["_id"]),
                "role": msg.get("role"),
                "text": msg.get("text"),
                "timestamp": msg.get("timestamp").isoformat(),
                "sources": msg.get("sources", [])
            }
            chat_history.append(clean_msg)

        print(chat_history)

        return {
            "status": "success",
            "fileId": valid_fileId,
            "messages": chat_history
        }

    except Exception as e:
        print(f"Error fetching chat history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chat history")


@app.delete("/{fileId}/deletefile")
def delete_file(
    fileId : str, 
    user_id : str = Depends(get_current_user)
):
    try:
        file_document = file_verifiation(fileId=fileId, owner=user_id)
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))

    try:
        s3.delete_object(
            Bucket = S3_BUCKET_NAME,
            Key = file_document["s3Key"]
        )

        mongo_db["files"].delete_one({
            "_id": file_document["_id"],
            "owner": user_id
        })

        mongo_db["vector_chunks"].delete_many({
            "metadata.fileId":str(file_document["_id"]),
            "metadata.owner": user_id
        })

        mongo_db["messages"].delete_many({
            "fileId":str(file_document["_id"]),
            "owner": user_id
        })

        return {
            "status": "success",
            "message": "File deleted successfully in s3 and mongodb"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

        

    