from pydantic import BaseModel , Field , AnyUrl
from langgraph import graph
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
from IPython.display import Image, display


class InputState(BaseModel):
    git_link : str = Field(description="The git link of the project")
    code: dict = Field(default_factory=dict,description="The code to be ingested")
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
    current_target_dependency: str = Field(default="", description="The current dependency being targeted")
    is_authenticated : bool = Field(default=False,description="The authentication status of the user")
    validation_success : bool = Field(default=True, description="Status of the last validation/reflection step")
    run_id : str = Field(default="",description="The run id of the project")
    generated_code : dict = Field(default_factory=dict,description="The generated code of the project")
    current_target_file : str = Field(default="", description="The current file being targeted")
    current_file_language : str = Field(default="", description="The current file language")
    retry_count: int = Field(default=0, description="Number of patch retry attempts")


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
        state.dependencies_in_code_files = dependencies_in_code_files
        target_discovery = TargetDiscovery(ingestor)
        state.targets = target_discovery.discover(dependencies)
    return state

def User_confirmation_Graph(state: InputState):
    return state


def Knowledge_Graph(state: InputState):
    knowledge_retriever = KnowledgeRetriever()
    topic = state.topics
    if topic:
        queries = knowledge_retriever.generate_queries(topic)
        docs = knowledge_retriever.search(queries)
        state.retrieved_docs = docs
    return state

def check_authentication(state: InputState):
    if not state.is_authenticated:
        return "User Confirmation"
    return "Rule Synthesis"

def RuleSynthesis_Graph(state: InputState):
    if not state.retrieved_docs:
        print("No docs retrieved, skipping rule synthesis")
        return state
        
    synthesizer = RuleSynthesizer()
    rules = synthesizer.rules_synthesis(state.retrieved_docs)
    import orjson
    from pathlib import Path
    BASE_DIR = Path(__file__).resolve()
    while BASE_DIR.name != "backend":
        BASE_DIR = BASE_DIR.parent
    orjson_dir = BASE_DIR / "orjsonfiles"
    orjson_dir = Path(orjson_dir)
    orjson_dir.mkdir(parents=True, exist_ok=True)
    path = orjson_dir / "initial_rules.json"
    data = []
    if path.exists():
        try:
            data = orjson.loads(path.read_bytes())
        except:
            data = []
    if isinstance(rules, list):
         data.extend(rules)
    else:
        data.append(rules)
    compiled_rules = synthesizer.rule_compiler(data)
    path.write_bytes(orjson.dumps(compiled_rules, option=orjson.OPT_INDENT_2))
    state.initial_rules = compiled_rules
    return state

def select_next_target(state: InputState):
    print(f"DEBUG: Targets remaining: {len(state.targets)}")
    state.retry_count = 0 
    while state.targets:
        target = state.targets[0]
        dependency_name = target['dependency']
        
        files_using_dep = state.dependencies_in_code_files.get(dependency_name, [])
        print(f"DEBUG: Processing target {dependency_name}, files remaining: {len(files_using_dep)}")
        
        if not files_using_dep:
            print(f"DEBUG: No files for {dependency_name}, popping target.")
            state.targets.pop(0)
            continue
            
        file_info = files_using_dep.pop(0)
        file_path = file_info['file']
        state.current_file_language = file_info['lang']
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                code = f.read()
            if not isinstance(state.code, dict):
                 state.code = {}
            state.code.update({file_path: code})
            state.current_target_file = file_path
            state.current_target_dependency = dependency_name
            return state
        except Exception as e:
            print(f"Error reading file {file_path}: {e}")
            state.targets.pop(0)
            continue

    state.current_target_dependency = ""
    state.code = {}
    return state 

def check_target_availability(state: InputState):
    if state.code and state.current_target_dependency:
        return "Migration"
    elif state.targets:
        return "Select Target" 
    else:
        return "Finished State"


def Migration_Graph(state: InputState):
    planner = MigrationPlanner()
    rules = state.initial_rules
    code = state.code
    errors = state.errors
    if not code:
        return state
    response = planner.plan_migration(rules, code, errors)
    risks_match = re.search(r"Risks and Caveats:[\s\S]*?(?=\Z)", response)
    migration_steps_match = re.search(r"Migration Steps:[\s\S]*?(?=(?:Risks and Caveats:|(?=\Z)))", response)
    state.risks = risks_match.group(0).strip() if risks_match else ""
    state.migration_rules = migration_steps_match.group(0).strip() if migration_steps_match else response # Fallback
    return state


