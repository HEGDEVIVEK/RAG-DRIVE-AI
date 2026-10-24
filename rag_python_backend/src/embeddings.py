from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings

load_dotenv()

embedding_model = OpenAIEmbeddings(
    model="text-embedding-3-small",
    dimensions=1536,
)


def create_embedding(chunks):
    for chunk in chunks:
        vectors = embedding_model.embed_documents([chunk["text"]])

        chunk["embedding"] = vectors[0]
        chunk["embeddingModel"] = embedding_model.model

    return chunks