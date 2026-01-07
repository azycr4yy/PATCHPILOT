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

class InputState(BaseModel):
    git_link : AnyUrl = Field(description="The git link of the project")
    code: str = Field(default="",description="The code to be ingested")
    migration_rules : str = Field(
        default="",
        description="The rules to be ingested",
        regex = r"Migration Steps:\n(?:- Step \d+:\n(?:[ \t]+- .+\n?)+)+"
    )
    errors : List[str] = Field(default_factory=list,description="The errors to be ingested")
    risks : str = Field(
        default="",
        description="The risks to be ingested",
        regex=r"Risks and Caveats:\n(?:- Risk \d+: [\s\S]*?)(?=\n[A-Z][^\n]*:|\Z)"
    )
    generated_code : str = Field(default="",description="The generated code")
    rules : dict = Field(default_factory=dict,description="The synthesized rules")
    dependencies : dict = Field(default_factory=dict,description="The dependencies of the project")
    code_files : list = Field(default_factory=list,description="The code files of the project")
    targets : list = Field(default_factory=list,description="The discovered upgrade targets")
    retrieved_docs : list = Field(default_factory=list,description="The retrieved documentation")
    topics : str = Field(default="",description="The topics to be ingested")

def project_ingestion_Graph(state: InputState):
    git_url = str(state.git_link)
    if git_url:
        project_name = git_url.rstrip("/").split("/")[-1].replace(".git", "")
        repo_path = os.path.join(os.path.dirname(__file__), "repos", project_name)
        if not Path(repo_path).exists():
            subprocess.run(["git", "clone", git_url, repo_path])
        ingestor = ProjectIngestor()
        ingestor.ingest_directory_recursive(repo_path)
        code_files, dependencies = ingestor.detect_dependencies()
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
    pass

def Migration_Graph(state: InputState):
    pass

def Patch_Graph(state: InputState):
    pass

def Reflection_Graph(state: InputState):
    pass