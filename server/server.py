import aiohttp.web as web
import os
import openai
import asyncio
import json
import threading
import uuid
import tiktoken
from typing import Union, Dict, List
from dataclasses import dataclass
from .database import SQLiteDB
from .database_classes import User as DBUSer, Chat as DBChat
from .dataclass_encoder import CustomJSONTransformer
from uuid import uuid4

GPT3 = 'gpt-3.5-turbo'
GPT4 = 'gpt-4'
GPT4_32K = 'gpt-4-32k'


@dataclass
class OpenAiModel:
    value: str
    label: str
    token_cost_completion: float
    token_cost_prompt: float
    maxTokens: int
    encoding: tiktoken.Encoding

    def tokenCount(self, content: Union[str, Dict[str, str],  List[Dict[str, str]]]) -> int:
        if isinstance(content, str):
            return len(self.encoding.encode(content))
        if isinstance(content, dict):
            total = 0
            for key in content.keys():
                total += self.tokenCount(key) + self.tokenCount(content[key])
            return total
        if isinstance(content, list):
            total = 0
            for item in content:
                total += self.tokenCount(item)
            return total
        return 0


MODELS: Dict[str, OpenAiModel] = {
    GPT3: OpenAiModel(GPT3, "GPT3💲", 0.002 / 1000, 0.002 / 1000, 1024 * 4 - 1, tiktoken.encoding_for_model(GPT3)),
    GPT4: OpenAiModel(GPT4, "GPT4💵", 0.06 / 1000, 0.03 / 1000, 1024 * 8 - 1, tiktoken.encoding_for_model(GPT4)),
    GPT4_32K: OpenAiModel(GPT4_32K, "GPT4-32K💰", 0.012 / 1000, 0.06 /
                          1000, 1024 * 32 - 1, tiktoken.encoding_for_model(GPT4_32K))
}

DEFAULT_SYSTEM_MESSAGE = "You are a helpful and concise assistant."


def chat_stream_wrapper(api_key: str, **kwargs):  # Your wrapper for async use
    openai.api_key = api_key
    response = openai.ChatCompletion.create(stream=True, **kwargs)
    collected_chunks = []
    collected_messages = []
    for chunk in response:
        collected_chunks.append(chunk)  # save the event response
        chunk_message = chunk['choices'][0]['delta']  # extract the message
        collected_messages.append(chunk_message)  # save the message
        full_reply_content = ''.join(
            [m.get('content', '') for m in collected_messages])
        yield {
            "finish_reason": chunk['choices'][0]['finish_reason'],
            "content": full_reply_content
        }


async def async_iterable(blocking_method, *args, **kwargs):
    for result in await asyncio.to_thread(blocking_method, *args, **kwargs):
        yield result


class ChatStreamManager():
    def __init__(self, ws: web.WebSocketResponse):
        self._ws = ws
        self._read_task = None
        self._write_task = None
        self._read_thread: threading.Thread | None = None
        self._write_queue = asyncio.Queue(1000)
        self._run = True
        self._stopwriting = False
        self._stop = asyncio.Event()
        self.id = str(uuid.uuid4())

    async def start(self):
        self._read_task = asyncio.create_task(self.handleReading())
        self._write_task = asyncio.create_task(self.handleWriting())

    async def handleReading(self):
        async for msg in self._ws:
            if not self._run:
                return
            if msg.data == 'cancel':
                await self.stop()
                continue
            await self.handle_chat(json.loads(msg.data))

    async def handleWriting(self):
        while not self._stopwriting:
            msg = await self._write_queue.get()
            await self._ws.send_str(msg)

    async def _handle_write(self, data):
        # TODO: consider emptying the queue
        await self._write_queue.put(data)

    def _getModel(self, model: str):
        return MODELS.get(model, MODELS.get(GPT4))

    async def handle_chat(self, data):
        prompt = data.get('prompt', DEFAULT_SYSTEM_MESSAGE)
        if len(prompt) == 0:
            prompt = DEFAULT_SYSTEM_MESSAGE
        messages = data['messages']
        model = data.get('model', GPT3)
        max_tokens = data['max_tokens']
        message_start = data.get("continuation", "")
        api_key = data.get("api_key", os.environ.get('OPENAI_API_KEY'))
        if len(api_key) == 0:
            api_key = os.environ.get('OPENAI_API_KEY')
        # Format a chat request to the OpenAI API
        api_messages: List[Dict[str, str]] = [
            {"role": "system", "content": prompt}]
        model_data = self._getModel(model)
        temperature = data.get('temperature', 1.0)
        for message in messages:
            api_message = {
                "role": message.get("role", "user"),
                "content": message.get("message", "")
            }
            api_messages.append(api_message)
        self._read_thread = threading.Thread(target=self.request_chat, args=(message_start, model_data, asyncio.get_event_loop(), api_key), kwargs={
                                             'model': model, 'messages': api_messages, 'temperature': temperature, 'max_tokens': max_tokens})
        self._read_thread.start()

    def request_chat(self, message_start: str, model_data: OpenAiModel, loop, api_key: str, **kwargs):
        prompt_tokens = model_data.tokenCount(
            json.dumps(kwargs["messages"], separators=(',', ':')))

        max_allowed = model_data.maxTokens - prompt_tokens
        if (kwargs['max_tokens'] > max_allowed):
            kwargs['max_tokens'] = max_allowed
        completion_tokens = 0
        if (len(message_start) > 0):
            message_start += " "
        last_message = {
            'cost_tokens_completion': completion_tokens,
            'cost_tokens_prompt': prompt_tokens,
            'cost_usd': prompt_tokens * model_data.token_cost_prompt + completion_tokens * model_data.token_cost_completion,
            'message': message_start,
            'finish_reason': None,
            'id': self.id,
            'role': 'assistant'
        }
        try:
            for chunk in chat_stream_wrapper(api_key, **kwargs):
                if not self._run:
                    return
                completion_tokens += 1
                last_message = {
                    'cost_tokens_completion': completion_tokens,
                    'cost_tokens_prompt': prompt_tokens,
                    'cost_usd': prompt_tokens * model_data.token_cost_prompt + completion_tokens * model_data.token_cost_completion,
                    'message': message_start + chunk['content'],
                    'finish_reason': chunk['finish_reason'],
                    'id': self.id,
                    'role': 'assistant'
                }
                task = asyncio.run_coroutine_threadsafe(
                    self._handle_write(json.dumps(last_message)), loop)
                task.result()
        except Exception as e:
            last_message["error"] = str(e)
            asyncio.run_coroutine_threadsafe(
                self._handle_write(json.dumps(last_message)), loop)
        finally:
            asyncio.run_coroutine_threadsafe(self.stop(), loop)

    async def stop(self, error=None):
        self._stop.set()
        self._run = False
        if self._read_thread is not None:
            self._read_thread.join()
        if self._read_task is not None:
            self._read_task.cancel()
            await self._read_task
        self._stopwriting = True
        for i in range(10):
            if not self._write_queue.empty():
                await asyncio.sleep(200)
            else:
                break
        if self._write_task:
            self._write_task.cancel()
            await self._write_task
        await self._ws.close()

    async def closed(self):
        await self._stop.wait()


