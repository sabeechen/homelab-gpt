from dataclasses import fields, Field
import aiosqlite
from datetime import datetime
import uuid
from typing import List, Union, Type, TypeVar, Callable, Any

T = TypeVar('T')


class SQLiteDB:
    def __init__(self, dbfile):
        self.dbfile = dbfile

    async def create_database(self, dataclasses):
        # create tables based on dataclasses and update their columns if any new fields are added
        async with aiosqlite.connect(self.dbfile) as conn:
            for dataclass in dataclasses:
                table = dataclass.__name__.lower()
                query_columns = "pragma table_info({})".format(table)
                async with conn.execute(query_columns) as c:
                    columns = [r[1] for r in await c.fetchall()]
                    keys = [f for f in fields(dataclass)]
                    create_query = "CREATE TABLE IF NOT EXISTS {} (".format(
                        table)
                    for key in keys:
                        create_query += "{} {},".format(
                            key.name, self._sql_type(key.type))
                    pk_field = dataclass.IS_PRIMARY_KEY
                    create_query += "PRIMARY KEY ({})".format(pk_field)
                    create_query = create_query.rstrip(',')
                    create_query += ")"
                async with conn.execute(create_query) as c:
                    pass
                # Determine if any columns need to be added
                if len(columns) > 0:
                    for missing_field_name in set([k.name for k in keys]).difference(columns):
                        key = next(filter(lambda f: f.name ==
                                          missing_field_name, fields(dataclass)))
                        print(f"Adding column {key.name} to table {table}")
                        query = f"ALTER TABLE {table} ADD COLUMN {key.name} {self._sql_type(key.type)};"
                        async with conn.execute(query) as c:
                            pass

    async def get_all(self, dataclass: Type[T]) -> List[T]:
        converters = {f.name: self._converter(f) for f in fields(dataclass)}
        async with aiosqlite.connect(self.dbfile) as conn:
            async with conn.execute("SELECT * from {}".format(dataclass.__name__.lower())) as c:
                results = await c.fetchall()
                objects = []
                # dynamically create objects from the table results
                for row in results:
                    attrs = [r[0] for r in c.description]
                    values = [r for r in row]
                    mapped_values = {}
                    for i, attr in enumerate(attrs):
                        mapped_values[attr] = converters[attr](values[i])
                    obj = dataclass(**mapped_values)
                    objects.append(obj)
                return objects

    async def find_by_id(self, dataclass: Type[T], id) -> Union[T, None]:
        converters = {f.name: self._converter(f) for f in fields(dataclass)}
        async with aiosqlite.connect(self.dbfile) as conn:
            async with conn.execute("SELECT * from {} where {}='{}'".format(dataclass.__name__.lower(), self._get_pk_field(dataclass), id)) as c:
                for result in await c.fetchall():
                    attrs = [r[0] for r in c.description]
                    values = [r for r in result]
                    mapped_values = {}
                    for i, attr in enumerate(attrs):
                        mapped_values[attr] = converters[attr](values[i])
                    obj = dataclass(**mapped_values)
                    return obj
                return None

    async def find(self, dataclass: Type[T], find_fields: Union[str, List[str]] = "*", **kwargs) -> List[T]:
        converters = {f.name: self._converter(f) for f in fields(dataclass)}
        async with aiosqlite.connect(self.dbfile) as conn:
            where = " AND ".join(["{}=?".format(k) for k, _ in kwargs.items()])
            values = [v for _, v in kwargs.items()]
            results = []
            if isinstance(find_fields, list):
                find_fields = ",".join(find_fields)
            async with conn.execute("SELECT {} from {} WHERE {}".format(find_fields, dataclass.__name__.lower(), where), values) as c:
                for result in await c.fetchall():
                    attrs = [r[0] for r in c.description]
                    values = [r for r in result]
                    mapped_values = {}
                    for i, attr in enumerate(attrs):
                        mapped_values[attr] = converters[attr](values[i])
                    obj = dataclass(**mapped_values)
                    results.append(obj)
            return results

    async def insert(self, dataclass):
        async with aiosqlite.connect(self.dbfile) as conn:
            key_values = self._get_key_values(dataclass)
            columns = ", ".join(key_values.keys())
            value_placeholders = ",".join(
                "?" for _ in range(len(key_values.values())))
            async with conn.execute('INSERT INTO {} ({}) values ({})'.format(
                    type(dataclass).__name__.lower(), columns, ",".join("?" for _ in range(len(key_values.values())))), list(key_values.values())) as c:
                await conn.commit()
                return dataclass

    async def update(self, dataclass):
        async with aiosqlite.connect(self.dbfile) as conn:
            key_values = self._get_key_values(dataclass)
            pk = self._get_pk_field(dataclass)
            attrs = ", ".join([f"{k}=?" for k in key_values.keys() if k != pk])
            values = [v for k, v in key_values.items() if k != pk]
            async with conn.execute('UPDATE {} SET {} WHERE {}="{}"'.format(
                    type(dataclass).__name__.lower(), attrs, pk, key_values[pk]), values) as c:
                await conn.commit()
                return dataclass

    async def delete(self, dataclass):
        async with aiosqlite.connect(self.dbfile) as conn:
            key_values = self._get_key_values(dataclass)
            pk_field = self._get_pk_field(dataclass)
            async with conn.execute('DELETE FROM {} WHERE {}=?'.format(
                    type(dataclass).__name__.lower(), pk_field), [key_values[pk_field]]) as c:
                await conn.commit()

    def _get_pk_field(self, dataclass):
        if isinstance(dataclass, type):
            return dataclass.IS_PRIMARY_KEY
        return type(dataclass).IS_PRIMARY_KEY

    def _get_key_values(self, dataclass):
        return {f.name: str(getattr(dataclass, f.name)) for f in fields(dataclass)}

    def _sql_type(self, t):
        if t == str:
            return "TEXT"
        elif t == int:
            return "INTEGER"
        elif t == float:
            return "REAL"
        elif t == bool:
            return "BOOLEAN"
        elif t == bytes:
            return "BLOB"
        elif t == datetime:
            return "DATETIME"
        else:
            raise ValueError("Type not supported for SQLite: {}".format(t))

    def _converter(self, f: Field) -> Callable[[Any], Any]:
        if f.type == datetime:
            return lambda v: datetime.strptime(v, "%Y-%m-%d %H:%M:%S.%f%z") if v is not None else None
        else:
            return lambda v: v
