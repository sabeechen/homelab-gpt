import json
from dataclasses import asdict, is_dataclass
from typing import Any


class CustomJSONEncoder(json.JSONEncoder):
    """
    Custom JSONEncoder that handles dataclasses and other custom types
    """

    def default(self, obj: Any) -> Any:
        if is_dataclass(obj):
            data_dict = {}
            for field_name, field_value in obj.__dict__.items():
                data_dict[field_name] = self.default(field_value)
            return data_dict
        elif isinstance(obj, (list, tuple)):
            return [self.default(item) for item in obj]
        elif isinstance(obj, dict):
            return {key: self.default(value) for key, value in obj.items()}
        elif isinstance(obj, (int, float, str, bool, type(None))):
            return obj
        else:
            return str(obj)


class CustomJSONDecoder(json.JSONDecoder):
    """
    Custom JSONDecoder that handles dataclasses and other custom types
    """

    def __init__(self, *args, **kwargs):
        super().__init__(object_hook=self.object_hook, *args, **kwargs)

    def object_hook(self, obj):
        for key, value in obj.items():
            if isinstance(value, dict):
                obj[key] = self.object_hook(value)
            elif isinstance(value, (list, tuple)):
                obj[key] = [self.object_hook(item) for item in value]
            elif isinstance(value, str):
                # try to parse string into a different type (e.g. int, float)
                try:
                    value = int(value)
                except ValueError:
                    try:
                        value = float(value)
                    except ValueError:
                        pass
                obj[key] = value
        return obj


class CustomJSONTransformer:
    """
    Custom transformer class that transforms dataclass objects to and from JSON.
    """

    def __init__(self):
        self.encoder = CustomJSONEncoder()
        self.decoder = CustomJSONDecoder()

    def to_json(self, obj):
        return self.encoder.encode(obj)

    def from_json(self, json_str):
        return self.decoder.decode(json_str)
