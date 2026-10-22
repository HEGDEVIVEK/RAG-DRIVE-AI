import json
from src.awsSQS import sqs, SQS_QUEUE_URL
from src.awsS3 import s3, S3_BUCKET_NAME

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
            body = json.loads(message["Body"])

            file_id = body["fileId"]
            owner = body["owner"]
            s3_key = body["s3Key"]
            mimetype = body["mimetype"]
            filename = body["filename"]

            print(f"Processing file: {filename}")
        
            s3_response = s3.get_object(
                Bucket = S3_BUCKET_NAME,
                Key = s3_key
            )

            file_content = s3_response['Body'].read()
            print(f"File content length: {(len(file_content))} bytes")
        
if __name__ == "__main__":
    try:
        run_worker()
    except KeyboardInterrupt:
        print("\nWorker stopped.")
    finally:
        sqs.close()