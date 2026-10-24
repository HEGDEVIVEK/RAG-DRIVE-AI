import json
from bson import ObjectId

from src.awsSQS import sqs, SQS_QUEUE_URL
from src.awsS3 import s3, S3_BUCKET_NAME
from src.mongodb import mongo_db, mongo_client

from src.textExtractor import extract_text
from src.textSplitter import create_chunks
from src.embeddings import create_embedding



def run_worker():

    print("Worker started, waiting for file...")

    while True:
        response = sqs.receive_message(
            QueueUrl=SQS_QUEUE_URL,
            MaxNumberOfMessages=1,
            WaitTimeSeconds=20,
            VisibilityTimeout=300
        )

        messages = response.get("Messages", [])

        for message in messages:
            try:
                #1. Extract Message from Queue
                body = json.loads(message["Body"])
                file_id = body["fileId"]
                s3_key = body["s3Key"]
                print(f"#1. SQS file: {s3_key}")


                #2. Fetching details for the file from the MongoDB
                file_document = mongo_db["files"].find_one({"_id" : ObjectId(file_id)})
                owner = file_document["owner"]
                filename = file_document["filename"]
                mimetype = file_document["mimetype"]
                print(f"#2. MongoDB, File ID: {file_id}")

                if file_document is None or file_document["s3Key"] != s3_key or file_document["status"] == "COMPLETED":
                    print(f"Missing file record or S3 key mismatch or file already processed: {file_id}")
                    sqs.delete_message(
                        QueueUrl=SQS_QUEUE_URL,
                        ReceiptHandle=message["ReceiptHandle"]
                    )
                    continue


                #3. Update the file status in the mongodb
                mongo_db["files"].update_one(
                    {"_id": ObjectId(file_id)},
                    {"$set": {"status": "PROCESSING"}}
                )
                print(f"#3. Updated status to PROCESSING")


                #4. Downloading file from S3
                s3_response = s3.get_object(
                    Bucket = S3_BUCKET_NAME,
                    Key = s3_key
                )
                try:
                    file_content = s3_response['Body'].read()
                finally:
                    s3_response['Body'].close()
                    print(f"#4. Downloaded file from S3, File Content: {(len(file_content))} bytes")


                #5. Reading the file content and saving the data into extracted_pages list
                extracted_sections = extract_text(file_content, filename)
                print(f"#5. Extracted {len(extracted_sections)} sections")


                #6. Splitting the extracted content into smaller chunks
                chunks = create_chunks(extracted_sections, file_id, owner, filename, mimetype)
                print(f"#6. Created {len(chunks)} chunks")


                #7. Creatting Embeddings for each chunks
                chunks = create_embedding(chunks)
                print(f"#7. Created embeddings for {len(chunks)} chunks")


                #8. Inserting chunks into MongoDB
                result = mongo_db["vector_chunks"].insert_many(chunks)
                print(f"#8. Saved {len(result.inserted_ids)} chunks")


                #9. Update the file status in the mongodb
                mongo_db["files"].update_one(
                    {"_id": ObjectId(file_id)},
                    {"$set": {"status": "COMPLETED"}}
                )
                print(f"#9. Updated status to COMPLETED")


                #10. Delete message from SQS
                sqs.delete_message(
                    QueueUrl=SQS_QUEUE_URL,
                    ReceiptHandle=message["ReceiptHandle"]
                )
                print(f"#10. Deleted message from SQS")

            except Exception as e:
                print(f"Error processing file {file_id}: {str(e)}")

            finally:
                sqs.close()
                s3.close()
                mongo_client.close()
                    

                
   
        
if __name__ == "__main__":
    try:
        run_worker()
    except KeyboardInterrupt:
        print("\nWorker stopped.")
    finally:
        sqs.close()