from pydantic import BaseModel , Field , AnyUrl
from langchain.graph import Graph
from langchain.tools import Tool
from langgraph.graph import StateGraph,START,END
from typing import List , Annotated
from RAGs.KnowledgeRetrieval import KnowledgeRetriever
from RAGs.ProjectIngestion import ProjectIngestor
import os
from pathlib import Path
import subprocess
from RAGs.target_discovery import TargetDiscovery
from RAGs.RuleSynthesis import RuleSynthesizer
from RAGs.Migration_Planner import MigrationPlanner
import re
from RAGs.PatchGenerator import PatchGenerator
from RAGs.Reflection_agent import ReflectionAgent


class InputState(BaseModel):
    git_link : AnyUrl = Field(description="The git link of the project")
    code: str = Field(default="",description="The code to be ingested")
    migration_rules : str = Field(
        default="",
        description="The rules to be ingested",
    )
    errors : List[str] = Field(default_factory=list,description="The errors to be ingested")
    risks : str = Field(
        default="",
        description="The risks to be ingested",
    )
    rules : dict = Field(default_factory=dict,description="The synthesized rules")
    dependencies : dict = Field(default_factory=dict,description="The dependencies of the project")
    code_files : list = Field(default_factory=list,description="The code files of the project")
    targets : list = Field(default_factory=list,description="The discovered upgrade targets")
    retrieved_docs : list = Field(default_factory=list,description="The retrieved documentation")
    topics : str = Field(default="",description="The topics to be ingested")
    initial_rules : str = Field(default="",description="The initial rules to be ingested")
    dependencies_in_code_files : dict = Field(default_factory=dict,description="The dependencies in code files")
    code_language : str = Field(default="",description="The code language of the project")
    code_version : str = Field(default="",description="The code version of the project")
    install_preset : str = Field(default="",description="The install preset of the project")
    run_profile : str = Field(default="",description="The run profile of the project")
    run_args : dict = Field(default_factory=dict,description="The run args of the project")


def project_ingestion_Graph(state: InputState):
    git_url = str(state.git_link)
    if git_url:
        project_name = git_url.rstrip("/").split("/")[-1].replace(".git", "")
        repo_path = os.path.join(os.path.dirname(__file__), "repos", project_name)
        if not Path(repo_path).exists():
            subprocess.run(["git", "clone", git_url, repo_path])
        ingestor = ProjectIngestor()
        ingestor.ingest_directory_recursive(repo_path)
        code_files, dependencies , dependencies_in_code_files = ingestor.detect_dependencies()
        state.code_files = code_files
        state.dependencies = dependencies
        target_discovery = TargetDiscovery(ingestor)
        state.targets = target_discovery.discover(dependencies)
    return state

def User_confirmation_Graph(state: InputState):
    pass

def Knowledge_Graph(state: InputState):
    knowledge_retriever = KnowledgeRetriever()
    topic = state.topics
    queries = knowledge_retriever.generate_queries(topic)
    docs = knowledge_retriever.search(queries)
    state.retrieved_docs = docs
    return state

def RuleSynthesis_Graph(state: InputState):
    RuleSynthesizer = RuleSynthesizer()
    rules = RuleSynthesizer.rules_synthesis(doc)
    import orjson
    from pathlib import Path
    BASE_DIR = Path(__file__).resolve()
    while BASE_DIR.name != "backend":
        BASE_DIR = BASE_DIR.parent
    orjson_dir = BASE_DIR / "orjsonfiles"
    orjson_dir = Path(orjson_dir)
    path = orjson_dir / "initial_rules.json"
    if path.exists():
        data = orjson.loads(path.read_bytes())
    else:
        data = []
    data.append(rules)
    rules = RuleSynthesizer.rule_compiler(data)
    path.write_bytes(orjson.dumps(rules, option=orjson.OPT_INDENT_2))
    state.initial_rules = rules
    return state


def Migration_Graph(state: InputState):
    planner = MigrationPlanner()
    rules = state.initial_rules
    code = state.code
    errors = state.errors
    response = planner.plan_migration(rules, code, errors)
    risks = re.search(r"Risks and Caveats:[\s\S]*?(?=\Z)", response)
    migration_rules = re.search(r"Migration Steps:[\s\S]*?(?=\Z)", response)
    state.risks = risks.group(1).strip()
    state.migration_rules = migration_rules.group(1).strip()
    return state


def Patch_Graph(state: InputState):
    generator = PatchGenerator()
    steps = state.migration_rules
    code = state.code
    generated_code = generator.generate_code(steps, code)
    return state


def Reflection_Graph(state: InputState):
    agent = ReflectionAgent()
    flag = True
    agent.generate_dockerfile(
        code_language=state.code_language,
        code_version=state.code_version,
        install_preset=state.install_preset,
        run_profile=state.run_profile,
        run_args=state.run_args,
    )
    subprocess.run(["docker", "build", "-t", "my-image", "."])
    try:
        ans = subprocess.check_output(["docker", "run", "my-image"])
    except subprocess.CalledProcessError as e:
        state.errors.append(e.output)
        flag = False
    subprocess.run(["docker", "rm", "my-image"])
    if flag:
        return "Migration"
    else:
        return "Finished State"