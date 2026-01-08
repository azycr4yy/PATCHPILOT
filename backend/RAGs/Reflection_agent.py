import json
from pathlib import Path

class ReflectionAgent:
    ALLOWED_RUN_ARGS = {"entry", "module", "jar", "binary"}

    def __init__(self):
        self.base_dir = Path(__file__).resolve().parent
        self.template_path = self.base_dir / "virtual_testing" / "Docker.template.md"
        self.config_path = self.base_dir / "virtual_testing" / "presets.json"
        
        if self.config_path.exists():
            self.config = json.loads(self.config_path.read_text())
        else:
            self.config = {} # Handle case where file might be missing during initial setup

    def generate_dockerfile(
        self,
        code_language: str,
        code_version: str,
        install_preset: str,
        run_profile: str,
        run_args: dict | None = None,
    ):
        if not self.config:
             raise ValueError("Configuration file presets.json not found or empty.")
        try:
            base_image = self.config["base_images"][code_language][code_version]
        except KeyError:
            raise ValueError(f"Unsupported language/version: {code_language} {code_version}")
        try:
            install_steps = self.config["install_presets"][install_preset]["steps"]
        except KeyError:
            raise ValueError(f"Unknown install preset: {install_preset}")
        install_block = "\n".join(install_steps)
        try:
            run_cmd_template = self.config["run_profiles"][run_profile]["cmd"]
        except KeyError:
            raise ValueError(f"Unknown run profile: {run_profile}")
        run_args = run_args or {}
        unknown_args = set(run_args) - self.ALLOWED_RUN_ARGS
        if unknown_args:
            raise ValueError(f"Disallowed run args: {unknown_args}")
        try:
            run_cmd = [part.format(**run_args) for part in run_cmd_template]
        except KeyError as e:
            raise ValueError(f"Missing required run arg: {e.args[0]}")
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

