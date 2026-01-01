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
