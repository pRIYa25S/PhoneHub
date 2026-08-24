import chromadb
from chromadb.utils import embedding_functions

# Initialize local persistent vector store
chroma_client = chromadb.PersistentClient(path="./chroma_db")
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

collection = chroma_client.get_or_create_collection(
    name="phonehub_rag_products", 
    embedding_function=sentence_transformer_ef
)

def sync_products_to_vector_store(products):
    """Generates vector embeddings for all products and saves to ChromaDB."""
    if not products:
        return

    documents = []
    metadatas = []
    ids = []

    for p in products:
        doc_text = f"Product: {p.name} | Category: {p.category} | Price: ₹{p.price} | Stock: {p.stock_quantity} | Specs: {p.specs} | Description: {p.description}"
        documents.append(doc_text)
        metadatas.append({"id": p.id, "name": p.name})
        ids.append(str(p.id))

    collection.upsert(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )

def retrieve_rag_context(user_query: str, n_results: int = 3) -> str:
    """Performs semantic vector search against user prompt."""
    results = collection.query(
        query_texts=[user_query],
        n_results=n_results
    )
    if results and results['documents'] and results['documents'][0]:
        return "\n".join(results['documents'][0])
    return "No matching products found in vector index."