from dataclasses import dataclass
from datetime import datetime
from typing import Union


@dataclass
class User:
    id: str
    name: str
    extra: str = "{}"
    api_key: str = ""
    password_verifier: str = ""
    password_salt: str = ""
    IS_PRIMARY_KEY = 'id'


@dataclass
class UserBasic:
    id: str
    name: str
    api_key: str = ""

    def __init__(self, user: User):
        self.id = user.id
        self.name = user.name
        self.api_key = user.api_key


@dataclass
class Session:
    user_id: str
    session_id: str
    created: datetime
    last_used: datetime
    IS_PRIMARY_KEY = 'session_id'


@dataclass
class Chat:
    id: str
    user_id: str
    settings: str = ""
    name: str = ""
    shared: bool = False
    data: str = ""
    temporary_name: str = ""
    automatic_name: str = ""
    total_spending: float = 0
    last_saved: datetime = datetime.min
    IS_PRIMARY_KEY = 'id'
    REQUIRED = ["id", "user_id", "name", "shared",
                "temporary_name", "automatic_name"]


@dataclass
class Global:
    id: str
    total_spending: float
    IS_PRIMARY_KEY = 'id'
