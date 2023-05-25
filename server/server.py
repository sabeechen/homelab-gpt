import aiohttp.web as web
import os
import openai
import asyncio
import json
import threading
import uuid
import tiktoken
import random
from typing import Union, Dict, List, Any
from dataclasses import dataclass
from .database import SQLiteDB
from .database_classes import User as DBUSer, Chat as DBChat, Session as DBSession, UserBasic
from .dataclass_encoder import CustomJSONTransformer
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from bsrp.server import (
    generate_b_pair,
    generate_salt_and_verifier,
    verify_session as server_verify_session,
)

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


@dataclass
class ChallengeInfo():
    b: int
    B: int
    user: DBUSer
    salt: bytes
    verifier: int
    started: datetime


class Server():
    def __init__(self, database: SQLiteDB):
        self.db = database
        self.transformer = CustomJSONTransformer()
        self.sessions: Dict[str, DBSession] = {}
        self.challenges: Dict[int, ChallengeInfo] = {}
        self._authLock: asyncio.Lock = asyncio.Lock()
        self._purgeTask: Union[asyncio.Task, None] = None

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
            web.get('/api/user/{id}', self.query_user),
            web.post('/api/user', self.add_user),
            web.delete('/api/chat/{id}', self.delete_chat),
            web.post('/api/login/step1', self.authStep1),
            web.post('/api/login/step2', self.authStep2),
            web.get('/api/ws/chat', self.websocket_stream_handler),
        ])
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", int(os.environ.get("PORT", 80)))
        await site.start()
        print("Loading Sessions")
        self.sessions = {s.session_id: s for s in await self.db.get_all(DBSession)}
        print("Server Started")
        self._purgeTask = asyncio.create_task(self.purgeSessions())

    # takes in a path and returns the fully qualified path relative to this file
    def get_path(self, path):
        return os.path.join(os.path.dirname(os.path.realpath(__file__)), path)

    async def index(self, req: web.Request):
        return web.FileResponse(self.get_path('static/index.html'))

    async def sw(self, req: web.Request):
        return web.FileResponse(self.get_path('sw.js'))

    async def wb(self, req: web.Request):
        return web.FileResponse(self.get_path('workbox-d249b2c8.js'))

    async def purgeSessions(self):
        """Purges old sessions from the database, once per hour"""
        while True:
            try:
                for session in filter(lambda s: s.last_used < datetime.now(timezone.utc) - timedelta(days=37), list(self.sessions.values())):
                    await self.db.delete(session)
                    self.sessions.pop(session.session_id)
            except Exception as e:
                print("Error purging sessions", e)

            try:
                for challenge in filter(lambda s: s.started < datetime.now(timezone.utc) - timedelta(minutes=1), list(self.challenges.values())):
                    self.challenges.pop(challenge.B)
            except Exception as e:
                print("Error purging sessions", e)
            await asyncio.sleep(60 * 60)

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
                    "sizes": "850x850",
                    "type": "image/png"
                }
            ]
        })

    async def validate_session(self, req, session_id=None, user_id=None) -> Union[DBSession, None]:
        if session_id is None:
            session_id = req.headers.get('Session-Id')
        if user_id is None:
            user_id = req.headers.get('User-Id')
        if not session_id or not session_id:
            return None
        session = self.sessions.get(session_id)
        if not session:
            return None
        if session.user_id != user_id:
            return None
        if session.last_used < datetime.now(timezone.utc) - timedelta(days=37):
            # Very old sessions are invalid
            return None
        if session.last_used < datetime.now(timezone.utc) - timedelta(days=1):
            # Save last used back to the database so this session isn't deleted
            session.last_used = datetime.now(timezone.utc)
            await self.db.update(session)
        return session

    async def initialize(self, req: web.Request):
        data = {
            "models": list(MODELS.values())
        }
        return web.json_response(data, dumps=self.transformer.to_json)

    async def get_chats(self, req: web.Request):
        query = await req.json()
        if not await self.validate_session(req, user_id=query.get('user_id')):
            return web.Response(status=401)
        data = {
            "chats": await self.db.find(DBChat, find_fields=DBChat.REQUIRED, user_id=query['user_id'])
        }
        return web.json_response(data, dumps=self.transformer.to_json)

    async def save_chat(self, req: web.Request):
        info = await req.json()
        info['data'] = json.dumps(info["messages"])
        info['settings'] = json.dumps(info["settings"])
        del info['messages']
        chat = DBChat(**info)
        if not await self.validate_session(req, user_id=chat.user_id):
            return web.Response(status=401)
        from_db = await self.db.find_by_id(DBChat, chat.id)
        if from_db:
            if from_db.user_id != chat.user_id:
                return web.Response(status=401)
            await self.db.update(chat)
        else:
            await self.db.insert(chat)
        return web.json_response({})

    async def query_chat(self, req: web.Request):
        chat = await self.db.find_by_id(DBChat, req.match_info.get("id"))
        if not chat:
            return web.Response(status=404)
        if not await self.validate_session(req, user_id=chat.user_id):
            return web.Response(status=401)

        as_json = self.transformer.encoder.default(chat)
        as_json["messages"] = json.loads(as_json["data"])
        del as_json["data"]
        as_json['settings'] = json.loads(as_json["settings"])
        return web.json_response(as_json)

    async def query_user(self, req: web.Request):
        user_id = req.match_info.get("id")
        if not await self.validate_session(req, user_id=user_id):
            return web.Response(status=401)
        user = await self.db.find_by_id(DBUSer, user_id)
        if not user:
            return web.Response(status=404)
        return web.json_response(UserBasic(user), dumps=self.transformer.to_json)

    async def add_user(self, req: web.Request):
        data = await req.json()
        password = data.get("password")
        api_key = data.get("api_key")

        if 'name' in data:
            # Create user and return a valid session
            name = data["name"]
            salt, verifier = generate_salt_and_verifier(name, password)

            # Verify user
            users: List[DBUSer] = await self.db.get_all(DBUSer)
            for user in users:
                if user.name.lower() == name.lower():
                    # TODO: Reconsider this, since it leaks already registered users
                    return web.json_response({"error": "User already exists"}, status=400)

            user = DBUSer(id=str(uuid4()), name=name,
                          password_verifier=self.int_to_hex(verifier), password_salt=salt.hex(), api_key=api_key)
            await self.db.insert(user)

            session = DBSession(session_id=str(
                uuid4()), user_id=user.id, created=datetime.now(timezone.utc), last_used=datetime.now(timezone.utc))
            await self.db.insert(session)
            self.sessions[session.session_id] = session
            ret = {
                'session': session,
                'user': UserBasic(user)
            }
        else:
            # Modify the user instead.
            # First validate the session
            session = await self.validate_session(req, user_id=data.get("user_id"))
            change_password = password is not None and len(password) > 0
            if not session:
                return web.Response(status=401)
            if change_password and datetime.now(timezone.utc) - session.created > timedelta(seconds=10):
                return web.json_response({"error": "Invalid user session"}, status=401)
            user = await self.db.find_by_id(DBUSer, data["user_id"])
            if not user:
                return web.Response(status=404)
            if change_password:
                salt, verifier = generate_salt_and_verifier(
                    user.name, password)
                user.password_verifier = self.int_to_hex(verifier)
                user.password_salt = salt.hex()
            if api_key is not None:
                user.api_key = api_key
            await self.db.update(user)
            # invalidate all other sessions
            for s in filter(lambda s: s.user_id == user.id, list(self.sessions.values())):
                await self.db.delete(s)
                self.sessions.pop(s.session_id)
                # Create a new session for the user
            session = DBSession(session_id=str(
                uuid4()), user_id=user.id, created=datetime.now(timezone.utc), last_used=datetime.now(timezone.utc))
            await self.db.insert(session)
            self.sessions[session.session_id] = session
            ret = {
                'session': session,
                'user': UserBasic(user)
            }
        return web.json_response(ret, dumps=self.transformer.to_json)

    async def delete_chat(self, req: web.Request):
        chat = await self.db.find_by_id(DBChat, req.match_info.get("id"))
        if not chat:
            return web.json_response({})
        if not await self.validate_session(req, user_id=chat.user_id):
            return web.Response(status=401)
        await self.db.delete(chat)
        return web.json_response({})

    async def authStep1(self, req: web.Request):
        """Starts the SRP challenge"""
        started = datetime.now(timezone.utc)

        if self._authLock.locked():
            return await self.returnWithDelay(started, {"error": "Login failed"}, status=401)

        async with self._authLock:
            data = await req.json()
            username = data['name']
            all_users = await self.db.get_all(DBUSer)
            users = list(filter(lambda u: u.name.lower()
                         == username.lower(), all_users))
            if (len(users) == 0):
                # generate some bogus but valid values to return to prevent username mining
                salt, verifier = generate_salt_and_verifier(
                    username, "doesn't matter")
                b, B = generate_b_pair(verifier)
            else:
                user = users[0]
                username = user.name
                if user.password_verifier == None or len(user.password_verifier) == 0:
                    # Old users had no password, so replicate that behavior
                    salt, verifier = generate_salt_and_verifier(username, "")
                    b, B = generate_b_pair(verifier)
                else:
                    verifier = self.hex_to_int(user.password_verifier)
                    salt = bytes.fromhex(user.password_salt)
                    b, B = generate_b_pair(verifier)
                self.challenges[B] = ChallengeInfo(
                    b, B, user, salt, verifier, datetime.now(timezone.utc))

            return await self.returnWithDelay(started, {
                "s": salt.hex(),
                "B": self.int_to_hex(B),
                "username": username
            })

    # The server passes large integers to clients in json as hex encoded strings.  This method converts
    # an integer into such a hex encoded string.
    def int_to_hex(self, i: int) -> str:
        return hex(i)[2:]

    # The server passes large integers to clients in json as hex encoded strings.  This method converts
    # such a hex encoded string into an integer.
    def hex_to_int(self, s: str) -> int:
        return int(s, 16)

    async def authStep2(self, req: web.Request):
        """Completes the SRP challenge"""
        started = datetime.now(timezone.utc)
        if self._authLock.locked():
            return await self.returnWithDelay(started, {"error": "Login failed"}, status=401)

        async with self._authLock:
            data = await req.json()
            username = data['name']
            # Sanity check for large values in the request, to prevent abuse
            if (len(data.get('B', "")) > 800 or len(data.get('A', "")) > 800 or len(data.get('M1', "")) > 800):
                return await self.returnWithDelay(started, {"error": "Login failed"}, status=401)
            B = self.hex_to_int(data['B'])
            A = self.hex_to_int(data['A'])
            M1 = bytes.fromhex(data['M1'])

            all_users = await self.db.get_all(DBUSer)
            users = list(filter(lambda u: u.name.lower()
                         == username.lower(), all_users))
            if (len(users) == 0):
                return await self.returnWithDelay(started, {"error": "Login failed"}, status=401)
            user = users[0]
            challenge_info = self.challenges.get(B)
            if not challenge_info:
                # This is a bogus challenge
                return await self.returnWithDelay(started, {"error": "Login failed"}, status=401)

            # a login attempt always consumes the challenge, for security
            self.challenges.pop(B)
            if challenge_info.user.id != user.id:
                # Users don't match, which is probably a bug
                return await self.returnWithDelay(started, {"error": "Login failed"}, status=401)

            if challenge_info.started + timedelta(seconds=30) < datetime.now(timezone.utc):
                # The challenge was issued too long ago.  It should be alsmot instantly requested
                return await self.returnWithDelay(started, {"error": "Login failed"}, status=401)

            try:
                M2 = server_verify_session(
                    user.name, challenge_info.salt, challenge_info.verifier, A, challenge_info.b, M1)
            except:
                return await self.returnWithDelay(started, {"error": "Login failed"}, status=401)
            if M2 == None:
                return await self.returnWithDelay(started, {"error": "Login failed"}, status=401)

            session = DBSession(session_id=str(
                uuid4()), user_id=user.id, created=datetime.now(timezone.utc), last_used=datetime.now(timezone.utc))
            await self.db.insert(session)
            self.sessions[session.session_id] = session
            ret = {
                'session': session,
                'user': UserBasic(user),
                'M2': M2.hex()
            }
            return await self.returnWithDelay(started, ret)

    async def returnWithDelay(self, started: datetime, resp: Dict[str, Any], status: int = 200, min_wait: timedelta = timedelta(seconds=0.5)):
        send = started + min_wait
        wait = send - datetime.now(timezone.utc)
        if wait.total_seconds() > 0:
            await asyncio.sleep(wait.total_seconds())
        return web.json_response(resp, dumps=self.transformer.to_json, status=status)

    async def websocket_stream_handler(self, req: web.Request):
        ws = web.WebSocketResponse()
        await ws.prepare(req)
        manager = ChatStreamManager(ws)
        await manager.start()
        await manager.closed()
        return ws