def Patch_Graph(state: InputState):
    generator = PatchGenerator()
    steps = state.migration_rules
    code = state.code
    generated_code = generator.generate_code(steps, code)
    curr_depend = state.current_target_dependency
    curr_file = state.current_target_file
    if not isinstance(state.generated_code, dict):
        state.generated_code = {}
    state.generated_code.update({curr_file: generated_code})
    return state


def Reflection_Graph(state: InputState):
    agent = ReflectionAgent()
    flag = True
    current_file_dependencies = []
    for i in state.code_files:
        if i['file'] == state.current_target_file:
            state.current_file_language = i['lang']
            current_file_dependencies = i.get('dependencies', [])
            break
    agent.generate_dockerfile(
        code_language=state.current_file_language,
        code_version=state.code_version,
        install_preset=state.install_preset,
        run_profile=state.run_profile,
        run_args=state.run_args,
        project_context={"dependencies": current_file_dependencies}
    )
    
    BASE_DIR = Path(__file__).resolve() 
    while BASE_DIR.name != "backend":
        BASE_DIR = BASE_DIR.parent
    build_context = BASE_DIR / "RAGs" / "virtual_testing"
    
    subprocess.run(["docker", "build", "-t", "my-image", "."], cwd=build_context)
    
    try:
        ans = subprocess.check_output(["docker", "run", "--rm", "my-image"])
    except subprocess.CalledProcessError as e:
        state.errors.append(e.output)
        flag = False
    
    subprocess.run(["docker", "rmi", "my-image"])
    
    state.validation_success = flag
    return state

def reflection_condition(state: InputState):
    MAX_RETRIES = 3
    if not state.validation_success:
        if state.retry_count < MAX_RETRIES:
            state.retry_count += 1
            print(f"Validation failed. Retrying patch attempt {state.retry_count}/{MAX_RETRIES}...")
            return "Patch"
        else:
            print(f"Max retries ({MAX_RETRIES}) reached. Proceeding to next target.")
            return "Select Target"
    return "Select Target"



graph_builder = StateGraph(InputState)

graph_builder.add_node("Project Ingestion", project_ingestion_Graph)
graph_builder.add_node("User Confirmation", User_confirmation_Graph)
graph_builder.add_node("Knowledge", Knowledge_Graph)

graph_builder.add_node("Rule Synthesis", RuleSynthesis_Graph)
graph_builder.add_node("Select Target", select_next_target)
graph_builder.add_node("Migration", Migration_Graph)
graph_builder.add_node("Patch", Patch_Graph)
graph_builder.add_node("Reflection", Reflection_Graph)

graph_builder.set_entry_point("Project Ingestion")

graph_builder.add_edge("Project Ingestion", "User Confirmation")
graph_builder.add_edge("User Confirmation", "Knowledge")
graph_builder.add_conditional_edges(
    "Knowledge",
    check_authentication,
    {
        "User Confirmation": "User Confirmation",
        "Rule Synthesis": "Rule Synthesis"
    }
)
graph_builder.add_edge("Rule Synthesis", "Select Target")

graph_builder.add_conditional_edges(
    "Select Target",
    check_target_availability,
    {
        "Migration": "Migration",
        "Select Target": "Select Target",
        "Finished State": END
    }
)

graph_builder.add_edge("Migration", "Patch")
graph_builder.add_edge("Patch", "Reflection")

graph_builder.add_conditional_edges(
    "Reflection",
    reflection_condition,
    {
        "Select Target": "Select Target",
        "Finished State": END
    }
)

graph = graph_builder.compile()


graph = graph_builder.compile()

# ---------------- RENDER AS PNG ----------------

if __name__ == "__main__":
    try:
        png_bytes = graph.get_graph().draw_mermaid_png()

        with open("graph.png", "wb") as f:
            f.write(png_bytes)

        print("Saved graph.png")

    except Exception as e:
        print("Failed to render graph:", e)
        print("Make sure you installed:  pip install 'langgraph[mermaid]'")