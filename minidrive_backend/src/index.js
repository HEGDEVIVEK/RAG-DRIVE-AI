require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { ObjectId } = require("mongodb");

const { sqs } = require("./aws/sqsClient");
const { SendMessageCommand } = require("@aws-sdk/client-sqs");

const { Upload } = require("@aws-sdk/lib-storage");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("./aws/s3Client");

const { connectMongo, getDb } = require("./mongodb/mongo");

const { clerkMw, requireAuth } = require("./auth/clerk");

const { getVectorStore } = require("./rag/vectorStore");

const { geminiAi } = require("./gemini/geminiClient");

const app = express();

/* -------------------- CORS -------------------- */
const allowedOrigins = [process.env.CLIENT_URL];
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options(/.*/, cors());

/* -------------------- Base middleware -------------------- */
app.use(express.json());
app.use(cookieParser());

/* -------------------- Clerk Auth -------------------- */
app.use(clerkMw);

/* -------------------- File uploads (local temp) -------------------- */
fs.mkdirSync("uploads", { recursive: true });
const upload = multer({ dest: "uploads/" });

/* -------------------- Debug -------------------- */
app.get("/debug-auth", requireAuth(), (req, res) => {
  return res.json({ ok: true, userId: req.auth.userId });
});

/* -------------------- Files list -------------------- */
app.get("/files", requireAuth(), async (req, res) => {
  try {
    const db = getDb();
    const userId = req.auth.userId;

    const files = await db
      .collection("files")
      .find({ owner: userId })
      .sort({ uploadedAt: -1 })
      .toArray();

    res.json(files);
  } catch (e) {
    console.error("LIST ERROR:", e);
    res.status(500).json({ error: "Failed to list files" });
  }
});

/* -------------------- Upload -------------------- */
app.post("/upload", requireAuth(), upload.array("files", 10), async (req, res) => {
  console.log("Upload request received with files:", req.files);

  const db = getDb();
  const userId = req.auth.userId;
  const uploadedFiles = [];

  try {
    if (!req.files?.length) {
      return res.status(400).json({ success: false, error: "No files received" });
    }

    for (const f of req.files) {
   
        const buf = fs.readFileSync(f.path);
        const key = `${uuidv4()}-${f.originalname}`;

        const upload = new Upload({
          client: s3,
          params: {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: buf,
            ContentType: f.mimetype,
          },
        });

        const out = await upload.done();
        const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        const doc = {
          owner: userId,
          filename: f.originalname,
          mimetype: f.mimetype,
          s3Url,
          s3Key: key,
          uploadedAt: new Date(),
          status: "QUEUED",
        };

        const insertRes = await db.collection("files").insertOne(doc);
        const fileId = insertRes.insertedId.toString();

        await sqs.send(
          new SendMessageCommand({
            QueueUrl: process.env.SQS_QUEUE_URL,
            MessageBody: JSON.stringify({
              fileId,
              userId,
              s3Key : key,
              mimetype: f.mimetype,
              filename : f.originalname
            }),
          }),
        );

        try { fs.unlinkSync(f.path); } catch {}
        uploadedFiles.push({ ...doc, _id: fileId });
      } 
    return res.json({ success: true, uploadedFiles });
  } catch (err) {
    console.error("UPLOAD ERROR (outer):", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

/* -------------------- Delete -------------------- */
app.delete("/files/:id/deletefile", requireAuth(), async (req, res) => {
  try {
    const db = getDb();
    const userId = req.auth.userId;
    const fileId = req.params.id;

    const file = await db
      .collection("files")
      .findOne({ _id: new ObjectId(fileId), owner: userId });

    if (!file) return res.status(404).json({ success: false, message: "Not found" });

    await s3.send(new DeleteObjectCommand({Bucket: process.env.S3_BUCKET_NAME, Key: file.s3Key}));
    await db.collection("vector_chunks").deleteMany({ fileId: file._id.toString(), owner: userId });
    await db.collection("files").deleteOne({ _id: file._id, owner: userId});

    res.json({ success: true });
  } catch (e) {
    console.error("DELETE ERROR:", e);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

/* -------------------- Chat with file -------------------- */
app.post("/files/:id/chat", requireAuth(), async (req, res) => {
  try {
    const db = getDb();
    const userId = req.auth.userId;
    const fileId = req.params.id;

    const { question } = req.body;
    if (!question || typeof question !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "question is required" });
    }
    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ success: false, error: "invalid file id" });
    }

    const vectorStore = getVectorStore(db);

    const k = Number(req.body.k || 6);

    const results = await vectorStore.similaritySearch(question, k, {
      preFilter: {
        // Ensure these match the field names in your MongoDB document
        fileId: { $eq: fileId },
        owner: { $eq: userId },
      },
    });

    console.log("Similarity search results:", results);

    // results are LangChain Documents: { pageContent, metadata }
    const contexts = results.map((d, i) => {
      const chunkIndex = d.chunkIndex ?? i;
      return `[#${chunkIndex}] ${d.pageContent}`;
    });

    // 3) Build prompt
    const system = `
You are a helpful assistant. Answer ONLY using the provided context snippets.
If the answer is not in the context, say: "I don't know based on this PDF."
Cite sources like [#chunkIndex] after each claim.
Keep it concise and accurate.
`.trim();

    const prompt = `
${system}

Context:
${contexts.join("\n\n")}

User question:
${question}

Answer:
`.trim();

    // 4) Ask Gemini (text generation)
    const gen = await geminiAi.models.generateContent({
      model: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
      contents: prompt,
    });

    const answer =
      gen?.text ||
      gen?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "";

    return res.json({
      success: true,
      answer,
      sources: results.map((d) => ({
        chunkIndex: d.chunkIndex,
        // optional: you can return small snippets for UI display
        preview: (d.pageContent || "").slice(0, 200),
      })),
    });
  } catch (e) {
    console.error("CHAT ERROR:", e);
    return res.status(500).json({ success: false, error: "chat failed" });
  }
});

/* -------------------- Save chat -------------------- */
app.post("/files/:id/savechat", requireAuth(), async (req, res) => {
  try {
    const db = getDb();
    const userId = req.auth.userId;
    const fileId = req.params.id;
    const { messages } = req.body;

    const chat = await db.collection("chats").insertOne({
      fileId,
      userId,
      messages,
    });

    return res.json({ success: true, chatId: chat.insertedId });
  } catch (e) {
    console.error("SAVE CHAT ERROR:", e);
    return res.status(500).json({ success: false, error: "save chat failed" });
  }
});

app.put("/files/:chatId/updatechat", requireAuth(), async (req, res) => {
  try {
    const db = getDb();
    const userId = req.auth.userId;
    const chatId = new ObjectId(req.params.chatId);

    const { messages} = req.body;

    const result = await db.collection("chats").updateOne(
      { _id: chatId, userId },
      {
        $set: {
          messages,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: "chat not found" });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("PUT CHAT ERROR:", e);
    return res.status(500).json({ success: false, error: "update chat failed" });
  }
});

app.get("/files/:id/getchats", requireAuth(), async (req, res) => {
  try {
    const db = getDb();
    const userId = req.auth.userId;
    const fileId = req.params.id;

    const chat = await db.collection("chats").findOne({
      fileId,
      userId,
    });

    return res.json({ success: true, data: chat || [] });
  } catch (e) {
    console.error("GET CHATS ERROR:", e);
    return res.status(500).json({ success: false, error: "get chats failed" });
  }
});

/* -------------------- Start -------------------- */
const PORT = process.env.PORT || 5000;

connectMongo()
  .then(() => {
    app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error("Mongo connection failed:", e);
    process.exit(1);
  });