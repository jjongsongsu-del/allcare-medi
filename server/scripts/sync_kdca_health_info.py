from __future__ import annotations

import asyncio
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from app.db import SessionLocal, init_db
from app.kdca_health_info import build_health_info_url, seed_health_info_metadata, sync_health_info_details


async def main() -> None:
    args = sys.argv[1:]
    limit = int(args[0]) if args and args[0].isdigit() else None
    init_db()
    with SessionLocal() as db:
        seed_health_info_metadata(db)
        print(f"KDCA sample URL: {build_health_info_url('6')}")
        result = await sync_health_info_details(db, limit=limit)
        print(result)


if __name__ == "__main__":
    asyncio.run(main())
