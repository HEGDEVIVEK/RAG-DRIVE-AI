from docx.opc.oxml import pr_namespace
from langchain_mongodb import MongoDBAtlasVectorSearch
from src.embeddings import embedding_model
from src.mongodb import mongo_db, mongo_client
from pprint import pprint
from dotenv import load_dotenv
load_dotenv()



vector_store = MongoDBAtlasVectorSearch(
    collection=mongo_db["vector_chunks"],
    embedding=embedding_model,
    index_name="autoembed_index",
    text_key="text",
    embedding_key="embedding",
    relevance_score_fn="cosine",
    auto_create_index=False,
)


def retrieve_relevant_chunks(question, fileId, owner):
    print("Retrieving relevant chunks...")
    print("Query:", question)
    print("File ID:", fileId)
    print("Owner:", owner)
    results = vector_store.similarity_search_with_score(
        query=question,
        k=3,
        oversampling_factor=20,
        pre_filter={
            "metadata.owner":{"$eq": owner},
            "metadata.fileId":{"$eq": fileId},
        }
    )

    matches = []

    for document, score in results:
        matches.append({
            "text": document.page_content,
            "metadata": document.metadata["metadata"],
            "score": score,
        })
    pprint(matches)

    return matches