# An aiohttp server class that serves the files in the "static" directory
# and handles the chat API endpoint
class Server():
    def __init__(self, database: SQLiteDB):
        self.db = database
        self.transformer = CustomJSONTransformer()

    async def start(self):
        app = web.Application()
        app.add_routes([
            web.static('/static', self.get_path('static'), show_index=False),
            web.get('/', self.index),
            web.get('/sw.js', self.sw),
            web.get('/workbox-d249b2c8.js', self.wb),
            web.get('/manifest.json', self.manifest),
            web.get('/api/initialize', self.initialize),
            web.post('/api/chats', self.get_chats),
            web.post('/api/chat', self.save_chat),
            web.get('/api/chat/{id}', self.query_chat),
            web.get('/api/user/add/{name}', self.add_user),
            web.delete('/api/chat/{id}', self.delete_chat),
            web.get('/api/ws/chat', self.websocket_stream_handler),
        ])
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", int(os.environ.get("PORT", 80)))
        await site.start()
        print("Server Started")

    # takes in a path and returns the fully qualified path relative to this file
    def get_path(self, path):
        return os.path.join(os.path.dirname(os.path.realpath(__file__)), path)

    async def index(self, req: web.Request):
        return web.FileResponse(self.get_path('static/index.html'))

    async def sw(self, req: web.Request):
        return web.FileResponse(self.get_path('sw.js'))

    async def wb(self, req: web.Request):
        return web.FileResponse(self.get_path('workbox-d249b2c8.js'))

    async def manifest(self, req: web.Request):
        return web.json_response({
            "name": "AI Chat",
            "short_name": "AI Chat",
            "theme_color": "#000000",
            "background_color": "#000000",
            "display": "standalone",
            "scope": "/",
            "start_url": "/",
            "description": "AI Chat with GPT",
            "orientation": "any",
            "icons": [
                {
                    "src": "static/logo.png",
                    "sizes": "1024x1024"
                }
            ]
        })

    async def initialize(self, req: web.Request):
        data = {
            "models": list(MODELS.values()),
            "users": await self.db.get_all(DBUSer)
        }
        return web.json_response(data, dumps=self.transformer.to_json)

    async def get_chats(self, req: web.Request):
        query = await req.json()
        data = {
            "chats": await self.db.find(DBChat, fields=DBChat.REQUIRED, user_id=query['user_id'])
        }
        return web.json_response(data, dumps=self.transformer.to_json)

    async def save_chat(self, req: web.Request):
        info = await req.json()
        info['data'] = json.dumps(info["messages"])
        info['settings'] = json.dumps(info["settings"])
        del info['messages']
        chat = DBChat(**info)
        from_db = await self.db.find_by_id(DBChat, chat.id)
        if from_db:
            await self.db.update(chat)
        else:
            await self.db.insert(chat)
        return web.json_response({})

    async def query_chat(self, req: web.Request):
        chat = await self.db.find_by_id(DBChat, req.match_info.get("id"))
        if not chat:
            return web.Response(status=404)
        as_json = self.transformer.encoder.default(chat)
        as_json["messages"] = json.loads(as_json["data"])
        del as_json["data"]
        as_json['settings'] = json.loads(as_json["settings"])
        return web.json_response(as_json)

    async def add_user(self, req: web.Request):
        name = str(req.match_info.get("name"))
        await self.db.insert(DBUSer(id=str(uuid4()), name=name))
        return web.Response()

    async def delete_chat(self, req: web.Request):
        chat = await self.db.find_by_id(DBChat, req.match_info.get("id"))
        if not chat:
            return web.json_response({})
        await self.db.delete(chat)
        return web.json_response({})

    async def websocket_stream_handler(self, req: web.Request):
        ws = web.WebSocketResponse()
        await ws.prepare(req)
        manager = ChatStreamManager(ws)
        await manager.start()
        await manager.closed()
        return ws
