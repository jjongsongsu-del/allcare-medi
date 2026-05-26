from __future__ import annotations

import asyncio
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from app.db import SessionLocal, init_db
from app.kdca_health_info import seed_health_info_metadata, sync_health_info_details


async def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    init_db()
    with SessionLocal() as db:
        seed_health_info_metadata(db)
        result = await sync_health_info_details(db, limit=limit)
        print(result)


if __name__ == "__main__":
    asyncio.run(main())
