import os
from google import genai
from google.genai import types
from vector_store import retrieve_rag_context

def get_agent_response(history: list) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Error: GEMINI_API_KEY environment variable is not configured."

    client = genai.Client(api_key=api_key)

    # 1. RAG RETRIEVAL: Search vector DB for semantic matches relative to user prompt
    latest_query = history[-1]["text"] if history else ""
    retrieved_context = retrieve_rag_context(latest_query, n_results=3)

    # 2. RAG AUGMENTATION: Inject retrieved vector matches into system instruction
    system_instruction = f"""
    You are the PhoneHub AI Assistant, an expert e-commerce helper.
    Answer customer questions politely, accurately, and concisely.
    All product prices MUST be referenced in Indian Rupees (₹).

    RELEVANT PRODUCT DATA RETRIEVED FROM VECTOR DATABASE:
    {retrieved_context}

    Guidelines:
    1. Base your recommendations on the retrieved product vector context above.
    2. Check stock availability before recommending products.
    3. Keep answers clear, friendly, and structured.
    """

    contents = []
    for msg in history:
        role = "user" if msg["sender"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["text"]}]})

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=system_instruction)
        )
        return response.text
    except Exception as e:
        return f"Error communicating with AI model: {str(e)}"