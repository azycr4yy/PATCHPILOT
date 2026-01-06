import os 
from pathlib import Path
import zipfile
import json
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


def load_project_dependencies(text_docs):
    deps = {
        "python": set(),
        "node": set(),
        "java": set(),
        "go": set(),
    }

    for doc in text_docs:
        name = Path(doc).name

        if name == "requirements.txt":
            for line in Path(doc).read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    deps["python"].add(
                        line.split("==")[0].split(">=")[0].split("<")[0]
                    )

        elif name == "package.json":
            data = json.loads(Path(doc).read_text())
            deps["node"].update(data.get("dependencies", {}).keys())
            deps["node"].update(data.get("devDependencies", {}).keys())

        elif name == "pom.xml":
            for line in Path(doc).read_text().splitlines():
                line = line.strip()
                if line.startswith("<artifactId>"):
                    deps["java"].add(
                        line.replace("<artifactId>", "").replace("</artifactId>", "")
                    )

        elif name == "go.mod":
            for line in Path(doc).read_text().splitlines():
                line = line.strip()
                if line and "/" in line and not line.startswith("module"):
                    deps["go"].add(line.split()[0])

    return deps


def detect_dependencies(code_files, text_docs):
    project_deps = load_project_dependencies(text_docs)
    count_dependencies = {}
    for file in code_files:
        used = set()
        path = Path(file["file"])

        if not path.exists():
            continue

        lines = path.read_text(errors="ignore").splitlines()

        for line in lines:
            line = line.strip()

            if file["lang"] == "python":
                if line.startswith("import "):
                    root = line.split()[1].split(".")[0]
                    if root in project_deps["python"]:
                        used.add(root)
                        count_dependencies[root] = count_dependencies.get(root, 0) + 1

                elif line.startswith("from "):
                    root = line.split()[1].split(".")[0]
                    if root in project_deps["python"]:
                        used.add(root)
                        count_dependencies[root] = count_dependencies.get(root, 0) + 1

            elif file["lang"] == "node":
                if "from" in line and "import" in line:
                    root = line.split("from")[1].strip().strip(";").strip("'\"")
                    if root in project_deps["node"]:
                        used.add(root)
                        count_dependencies[root] = count_dependencies.get(root, 0) + 1

                elif "require(" in line:
                    root = (
                        line.split("require(")[1]
                        .split(")")[0]
                        .strip("'\"")
                    )
                    if root in project_deps["node"]:
                        used.add(root)
                        count_dependencies[root] = count_dependencies.get(root, 0) + 1

            elif file["lang"] == "java":
                if line.startswith("import "):
                    pkg = line.replace("import", "").replace(";", "").strip()
                    for dep in project_deps["java"]:
                        if dep in pkg:
                            used.add(dep)
                            count_dependencies[dep] = count_dependencies.get(dep, 0) + 1

            elif file["lang"] == "go":
                if line.startswith("import") and '"' in line:
                    root = line.split('"')[1]
                    for dep in project_deps["go"]:
                        if root.startswith(dep):
                            used.add(dep)
                            count_dependencies[dep] = count_dependencies.get(dep, 0) + 1

        file["dependencies"] = list(used)

    return code_files,count_dependencies
    
