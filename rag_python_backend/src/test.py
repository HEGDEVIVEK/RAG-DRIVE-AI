from src.retrieval import retrieve_relevant_chunks
from src.generation import generate_answer
from pprint import pprint


print("Testing retrieval...")
mock_file_id = "6ada9015e5472d7c20ea62c2"
mock_owner = "123"
mock_query = "Where did the Vivek interned?"

results = generate_answer(mock_query, mock_file_id, mock_owner)

pprint(results)
