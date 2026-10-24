from bson import ObjectId
from src.mongodb import mongo_db
from fastapi import HTTPException



def file_verifiation(fileId, owner):

    if not ObjectId.is_valid(fileId):
        raise HTTPException(
            status_code=400, 
            detail= "Invalid file ID"
        )

    file_document = mongo_db["files"].find_one({
        "_id" : ObjectId(fileId),
        "owner" : owner
    })

    if file_document is None:
        raise HTTPException(
            status_code=400, 
            detail= "File not found"
        )
    return file_document