import json
from pathlib import Path

class ReflectionAgent:
    ALLOWED_RUN_ARGS = {"entry", "module", "jar", "binary"}

    def __init__(self):
        # __file__ is backend/RAGs/Reflection_agent.py
        # parent is backend/RAGs
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
        if project_context and (not install_preset or not run_profile):
            inferred = self._infer_parameters(code_language, project_context)
            if not install_preset: install_preset = inferred["install_preset"]
            if not run_profile: run_profile = inferred["run_profile"]
            if not code_version: code_version = inferred["code_version"]

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
        
        try:
            run_cmd = [part.format(**run_args) for part in run_cmd_template]
            run_cmd = [part for part in run_cmd if "{" not in part]
            if not run_cmd:
                run_cmd = ["python", "app.py"] 
                
        except Exception as e:
            run_cmd = ["python", "main.py"] 

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

