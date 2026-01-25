import re
from pathlib import Path

class TargetDiscovery:
    def __init__(self, ingestor):
        self.ingestor = ingestor
        self.count_dependencies = {}
       
    
    def get_dependencies(self):
        deps = {}
        import json
        
        for doc in self.ingestor.text_docs:
            file = Path(doc)
            
            if file.name == "package.json":
                try:
                    content = file.read_text(errors="ignore")
                    data = json.loads(content)
                    
                    # Combine dependencies and devDependencies
                    all_deps = {}
                    if "dependencies" in data and isinstance(data["dependencies"], dict):
                        all_deps.update(data["dependencies"])
                    if "devDependencies" in data and isinstance(data["devDependencies"], dict):
                        all_deps.update(data["devDependencies"])
                        
                    for name, version in all_deps.items():
                        deps[name] = version
                        
                except Exception as e:
                    print(f"Error parsing package.json {file}: {e}")
                    
            elif file.name == "requirements.txt":
                try:
                    lines = file.read_text(errors="ignore").splitlines()
                    for line in lines:
                        line = line.strip()
                        if not line or line.startswith('#'):
                            continue
                            
                        # Split by common operators to separate name from version
                        # This handles: lib==1.0, lib>=1.0, lib, lib~=1.0
                        parts = re.split(r'(==|>=|<=|~=|!=)', line, maxsplit=1)
                        name = parts[0].strip()
                        version = "latest"
                        
                        if len(parts) > 2:
                            operator = parts[1]
                            ver_part = parts[2].split("#")[0] # remove inline comments
                            version = f"{operator}{ver_part}".strip()
                        
                        # Filter out flags like -e . or --index-url
                        if name.startswith('-'):
                            continue
                            
                        deps[name] = version
                except Exception as e:
                    print(f"Error parsing requirements.txt {file}: {e}")
                    
        return deps

    def discover(self, count_dependencies):
        deps = self.get_dependencies()
        
        # Fallback: If no manifest files found, use detected imports as dependencies
        if not deps and count_dependencies:
            for dep in count_dependencies:
                 # simple filter to avid single char variables often mistaken as imports in loose regex
                if len(dep) > 1:
                    deps[dep] = "detected"

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

    def select_target_based_on_topic(self, targets, topic):
        from model_utils import get_llm_client, MODEL_NAME
        from .api_import import HUGGING_FACE
        
        candidates = [t['dependency'] for t in targets]
        
        guide = f"""
        You are a project manager.
        You have a list of identified dependencies in a project: {candidates}
        
        The user has provided this instruction (topic): "{topic}"
        
        Your task is to return a JSON list of ONLY the dependencies from the provided list that are RELEVANT to the user's instruction.
        
        Rules:
        - If the instruction mentions a specific library (e.g. "pydantic"), return it.
        - If the instruction describes a category (e.g. "database", "auth"), return libraries that fit that category.
        - If the instruction is "upgrade all" or "fix everything", return ALL dependencies.
        - If NO dependencies are relevant, return an empty list [].
        - Output STRICT command: just the JSON list.
        """
        
        client = get_llm_client(MODEL_NAME)
        try:
            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that outputs strict JSON lists."},
                    {"role": "user", "content": guide}
                ],
                max_tokens=200,
                temperature=0.1
            )
            content = response.choices[0].message.content
            content = content.replace("```json", "").replace("```", "").strip()
            import json
            selected_names = json.loads(content)
            
            if not isinstance(selected_names, list):
                return targets
                
            filtered_targets = [t for t in targets if t['dependency'] in selected_names]
            return filtered_targets if filtered_targets else targets 
            
        except Exception as e:
            print(f"Error in LLM selection: {e}")
            return targets