"""
database.py — PostgreSQL connection setup
=========================================
This file does one job: open and manage the connection to PostgreSQL.

Analogy: if PostgreSQL is a bank vault, this file is the combination
lock mechanism. Every API request gets its own "session" (a temporary
channel to the database), uses it, then closes it cleanly.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Load values from your .env file into environment variables
load_dotenv()

# Build the connection string from .env values
# Format: postgresql://user:password@host:port/database_name
DATABASE_URL = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)

# The "engine" is the actual connection to PostgreSQL.
# pool_pre_ping=True means it checks the connection is alive before using it.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# NEW (safe with any password):
from sqlalchemy.engine import URL 

DATABASE_URL = URL.create(
    drivername = "postgresql+psycopg2",
    username   = os.getenv("DB_USER"),
    password   = os.getenv("DB_PASSWORD"),   # handles @ and special chars safely
    host       = os.getenv("DB_HOST"),
    port       = int(os.getenv("DB_PORT", 5432)),
    database   = os.getenv("DB_NAME"),
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True) 
# SessionLocal is a factory — each time we call SessionLocal()
# we get a fresh database session (like a fresh phone call to the DB).
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Base is the parent class all our ORM models will inherit from.
# SQLAlchemy uses it to track which Python classes = which DB tables.
class Base(DeclarativeBase):
    pass


def get_db():
    """
    FastAPI dependency — automatically opens a DB session for each
    request and closes it when the request finishes (even if it crashes).

    Usage in a route:
        @router.get("/invoices")
        def list_invoices(db: Session = Depends(get_db)):
            return db.query(Invoice).all()
    """
    db = SessionLocal()
    try:
        yield db          # hand the session to the route function
    finally:
        db.close()        # always close, no matter what
