import aiohttp.web as web
import aiohttp
import os
import openai
import functools
import asyncio
import json
import threading
import uuid

from transformers import GPT2TokenizerFast

COST_PER_TOKEN = {
    "gpt-4": 0.00006,
    "gpt-3.5-turbo": 0.000002,
}

DEFAULT_SYSTEM_MESSAGE = "You are a helpful and consice assistant."


def run_in_executor(f):
    @functools.wraps(f)
    def inner(*args, **kwargs):
        loop = asyncio.get_running_loop()
        return loop.run_in_executor(None, lambda: f(*args, **kwargs))
    return inner


@run_in_executor
def chat_wrapper(**kwargs):  # Your wrapper for async use
    return openai.ChatCompletion.create(**kwargs)


def chat_stream_wrapper(**kwargs):  # Your wrapper for async use
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
    def __init__(self, ws: web.WebSocketResponse, tokenizer):
        self._ws = ws
        self._read_task = None
        self._write_task = None
        self._tokenizer = tokenizer
        self._read_thread: threading.Thread | None = None
        self._write_queue = asyncio.Queue(1000)
        self._run = True
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
        while self._run:
            msg = await self._write_queue.get()
            await self._ws.send_str(msg)

    async def _handle_write(self, data):
        # TODO: consider emptying the queue
        await self._write_queue.put(data)

    async def handle_chat(self, data):
        prompt = data.get('prompt', DEFAULT_SYSTEM_MESSAGE)
        if len(prompt) == 0:
            prompt = DEFAULT_SYSTEM_MESSAGE
        messages = data['messages']
        model = data['model']
        max_tokens = data['max_tokens']
        message_start = data.get("continuation", "")
        # Format a chat request to the OpenAI API
        api_messages = [{"role": "system", "content": prompt}]
        tokens_used = len(self._tokenizer(
            "system").data['input_ids']) + len(self._tokenizer(prompt).data['input_ids'])
        temperature = data.get('temperature', 1.0)
        for message in messages:
            api_message = {
                "role": message.get("role", "user"),
                "content": message.get("message", "")
            }
            api_messages.append(api_message)
            tokens_used += len(self._tokenizer(
                api_message.get("content")).data['input_ids'])
            tokens_used += len(self._tokenizer(
                api_message.get("role")).data['input_ids'])
        self._read_thread = threading.Thread(target=self.request_chat, args=(message_start, tokens_used, asyncio.get_event_loop()), kwargs={
                                             'model': model, 'messages': api_messages, 'temperature': temperature, 'max_tokens': max_tokens})
        self._read_thread.start()

    def request_chat(self, message_start: str, tokens: int, loop, **kwargs):
        if (len(message_start) > 0):
            message_start += " "
        last_message = {
            'cost_tokens': tokens,
            'cost_usd': tokens * COST_PER_TOKEN.get(str(kwargs.get('model')), 0),
            'message': message_start,
            'finish_reason': None,
            'id': self.id,
            'role': 'assistant'
        }
        try:
            for chunk in chat_stream_wrapper(**kwargs):
                if not self._run:
                    return
                tokens += 1
                last_message = {
                    'cost_tokens': tokens,
                    'cost_usd': tokens * COST_PER_TOKEN.get(str(kwargs.get('model')), 0),
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
        await self._ws.close()
        if self._read_task is not None:
            self._read_task.cancel()
            await self._read_task
        if self._read_thread is not None:
            self._read_thread.join()

    async def closed(self):
        await self._stop.wait()


# An aiohttp server class that serves the files in the "static" directory
# and handles the chat API endpoint
class Server():
    def __init__(self):
        print("Loading tokenizer")
        try:
            self.tokenizer = GPT2TokenizerFast(vocab_file=self.get_path(
                'model/vocab.json'), merges_file=self.get_path('model/merges.txt'))
            print("Tokenizer Loaded")
        except:
            print("Tokenizer failed")
        pass

    async def start(self):
        app = web.Application()
        app.add_routes([
            web.static('/static', self.get_path('static'), show_index=False),
            web.get('/', self.index),
            web.post('/api/chat', self.chat),
            web.get('/api/ws/chat', self.websocket_stream_handler),
        ])
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", 80)
        await site.start()

    # takes in a path and returns the fully qualified path relative to this file
    def get_path(self, path):
        return os.path.join(os.path.dirname(os.path.realpath(__file__)), path)

    async def index(self, req: web.Request):
        return web.FileResponse(self.get_path('static/index.html'))

    async def chat(self, req: web.Request):
        # retrieve json from the request
        data = await req.json()
        prompt = data.get('prompt', DEFAULT_SYSTEM_MESSAGE)
        if len(prompt) == 0:
            prompt = DEFAULT_SYSTEM_MESSAGE
        messages = data['messages']
        model = data['model']
        temperature = data.get('temperature', 1.0)
        max_tokens = data['max_tokens']
        # Format a chat request to the OpenAI API
        api_messages = [{"role": "system", "content": prompt}]
        for message in messages:
            api_messages.append({
                "role": message.get("role", "user"),
                "content": message.get("message", "")
            })
        resp = await chat_wrapper(model=model, messages=api_messages, temperature=temperature, max_tokens=max_tokens)
        return web.json_response({
            'role': "assistant",
            'cost_tokens': resp['usage']['total_tokens'],
            'cost_usd': resp['usage']['total_tokens'] * COST_PER_TOKEN.get(model, 0),
            'message': resp['choices'][0]['message']['content'],
            'finish_reason':  resp['choices'][0]['finish_reason'],
            'id': str(uuid.uuid4())
        })

    async def websocket_stream_handler(self, req: web.Request):
        ws = web.WebSocketResponse()
        await ws.prepare(req)
        manager = ChatStreamManager(ws, self.tokenizer)
        await manager.start()
        await manager.closed()
        return ws
