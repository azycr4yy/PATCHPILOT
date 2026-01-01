from dotenv import load_dotenv
import os
load_dotenv()
HUGGING_FACE = os.getenv("HUGGING_FACE_API")
TAVILY = os.getenv("TAVILY_API")