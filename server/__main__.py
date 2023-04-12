import asyncio
from .server import Server


async def main():
    server = Server()
    await server.start()
    while (True):
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
