// src/rag/vectorStore.js
const { MongoDBAtlasVectorSearch } = require("@langchain/mongodb");
const { geminiAi } = require("../gemini/geminiClient");


class GeminiEmbeddings {
  async embedDocuments(texts) {
    const vectors = [];
    for (const t of texts) {
      const res = await geminiAi.models.embedContent({
        model: "gemini-embedding-001",
        contents: t,
      });
      vectors.push(res.embeddings[0].values);
    }
    return vectors;
  }

  async embedQuery(text) {
    const res = await geminiAi.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
    });
    return res.embeddings[0].values;
  }
}


/**
 * Build a MongoDB Atlas Vector Search store on top of the "vector_chunks" collection.
 * db = MongoDB db instance from getDb()
 */
function getVectorStore(db) {
  const vecCol = db.collection("vector_chunks");

  return new MongoDBAtlasVectorSearch(new GeminiEmbeddings(), {
    collection: vecCol,
    indexName: process.env.ATLAS_VECTOR_INDEX_NAME,
    textKey: "text",
    embeddingKey: "embedding",
  });
}


module.exports = {
  getVectorStore,
  GeminiEmbeddings, // exported in case worker wants direct embeddings
};