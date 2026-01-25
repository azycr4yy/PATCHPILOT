
from pydantic import BaseModel
from typing import List, Optional, Union
from enum import Enum

class InputType(str, Enum):
    FILE = "file"
    TEXT = "text"
    SELECT = "select"

class InputConfig(BaseModel):
    id: str
    label: str
    type: InputType
    placeholder: Optional[str] = None
    required: bool = True
    accepted_formats: Optional[List[str]] = None # For file inputs
    options: Optional[List[str]] = None # For select inputs

class ConfigResponse(BaseModel):
    inputs: List[InputConfig]

class AnalysisResponse(BaseModel):
    run_id: str
    status: str
    message: str

class User(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    username : str
    disabled : Optional[bool] = None
    
class UserinDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class ReflectionRequest(BaseModel):
    action : str

# New models for Migration/Plan
class SelectedMigration(BaseModel):
    id: str
    library: str
    current: str
    target: str
    confidence: float
    enabled: bool

class PlanRequest(BaseModel):
    targets: List[SelectedMigration]
