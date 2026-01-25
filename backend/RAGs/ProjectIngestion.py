import os 
from pathlib import Path
import zipfile
import json
import re

BASE_DIR = Path(__file__).resolve()
while BASE_DIR.name != "backend":
    BASE_DIR = BASE_DIR.parent
uploads_dir = BASE_DIR / "uploads"

ALLOWED_EXTENSIONS = {
    "python": {".py"},
    "node": {".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx"},
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

class ProjectIngestor:
    def __init__(self):
        self.code_files = []
        self.text_docs = []
        self.dependencies_in_code_files = {}
                    
    def process_file(self, file_path):
        filename = os.path.basename(file_path)
        # print(f"DEBUG: Processing potential file: {filename}")
        for key, val in ALLOWED_EXTENSIONS.items():
            if "." + filename.split('.')[-1] in val:
                print(f"DEBUG: Found code file ({key}): {filename}")
                self.code_files.append({"file": file_path, "lang": key})
                return
        
        if filename in AUX_FILES:
            print(f"DEBUG: Found aux file: {filename}")
            self.text_docs.append(file_path)

    def ingest_directory_recursive(self, directory):
        print(f"DEBUG: Ingesting directory: {directory}")
        try:
            for item in os.listdir(directory):
                item_path = os.path.join(directory, item)
                
                if os.path.isdir(item_path):
                    if item.startswith('.') or item == "node_modules" or item == "venv":
                        continue
                    self.ingest_directory_recursive(item_path)
                    continue

                if item.endswith(".zip"):
                    try:
                        extract_path = os.path.splitext(item_path)[0]
                        os.makedirs(extract_path, exist_ok=True)
                        with zipfile.ZipFile(item_path, 'r') as zip_ref:
                            zip_ref.extractall(extract_path)
                        self.ingest_directory_recursive(extract_path)
                    except Exception as e:
                        print(f"Error processing zip {item}: {e}")
                    continue

                self.process_file(item_path)
                
        except Exception as e:
            print(f"Error accessing directory {directory}: {e}")

    def load_project_dependencies(self):
        deps = {
            "python": set(),
            "node": set(),
            "java": set(),
            "go": set(),
        }
        
        PATTERNS = {
            "requirements.txt": ("python", re.compile(r'^([a-zA-Z0-9\-_.]+)', re.IGNORECASE)),
            "pom.xml": ("java", re.compile(r'<artifactId>([^<]+)</artifactId>', re.IGNORECASE)),
            "go.mod": ("go", re.compile(r'^\s*(?:require\s+)?([a-zA-Z0-9\.\-_/]+)', re.IGNORECASE)),
        }

        for doc in self.text_docs:
            path = Path(doc)
            name = path.name

            if name == "package.json":
                try:
                    data = json.loads(path.read_text(errors="ignore"))
                    deps["node"].update(data.get("dependencies", {}).keys())
                    deps["node"].update(data.get("devDependencies", {}).keys())
                except Exception:
                    pass
                continue

            if name in PATTERNS:
                lang, pattern = PATTERNS[name]
                try:
                    for line in path.read_text(errors="ignore").splitlines():
                        line = line.strip()
                        if not line: continue
                        if name == "requirements.txt" and line.startswith('#'): continue
                        
                        match = pattern.search(line)
                        if match:
                            val = match.group(1)
                            if lang == "go":
                                if "/" not in val or line.startswith("module"):
                                    continue
                            deps[lang].add(val)
                except Exception:
                    pass

        return deps

    def detect_dependencies(self):
        project_deps = self.load_project_dependencies()
        count_dependencies = {}
        PATTERNS = {
            "python": re.compile(r'^\s*(?:import|from)\s+([a-zA-Z_][\w.]*)', re.IGNORECASE),
            "node": re.compile(r'(?:from\s+[\'"]([^\'"]+)[\'"])|(?:require\s*\(\s*[\'"]([^\'"]+)[\'"])', re.IGNORECASE),
            "java": re.compile(r'^\s*import\s+([a-zA-Z_][\w.]*);', re.IGNORECASE),
            "go": re.compile(r'^\s*import\s+[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
            "c": re.compile(r'^\s*#include\s*[<"]([^>"]+)[>"]', re.IGNORECASE),
            "cpp": re.compile(r'^\s*#include\s*[<"]([^>"]+)[>"]', re.IGNORECASE),
        }
        for file in self.code_files:
            used = set()
            path = Path(file["file"])
            if not path.exists():
                continue
            lines = path.read_text(errors="ignore").splitlines()
            lang = file["lang"]
            pattern = PATTERNS.get(lang)
            if not pattern:
                continue
            for line in lines:
                line = line.strip()
                match = pattern.search(line)
                if match:
                    dep = next((g for g in match.groups() if g is not None), None)
                    if dep:
                        used.add(dep)
                        count_dependencies[dep] = count_dependencies.get(dep, 0) + 1
                        if dep not in self.dependencies_in_code_files:
                            self.dependencies_in_code_files[dep] = []
                        self.dependencies_in_code_files[dep].append(file)
            file["dependencies"] = list(used)
        return self.code_files, count_dependencies , self.dependencies_in_code_files