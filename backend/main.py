import os
from dotenv import load_dotenv
from vector_store import sync_products_to_vector_store

# Load environment variables from .env BEFORE loading agent modules
load_dotenv()

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select, text
from pydantic import BaseModel
from typing import List, Optional
import jwt
import datetime

from database import engine, Product, User
from agent import get_agent_response

app = FastAPI(title="PhoneHub E-Commerce Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "phonehub-super-secret-key-change-in-production"

class CartItemInput(BaseModel):
    id: int
    quantity: int

class CheckoutRequest(BaseModel):
    items: List[CartItemInput]

class ChatMessage(BaseModel):
    sender: str
    text: str

class ChatRequest(BaseModel):
    history: List[ChatMessage]

class AuthRequest(BaseModel):
    username: str
    email: Optional[str] = None
    password: str

def seed_database():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        try:
            session.exec(text("ALTER TABLE product ADD COLUMN image_url VARCHAR"))
            session.commit()
        except Exception:
            pass

        session.exec(text("DELETE FROM product"))
        session.commit()

        items = [
            # Phones
            Product(name="PhoneHub Pro 15", category="phone", price=79999.00, stock_quantity=15, description="Flagship smartphone with 120Hz OLED screen and triple camera.", specs="6.7 inch OLED, 256GB, 5000mAh, 5G", image_url="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&auto=format&fit=crop"),
            Product(name="PhoneHub Lite A1", category="phone", price=29999.00, stock_quantity=25, description="Affordable performance phone with long battery life.", specs="6.1 inch LCD, 128GB, 4500mAh, 4G", image_url="https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500&auto=format&fit=crop"),
            Product(name="PhoneHub Fold X", category="phone", price=119999.00, stock_quantity=8, description="Next-gen foldable display with dual screens.", specs="7.6 inch Foldable AMOLED, 512GB, 4800mAh", image_url="https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=500&auto=format&fit=crop"),
            Product(name="PhoneHub Mini 13", category="phone", price=49999.00, stock_quantity=12, description="Compact size with full flagship power.", specs="5.4 inch OLED, 128GB, 3800mAh", image_url="https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500&auto=format&fit=crop"),
            Product(name="PhoneHub Ultra Max", category="phone", price=99999.00, stock_quantity=10, description="Ultimate power user phone with 200MP camera and stylus.", specs="6.8 inch AMOLED, 512GB, 5500mAh, S-Pen", image_url="https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=500&auto=format&fit=crop"),
            Product(name="PhoneHub Edge Z", category="phone", price=64999.00, stock_quantity=14, description="Curved display smartphone with ceramic back.", specs="6.5 inch Curved OLED, 256GB, 4700mAh", image_url="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80"),
            Product(name="PhoneHub Gaming Red", category="phone", price=72999.00, stock_quantity=9, description="High refresh rate gaming phone with shoulder triggers.", specs="6.78 inch 165Hz AMOLED, 256GB, RGB Light", image_url="https://images.unsplash.com/photo-1533228876829-65c94e7b5025?w=500&auto=format&fit=crop"),

            # Accessories
            Product(name="Wireless Audio Buds", category="accessory", price=9999.00, stock_quantity=50, description="Active noise cancelling wireless earbuds.", specs="Bluetooth 5.3, 30hr total battery, IPX4", image_url="https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop"),
            Product(name="Fast Charger 65W", category="accessory", price=2499.00, stock_quantity=40, description="Dual-port USB-C fast charging wall adapter.", specs="USB-C PD 3.0, GaN Tech, 65W Max", image_url="https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500&auto=format&fit=crop"),
            Product(name="Magnetic Power Bank 10k", category="accessory", price=3999.00, stock_quantity=30, description="Wireless magnetic fast-charging power bank.", specs="15W Wireless, 20W Wired PD, LED indicator", image_url="https://images.unsplash.com/photo-1609592424009-17242194ff72?w=500&auto=format&fit=crop"),
            Product(name="Ultra Armor Case", category="accessory", price=1499.00, stock_quantity=60, description="Heavy-duty shockproof protective phone case.", specs="Military Grade Drop Protection, Matte Finish", image_url="https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=500&auto=format&fit=crop"),
            Product(name="Over-Ear Pro Headphones", category="accessory", price=15999.00, stock_quantity=20, description="Premium spatial audio headphones with deep bass.", specs="ANC, 40hr battery, Memory Foam Cushions", image_url="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop"),
            Product(name="Fast Mag-Safe Car Mount", category="accessory", price=2799.00, stock_quantity=45, description="Vent-mounted wireless charging phone holder.", specs="15W Qi Fast Charge, Strong Neodymium Magnets", image_url="https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=500&auto=format&fit=crop"),
            Product(name="USB-C Braided Cable 2M", category="accessory", price=1199.00, stock_quantity=80, description="Durable nylon braided high-speed charging cable.", specs="100W PD Support, 480Mbps Data Transfer", image_url="https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=500&auto=format&fit=crop"),
            Product(name="Desktop Wireless Stand", category="accessory", price=3199.00, stock_quantity=22, description="3-in-1 charging station for phone, watch, and buds.", specs="15W Fast Wireless, Aluminum Finish", image_url="https://images.unsplash.com/photo-1616440342955-59c2356c367b?w=500&auto=format&fit=crop"),

            # Wearables
            Product(name="PhoneHub Watch Ultra", category="wearable", price=19999.00, stock_quantity=18, description="Smartwatch with heart rate monitor and GPS tracking.", specs="AMOLED Touch Display, 7-Day Battery, 50m Water Resistant", image_url="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop"),
            Product(name="Fitness Band 5", category="wearable", price=3999.00, stock_quantity=35, description="Lightweight health tracker with sleep analysis.", specs="OLED Screen, 14-Day Battery, SpO2 Monitoring", image_url="https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=500&auto=format&fit=crop"),
            Product(name="Smart Ring Pro", category="wearable", price=15999.00, stock_quantity=10, description="Titanium smart ring for discreet biometric monitoring.", specs="Titanium frame, 5-Day Battery, Sleep & HRV tracking", image_url="https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&auto=format&fit=crop"),
            Product(name="VR Headset Lite", category="wearable", price=23999.00, stock_quantity=7, description="Standalone mobile VR headset for immersive media.", specs="4K Display, Motion Controllers, 64GB Storage", image_url="https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=500&auto=format&fit=crop"),
            Product(name="Smart Audio Glasses", category="wearable", price=12999.00, stock_quantity=12, description="Frames with open-ear directional speakers.", specs="Polarized Lenses, 6hr Audio, Touch Control", image_url="https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&auto=format&fit=crop"),
            Product(name="Sport Watch Active", category="wearable", price=13999.00, stock_quantity=15, description="Rugged smartwatch designed for outdoor running & hiking.", specs="Built-in GPS, Altimeter, Sapphire Crystal Glass", image_url="https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500&auto=format&fit=crop"),
            Product(name="Sleep Tracker Band", category="wearable", price=5999.00, stock_quantity=28, description="Fabric strap focused purely on recovery & deep sleep metrics.", specs="No screen, 2-Week Battery, Skin Temp Sensor", image_url="https://images.unsplash.com/photo-1510017803434-a899398421b3?w=500&auto=format&fit=crop")
        ]
        session.add_all(items)
        session.commit()

@app.on_event("startup")
def on_startup():
    seed_database()
    # Embed SQL items into ChromaDB vector database for RAG
    with Session(engine) as session:
        all_products = session.exec(select(Product)).all()
        sync_products_to_vector_store(all_products)

@app.get("/api/products", response_model=List[Product])
def get_products():
    with Session(engine) as session:
        return session.exec(select(Product)).all()

@app.post("/api/register")
def register(data: AuthRequest):
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == data.username)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        user = User(username=data.username, email=data.email or "", password_hash=data.password)
        session.add(user)
        session.commit()
        session.refresh(user)
        
        token = jwt.encode(
            {"sub": user.username, "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)},
            SECRET_KEY, algorithm="HS256"
        )
        return {"username": user.username, "token": token}

@app.post("/api/login")
def login(data: AuthRequest):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == data.username)).first()
        if not user or user.password_hash != data.password:
            raise HTTPException(status_code=400, detail="Invalid credentials")
        token = jwt.encode(
            {"sub": user.username, "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)},
            SECRET_KEY, algorithm="HS256"
        )
        return {"username": user.username, "token": token}

@app.post("/api/checkout")
def checkout(request: CheckoutRequest, authorization: Optional[str] = Header(None)):
    with Session(engine) as session:
        for item in request.items:
            product = session.get(Product, item.id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product ID {item.id} not found")
            if product.stock_quantity < item.quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")
            product.stock_quantity -= item.quantity
            session.add(product)
        session.commit()
    return {"message": "Checkout successful!"}

@app.post("/api/chat")
def chat(request: ChatRequest):
    try:
        reply = get_agent_response([m.dict() for m in request.history])
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))