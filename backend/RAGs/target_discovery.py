import re
from pathlib import Path

class TargetDiscovery:
    def __init__(self, ingestor):
        self.ingestor = ingestor
        self.count_dependencies = {}
       
    
    def get_dependencies(self):
        deps = {}
        PATTERNS = {
            "requirements.txt": re.compile(r'^([a-zA-Z0-9\-_.]+)\s*(?:==|>=|<=|~=|!=)\s*([a-zA-Z0-9\.\-_]+)', re.IGNORECASE),
            "package.json": re.compile(r'"([a-zA-Z0-9\-_@/]+)"\s*:\s*"(?:\^|~)?([0-9\.]+)"', re.IGNORECASE),
        }
        for doc in self.ingestor.text_docs:
            file = Path(doc)
            if file.name in PATTERNS:
                lines = file.read_text(errors="ignore").splitlines()
                for line in lines:
                    match = PATTERNS[file.name].search(line)
                    if match:
                        deps[match.group(1)] = match.group(2)
        return deps

    def discover(self, count_dependencies):
        deps = self.get_dependencies()
        results = []
        
        for dep, version in deps.items():
            count = count_dependencies.get(dep, 0)
            priority = "high" if count > 4 else "low"
            suggestion = "Upgrade if Possible" if count > 2 else "Stable Version"
            risk = "high" if priority == "high" else "medium" if priority == "medium" else "low"
            
            output_struct = {
                "dependency": dep,
                "priority": priority,
                "current_version": version,
                "suggestion": suggestion,
                "risk": risk
            }
            results.append(output_struct)

        return results