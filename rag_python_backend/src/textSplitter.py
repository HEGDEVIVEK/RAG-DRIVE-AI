
from langchain_text_splitters import RecursiveCharacterTextSplitter

text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len
            )


def create_chunks(extracted_sections, file_id, owner, filename, mimetype):
    
            chunks = []

            for section in extracted_sections:
                texts_chunks = text_splitter.split_text(section["text"])

                for text_chunk in texts_chunks:
                    chunks.append({
                        "text": text_chunk,
                        "metadata" : {
                            **section["metadata"],
                            "owner" : owner,
                            "fileId" : file_id,
                            "filename" : filename,
                            "mimetype" : mimetype,
                            "chunkIndex" : len(chunks)
                        } 
                    })

            return chunks
