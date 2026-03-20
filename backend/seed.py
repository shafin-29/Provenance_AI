import asyncio
from datetime import datetime, timezone
from prisma import Prisma

async def main():
    # Initialize the Prisma client
    db = Prisma()
    
    # Connect directly to the database
    print("Connecting to Neon PostgreSQL...")
    await db.connect()
    print("Connected successfully!")

    # Insert a dummy SourceRecord
    print("Inserting dummy SourceRecord...")
    record = await db.sourcerecord.create(
        data={
            "sourceId": "dummy_ingestion_file.pdf",
            "contentHash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
            "versionTs": datetime.now(timezone.utc),
            "pipelineId": "setup_pipeline",
        }
    )

    print(f"\n✅ Seed successful! Inserted SourceRecord:")
    print(f"ID: {record.id}")
    print(f"Source ID: {record.sourceId}")
    print(f"Hash: {record.contentHash}")
    
    # Disconnect
    await db.disconnect()
    print("\nDatabase connection closed.")

if __name__ == '__main__':
    asyncio.run(main())
