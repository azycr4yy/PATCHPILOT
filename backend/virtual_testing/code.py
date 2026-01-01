from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    id: int
    name: str
    email: Optional[str]

    model_config = {
        'orm_mode': True,
        'anystr_strip_whitespace': True,
    }  # Replace the inner Config class with model_config attribute. https://docs.pydantic.dev/latest/concepts/models/#model-config

def load_user_from_request(data: dict) -> User:
    user = User.model_validate(data)  # Replace User.parse_obj(data) with User.model_validate(data). https://docs.pydantic.dev/latest/migration/
    return user


def load_user_from_db(db_row) -> User:
    return User.model_validate(db_row, from_attributes=True)  # Replace User.from_orm(db_row) with User.model_validate(db_row, from_attributes=True). https://github.com/pydantic/pydantic/discussions/5678


def serialize_user(user: User) -> str:
    return user.model_dump_json()  # Replace user.json() with user.model_dump_json(). https://stackoverflow.com/questions/77432012/pydantic-v2-json