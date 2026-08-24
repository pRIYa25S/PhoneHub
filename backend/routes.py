from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from typing import List
from pydantic import BaseModel

from database import get_session
from models import Product
from agent import get_ai_response

router = APIRouter()

# Request model for AI Chat
class ChatRequest(BaseModel):
    message: str

# Request model for Product creation
class ProductCreate(BaseModel):
    name: str
    category: str
    price: float
    stock_quantity: int
    description: str = ""
    specs: str = ""

# --- Product Endpoints ---

@router.get("/products", response_model=List[Product])
def get_products(session: Session = Depends(get_session)):
    """Fetch all products from the store inventory."""
    products = session.exec(select(Product)).all()
    return products

@router.get("/products/{product_id}", response_model=Product)
def get_product(product_id: int, session: Session = Depends(get_session)):
    """Fetch a single product by ID."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("/products", response_model=Product)
def create_product(product_data: ProductCreate, session: Session = Depends(get_session)):
    """Add a new product to the database."""
    product = Product(**product_data.dict())
    session.add(product)
    session.commit()
    session.refresh(product)
    return product

# --- AI Chat Assistant Endpoint ---

@router.post("/chat")
def chat_endpoint(request: ChatRequest):
    """Handles incoming chat messages and generates responses via Groq AI agent."""
    reply_text = get_ai_response(request.message)
    return {"reply": reply_text}