import openai
import asyncio
import os
from .server import Server

async def main():
    server = Server()
    await server.start()
    while(True):
        await asyncio.sleep(1)

if __name__ == "__main__":
    api_key = os.getenv("OPENAI_API_KEY")
    openai.api_key = api_key
    asyncio.run(main())
