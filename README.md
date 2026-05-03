💡Built a cloud-native RAG system to chat with large PDF+DOCX+CSV+XLSX+TXT without context-window limits and with far fewer hallucinations.<br>
<br>
This Production style “Chat with Files” system that combines cloud storage + automation (async workers) + RAG to make document Q&A fast, scalable, and reliable.<br>
<br>
🧠 Why this approach?<br>
Traditional LLM chat hits two issues:<br>
• Context window limits → can’t paste huge PDFs into a single prompt<br>
• Hallucinations → answers can be confident but wrong without grounded context<br>
<br>
RAG fixes this by retrieving the most relevant chunks from our documents and providing that evidence to the model, so responses are grounded in our data.<br>
<br>
📥 What happens when a user uploads a file (Ingestion)<br>
• Clerk authenticates the user<br>
• React + TypeScript UI sends file + metadata to an Express.js backend api<br>
• File is stored in Amazon S3 and metadata is stored in MongoDB Atlas<br>
• Backend pushes a job to Amazon SQS (async ingestion trigger)<br>
• Worker polls SQS → downloads file from S3 → extracts text → chunks via LangChain → generates embeddings (Gemini) → stores vectors in MongoDB Atlas Vector Search<br>
<br>
💬 What happens during chat (RAG Query)<br>
• User question → query embedding → vector search in MongoDB Atlas<br>
  Retrieval is pre-filtered by userId + fileId (multi-tenant isolation)<br>
• Top-k relevant chunks are injected into the prompt<br>
• Google Gemini generates the final answer<br>
• Chat history is stored back in MongoDB for continuity<br>
<br>
🔥 Key highlights<br>
• Production-style async pipeline using SQS so that upload API returns fast (no waiting for chunking/embeddings)<br>
• RAG reduces hallucination by grounding responses in retrieved document context<br>
• Pre-filtered similarity search (fileId + userId) → clean, secure multi-tenant retrieval<br>
• Cloud-first design with scalable storage + automated ingestion pipeline<br>
<br>
Below is the cloud architecture diagram I designed for this system
<img width="1680" height="1125" alt="RAG-DRIVE-AI" src="https://github.com/user-attachments/assets/1514f013-c9c3-4976-8b17-59d27704d544" />

