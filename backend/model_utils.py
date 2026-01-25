import os
import requests
import json
from dataclasses import dataclass

# Configuration
USE_OLLAMA = True
OLLAMA_BASE_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "llama3.2"  # Ensure this model is pulled in Ollama: `ollama pull llama3.2`

@dataclass
class Message:
    role: str
    content: str

@dataclass
class Choice:
    message: Message

@dataclass
class ChatCompletion:
    choices: list[Choice]

class OllamaClient:
    def __init__(self, model, token=None):
        self.model = model
        # Token is unused for local Ollama but kept for compatibility with InferenceClient signature
        self.chat = self.Chat(self)

    class Chat:
        def __init__(self, client):
            self.client = client
            self.completions = self.Completions(client)

        class Completions:
            def __init__(self, client):
                self.client = client

            def create(self, messages, max_tokens=None, temperature=None):
                # Convert object messages to dict if they aren't already
                formatted_messages = []
                for msg in messages:
                    if isinstance(msg, dict):
                        formatted_messages.append(msg)
                    else:
                        formatted_messages.append({"role": msg.role, "content": msg.content})

                payload = {
                    "model": self.client.model,
                    "messages": formatted_messages,
                    "stream": False,
                }
                
                if temperature is not None:
                    payload["options"] = {"temperature": temperature}

                # Note: Ollama doesn't strictly support max_tokens in the top level options the same way OpenAI does,
                # but we can pass num_predict in options if needed.
                if max_tokens is not None:
                    if "options" not in payload:
                        payload["options"] = {}
                    payload["options"]["num_predict"] = max_tokens

                try:
                    response = requests.post(OLLAMA_BASE_URL, json=payload, timeout=120)
                    response.raise_for_status()
                    data = response.json()
                    
                    content = data.get("message", {}).get("content", "")
                    
                    # Return structure mimicking OpenAI/InferenceClient response
                    return ChatCompletion(choices=[Choice(message=Message(role="assistant", content=content))])
                    
                except requests.exceptions.RequestException as e:
                    print(f"Error communicating with Ollama: {e}")
                    # Return empty or error message to avoid crashing
                    return ChatCompletion(choices=[Choice(message=Message(role="assistant", content="Error: Could not connect to Ollama"))])

def get_llm_client(model_name=MODEL_NAME):
    if USE_OLLAMA:
        return OllamaClient(model=model_name)
    else:
        # Fallback to HuggingFace if needed (requires huggingface_hub installed)
        from huggingface_hub import InferenceClient
        from RAGs.api_import import HUGGING_FACE
        return InferenceClient(model=model_name, token=HUGGING_FACE)
