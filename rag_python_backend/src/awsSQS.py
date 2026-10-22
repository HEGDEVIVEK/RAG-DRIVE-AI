import os

import boto3
from dotenv import load_dotenv

load_dotenv()

SQS_QUEUE_URL = os.environ["SQS_QUEUE_URL"]

sqs = boto3.client(
    "sqs",
    region_name=os.environ["AWS_REGION"],
    aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
)

sqs.get_queue_attributes(
    QueueUrl=SQS_QUEUE_URL,
    AttributeNames=["QueueArn"],
)

print("SQS queue access verified successfully")