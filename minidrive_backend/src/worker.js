// src/worker.js
require("dotenv").config();

const { ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { sqs } = require("./aws/sqsClient");

const { s3 } = require("./aws/s3Client");

const { connectMongo, getDb } = require("./mongodb/mongo");
const { ObjectId } = require("mongodb");

const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");

const { getVectorStore } = require("./rag/vectorStore");
const {downloadAndExtractText} = require("./utils/textExtraction");

let db;

const sleep2s = () => new Promise((r) => setTimeout(r, 2000));


async function pollOnce() {
  const resp = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10,
      VisibilityTimeout: 300,
    })
  );

  console.log("SQS receive:", {
hasMessages: !!resp.Messages?.length,
count: resp.Messages?.length || 0,
});

  const msg = resp.Messages?.[0];
  console.log("message is", msg);
  if (!msg) return;

  let body;
  try {
    body = JSON.parse(msg.Body);
  } catch {
    return;
  }

  const { fileId, userId, s3Key, mimetype, filename} = body;
  if (!fileId || !userId || !s3Key || !mimetype || !filename) return;
  if (!ObjectId.isValid(fileId)) return;

  const filesCol = db.collection("files");
  const vecCol = db.collection("vector_chunks");

  // start status
  await filesCol.updateOne(
    { _id: new ObjectId(fileId), owner: userId },
    { $set: { status: "PROCESSING" } }
  );

  console.log("calling download and extract")
  // download + extract
  const { text } = await downloadAndExtractText({
    s3Client: s3,
    bucket: process.env.S3_BUCKET_NAME,
    s3Key,
    filename,
    mimeType: mimetype,
  });

  console.log("Extracted text length:", { fileId, length: text})

  // chunk
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 150,
  });

  const docs = await splitter.createDocuments([text], [{ fileId, owner: userId }]);


 const vectorStore = getVectorStore(db);
  
  await vecCol.deleteMany({ fileId, "owner": userId });

  await vectorStore.addDocuments(
    docs.map((d, i) => ({
      pageContent: d.pageContent,
      metadata: { ...d.metadata, chunkIndex: i },
    }))
  );

  await filesCol.updateOne(
    { _id: new ObjectId(fileId), owner: userId },
    { $set: { status: "READY" } }
);

  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      ReceiptHandle: msg.ReceiptHandle,
    })
  );

  console.log("Indexed:", { fileId, chunks: docs.length });
}

async function run() {
  await connectMongo();
  db = getDb();

  console.log("Worker started. Polling SQS...");
  while (true) {
    try {
      await pollOnce();
    } catch (e) {
      console.error("Worker error:", e?.message || e);
      await sleep2s();
    }
  }
}

run();