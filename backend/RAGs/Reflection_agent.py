import json
from pathlib import Path


ALLOWED_RUN_ARGS = {"entry", "module", "jar", "binary"}


def reflection_agent(
    code_language: str,
    code_version: str,
    install_preset: str,
    run_profile: str,
    run_args: dict | None = None,
):
    base_dir = Path(__file__).resolve().parent
    template_path = base_dir / "virtual_testing" / "Docker.template.md"
    config_path = base_dir / "virtual_testing" / "presets.json"
    config = json.loads(config_path.read_text())
    try:
        base_image = config["base_images"][code_language][code_version]
    except KeyError:
        raise ValueError(f"Unsupported language/version: {code_language} {code_version}")
    try:
        install_steps = config["install_presets"][install_preset]["steps"]
    except KeyError:
        raise ValueError(f"Unknown install preset: {install_preset}")
    install_block = "\n".join(install_steps)
    try:
        run_cmd_template = config["run_profiles"][run_profile]["cmd"]
    except KeyError:
        raise ValueError(f"Unknown run profile: {run_profile}")
    run_args = run_args or {}
    unknown_args = set(run_args) - ALLOWED_RUN_ARGS
    if unknown_args:
        raise ValueError(f"Disallowed run args: {unknown_args}")
    try:
        run_cmd = [part.format(**run_args) for part in run_cmd_template]
    except KeyError as e:
        raise ValueError(f"Missing required run arg: {e.args[0]}")
    template = template_path.read_text()
    dockerfile = (
        template
        .replace("{{ BASE_IMAGE }}", base_image)
        .replace("{{ INSTALL_STEPS }}", install_block)
        .replace("{{ RUN_COMMAND }}", json.dumps(run_cmd))
    )

    output_path = base_dir / "virtual_testing" / "Dockerfile"
    output_path.write_text(dockerfile)

    return dockerfile
