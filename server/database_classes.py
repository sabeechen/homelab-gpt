from dataclasses import dataclass


@dataclass
class User:
    id: str
    name: str
    extra: str = "{}"
    IS_PRIMARY_KEY = 'id'


@dataclass
class Chat:
    id: str
    user_id: str
    settings: str = ""
    name: str = ""
    shared: bool = False
    data: str = ""
    temporary_name: str = ""
    IS_PRIMARY_KEY = 'id'
    REQUIRED = ["id", "user_id", "name", "shared", "temporary_name"]
