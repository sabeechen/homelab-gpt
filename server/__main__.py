import asyncio
import os
import os.path
from .server import Server
from .database import SQLiteDB
from .database_classes import User, Chat


async def main():
    data_path = os.environ.get("DATA_PATH") or "/data"
    database = SQLiteDB(os.path.join(data_path, "data.sqlite"))
    await database.create_database([User, Chat])
    server = Server(database)
    await server.start()
    while (True):
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
