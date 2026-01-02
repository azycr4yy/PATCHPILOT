import os 
from pathlib import Path
import zipfile
BASE_DIR = Path(__file__).resolve()
while BASE_DIR.name != "backend":
    BASE_DIR = BASE_DIR.parent
uploads_dir = BASE_DIR / "uploads"
ALLOWED_EXTENSIONS = {
    "python": {".py"},
    "node": {".js", ".mjs", ".cjs"},
    "c": {".c", ".h"},
    "cpp": {".cpp", ".cc", ".cxx", ".hpp"},
    "java": {".java"},
    "go": {".go"},
}
AUX_FILES = {
    "requirements.txt",
    "package.json",
    "pom.xml",
    "go.mod",
    "go.sum",
    "pyproject.toml",
}
code_files = []
text_docs = []

def process_file(file_path):
    filename = os.path.basename(file_path)
    for key, val in ALLOWED_EXTENSIONS.items():
        if "." + filename.split('.')[-1] in val:
            code_files.append({"file": file_path, "lang": key})
            return
    
    if filename in AUX_FILES:
        text_docs.append(file_path)

def ingest_directory_recursive(directory):
    try:
        for item in os.listdir(directory):
            item_path = os.path.join(directory, item)
            
            if os.path.isdir(item_path):
                ingest_directory_recursive(item_path)
                continue

            if item.endswith(".zip"):
                try:
                    extract_path = os.path.splitext(item_path)[0]
                    os.makedirs(extract_path, exist_ok=True)
                    with zipfile.ZipFile(item_path, 'r') as zip_ref:
                        zip_ref.extractall(extract_path)
                    ingest_directory_recursive(extract_path)
                except Exception as e:
                    print(f"Error processing zip {item}: {e}")
                continue

            process_file(item_path)
            
    except Exception as e:
        print(f"Error accessing directory {directory}: {e}")


ingest_directory_recursive(str(uploads_dir))

repos_dir = BASE_DIR / "repos"
if repos_dir.exists():
    ingest_directory_recursive(str(repos_dir))