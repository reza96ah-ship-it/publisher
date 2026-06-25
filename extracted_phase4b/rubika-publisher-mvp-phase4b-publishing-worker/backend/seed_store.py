import os
import sys

# Add the project root to the Python path
sys.path.append("/app")

from app.database import SessionLocal
from app.models import Store
from datetime import datetime

def seed():
    db = SessionLocal()
    try:
        # Check if store exists
        store = db.query(Store).first()
        if not store:
            print("Creating test store...")
            store = Store(
                name="فروشگاه تستی نشرینو",
                category="پوشاک",
                description="این یک فروشگاه تستی است",
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(store)
            db.commit()
            print("Store created successfully!")
        else:
            print("Store already exists.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
