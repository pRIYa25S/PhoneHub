import chromadb
from chromadb import EmbeddingFunction, Documents, Embeddings
from fastembed import TextEmbedding

# 1. Custom Lightweight FastEmbed Function for ChromaDB
class FastEmbedChromaFunction(EmbeddingFunction[Documents]):
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        # Uses lightweight ONNX runtime (<100MB RAM usage)
        self.model = TextEmbedding(model_name=model_name)

    def __call__(self, input: Documents) -> Embeddings:
        # Generates vectors as Python lists
        embeddings_generator = self.model.embed(input)
        return [embedding.tolist() for embedding in embeddings_generator]

# 2. Initialize Chroma Client with Lightweight Embedding Function
chroma_client = chromadb.PersistentClient(path="./chroma_db")
fastembed_ef = FastEmbedChromaFunction()

collection = chroma_client.get_or_create_collection(
    name="phonehub_rag_products", 
    embedding_function=fastembed_ef
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