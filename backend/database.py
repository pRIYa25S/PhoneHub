from sqlmodel import SQLModel, Field, create_engine
from typing import Optional

sqlite_url = "sqlite:///./phonehub.db"
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    category: str
    price: float
    stock_quantity: int
    description: str
    specs: str
    image_url: Optional[str] = None

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str
    password_hash: str