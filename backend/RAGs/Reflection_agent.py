import json
from pathlib import Path
import os

class ReflectionAgent:
    ALLOWED_RUN_ARGS = {"entry", "module", "jar", "binary"}

    def __init__(self):

        self.base_dir = Path(__file__).resolve().parent
        self.template_path = self.base_dir / "virtual_testing" / "Docker.template.md"
        self.config_path = self.base_dir / "virtual_testing" / "presets.json"
        
        if self.config_path.exists():
            self.config = json.loads(self.config_path.read_text())
        else:
            self.config = {}

    def _infer_parameters(self, code_language, project_context):
        inferred = {
            "install_preset": None,
            "run_profile": None,
            "code_version": "3.11" if code_language == "python" else "18"
        }
        
        deps = project_context.get("dependencies", {})
        

        if code_language == "python":
            if "requirements.txt" in str(deps): 
                 inferred["install_preset"] = "pip"
            else:
                 inferred["install_preset"] = "pip" 
                 
        elif code_language == "node" or code_language == "javascript":
             inferred["install_preset"] = "npm"

        if code_language == "python":
             if "flask" in str(deps).lower():
                 inferred["run_profile"] = "flask"
             else:
                 inferred["run_profile"] = "python_script"

        elif code_language == "node" or code_language == "javascript":
             inferred["run_profile"] = "npm_start"

        candidates = {"main.py", "app.py", "index.js", "server.js", "manage.py"}
        entry_point = None
        
        files = project_context.get("code_files", [])
        if files:

            # First pass: valid candidates
            for f in files:
                if Path(f["file"]).name in candidates:
                    entry_point = Path(f["file"]).name
                    break
            
            # Second pass: if no candidate, pick first file of language
            if not entry_point:
                for f in files:
                     if f["lang"] == "python" and code_language == "python":
                          entry_point = Path(f["file"]).name
                          break
                     elif f["lang"] in ["node", "javascript"] and code_language in ["node", "javascript"]:
                          entry_point = Path(f["file"]).name
                          break
        
        if entry_point:
            inferred["entry_point"] = entry_point

        return inferred

    def generate_dockerfile(
        self,
        code_language: str,
        code_version: str = "",
        install_preset: str = "",
        run_profile: str = "",
        run_args: dict | None = None,
        project_context: dict | None = None
    ):
        if not self.config:
            if self.config_path.exists():
                 self.config = json.loads(self.config_path.read_text())
            else:
                 raise ValueError(f"Configuration file {self.config_path} not found.")
        if project_context:
            inferred = self._infer_parameters(code_language, project_context)
            if not install_preset: install_preset = inferred.get("install_preset")
            if not run_profile: run_profile = inferred.get("run_profile")
            if not code_version: code_version = inferred.get("code_version")
            
            run_args = run_args or {}
            if "entry" not in run_args and inferred.get("entry_point"):
                run_args["entry"] = inferred["entry_point"]

        if not code_version:
             code_version = "3.11" if code_language == "python" else "18"

        try:
            lang_key = "python" if code_language.lower().startswith("py") else "node"
            base_image = self.config["base_images"][lang_key][code_version]
        except KeyError:
            lang_key = "python" if code_language.lower().startswith("py") else "node"
            base_image = list(self.config["base_images"][lang_key].values())[0]

        try:
            install_steps = self.config["install_presets"][install_preset]["steps"]
        except KeyError:
             if install_preset:
                print(f"Warning: Unknown install preset '{install_preset}', defaulting to valid one.")
             install_steps = list(self.config["install_presets"].values())[0]["steps"]

        install_block = "\n".join(install_steps)
        
        try:
            run_cmd_template = self.config["run_profiles"][run_profile]["cmd"]
        except KeyError:
             if run_profile:
                print(f"Warning: Unknown run profile '{run_profile}', defaulting.")
             run_cmd_template = list(self.config["run_profiles"].values())[0]["cmd"]
             
        run_args = run_args or {}
        # Ensure we have a default entry if explicit one wasn't provided or inferred
        if "entry" not in run_args:
             raise RuntimeError("No entry file could be inferred for this project")

        try:
            run_cmd = [part.format(**run_args) for part in run_cmd_template]
            run_cmd = [part for part in run_cmd if "{" not in part]
            if not run_cmd:
                run_cmd = ["python", run_args.get("entry")] 
                
        except Exception as e:
            # If formatting fails (e.g. missing other keys), fallback
            run_cmd = ["python", run_args.get("entry")] 

        if self.template_path.exists():
            template = self.template_path.read_text()
            dockerfile = (
                template
                .replace("{{ BASE_IMAGE }}", base_image)
                .replace("{{ INSTALL_STEPS }}", install_block)
                .replace("{{ RUN_COMMAND }}", json.dumps(run_cmd))
            )
            output_path = self.base_dir / "virtual_testing" / "Dockerfile"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(dockerfile)
            return dockerfile
        else:
            raise FileNotFoundError(f"Template not found at {self.template_path}")

