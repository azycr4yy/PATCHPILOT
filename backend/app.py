from fastapi import FastAPI, File, UploadFile, HTTPException, Form , Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import uuid
import shutil
import os
import subprocess
from models import InputConfig, InputType, ConfigResponse, AnalysisResponse, User , UserinDB , Token , TokenData , ReflectionRequest, PlanRequest 
from fastapi.security import OAuth2PasswordBearer , OAuth2PasswordRequestForm
from fastapi import Depends
from RAGs.api_import import SECRET_KEY
from fastapi import Depends, HTTPException, status , FastAPI
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from Graph import *
import difflib
from RAGs.ProjectIngestion import ProjectIngestor
from RAGs.target_discovery import TargetDiscovery

SECRET_KEY = SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

origin = [
    'http://localhost:5173',
    'http://127.0.0.1:5173'
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origin,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth_scheme = OAuth2PasswordBearer(tokenUrl="token")

#login page 
pwd_crypt = CryptContext(schemes=["bcrypt"], deprecated="auto")
placeholder_db = {
    "demo@patchpilot.ai": {
        "username": "demo@patchpilot.ai",
        "email": "demo@patchpilot.ai",
        "password": pwd_crypt.hash("password"),
        "disabled": False
    }
}
def hashing_password(password:str):
    return pwd_crypt.hash(password)
def verify_pwd(unhashed_password,hashed_password):
    return pwd_crypt.verify(unhashed_password,hashed_password)
def get_user(username:str):
    if username in placeholder_db:
        user = placeholder_db[username]
        return User(**user)
    return None

def authenticate_user(username:str,password:str):
    user = get_user(username)
    if not user:
        return False
    if not verify_pwd(password,user.password):
        return False
    return user

def create_jwt_token(data:dict,expire_time : timedelta):
    to_encode = data.copy()
    if expire_time:
        expire = datetime.now(timezone.utc) + expire_time
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes = 15)
    to_encode.update({"exp":expire})
    jwt_token = jwt.encode(to_encode,SECRET_KEY,algorithm=ALGORITHM)
    return jwt_token


@app.post("/token")
async def login_for_access_token(form_data:OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username,form_data.password)
    if not user:
        raise HTTPException(status_code=401,detail="Incorrect username or password",)
    access_token = create_jwt_token(data={"sub":user.username},expire_time=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token":access_token,"token_type":"bearer"}


async def get_current_user(token:str = Depends(oauth_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        
    )
    try:
        payload = jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

oauth_scheme_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

async def get_current_user_optional(token: str = Depends(oauth_scheme_optional)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        token_data = TokenData(username=username)
    except JWTError:
        return None
    
    user = get_user(username=token_data.username)
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400,detail="Inactive user")
    return current_user



UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
REPOS_DIR = "repos"
os.makedirs(REPOS_DIR, exist_ok=True)
runs = {}

@app.get("/config/inputs", response_model=ConfigResponse)
async def get_input_config():

    return ConfigResponse(
        inputs=[
            InputConfig(
                id="source_code",
                label="Project Source Code",
                type=InputType.FILE,
                accepted_formats=[".zip", ".tar.gz"],
                required=True
            ),
            InputConfig(
                id="github_url",
                label="Or Import from GitHub",
                type=InputType.TEXT,
                placeholder="https://github.com/org/repo",
                required=False
            ),
            InputConfig(
                id="analysis_depth",
                label="Analysis Depth",
                type=InputType.SELECT,
                options=["Quick Scan","Deep Research"],
                required=True
            )
        ]
    )

@app.post("/run")
def run():
    run_id = uuid4().hex
    runs[run_id] = {
        "filename": "",
        "gitlink" : "",
        "depth": "",
        "status": "queued",
        "knowledge" : {},
        "plan": "",
        "changes": {},
        "verify": "",
        "reflect": "",
        "trace": ""
    }
    return AnalysisResponse(
        run_id=run_id,
        status="queued",
        message=f"Analysis run {run_id} created."
    )

@app.post("/upload", response_model=AnalysisResponse)
async def upload_file(file: UploadFile = File(...), run_id: str = Form(None)):
    if run_id is None:
        run_id = uuid4().hex
        runs[run_id] = {
            "filename": file.filename,
            "gitlink" : "",
            "depth": "",
            "status": "queued",
            "knowledge" : {},
            "plan": "",
            "changes": {},
            "verify": "",
            "reflect": "",
            "trace": ""
        }
    try:
        if not file.filename.endswith(('.zip', '.tar.gz')):
             raise HTTPException(status_code=400, detail="Invalid file format. Please upload a ZIP or TAR.GZ file.")

        file_location = f"{UPLOAD_DIR}/{run_id}_{file.filename}"
        with open(file_location, "wb+") as buffer:
            shutil.copyfileobj(file.file, buffer)
        runs[run_id]["filename"] = file.filename
        runs[run_id]["status"] = "uploaded"
        return AnalysisResponse(
            run_id=run_id,
            status="uploaded",
            message=f"File {file.filename} uploaded successfully. Analysis run {run_id} created."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/github", response_model=AnalysisResponse)
async def analyze_github(url: str = Form(...), depth: str = Form("Quick Scan"), topics: str = Form(""), run_id: str = Form(None)):
    if run_id is None:
        run_id = uuid4().hex
    
    # Basic validation for GitHub URL
    if not url.startswith("https://github.com/") and not url.startswith("http://github.com/"):
         raise HTTPException(status_code=400, detail="Invalid URL. Please provide a valid GitHub repository link (e.g., https://github.com/user/repo).")
    
    # Always initialize the run structure
    runs[run_id] = {
        "filename": "",
        "gitlink" : url,
        "depth": depth,
        "topics": topics,
        "status": "queued",
        "knowledge" : {},
        "plan": [],
        "changes": {},
        "verify": [],
        "reflect": [],
        "trace": []
    }
    try:
        repo_name = url.rstrip('/').split('/')[-1]
        if not repo_name:
             repo_name = "unknown_repo"
    except:
        repo_name = "unknown_repo"
    target_dir = os.path.join(REPOS_DIR, f"{run_id}_{repo_name}")
    try:
        subprocess.run(["git", "clone", url, target_dir], check=True, capture_output=True)
        runs[run_id]["gitlink"] = url
        runs[run_id]["depth"] = depth
        runs[run_id]["status"] = "queued"
        return AnalysisResponse(
            run_id=run_id,
            status="queued",
            message=f"GitHub repository {url} cloned to {target_dir} and queued for {depth}."
        )
    except subprocess.CalledProcessError as e:
         raise HTTPException(status_code=400, detail=f"Failed to clone repository: {e.stderr.decode() if e.stderr else str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400,detail="Inactive user")
    return current_user

@app.get("/analyze")
async def analyze(run_id: str = Query(...),current_user: User = Depends(get_current_user_optional)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
    if get_run_attr(runs[run_id], "depth") == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for deep research")

@app.post("/register")
def register(Username : str = Query(...),Email:str = Query(...),Password:str = Query(...),Company_Name:str = Query(default="Student")):
    if not Username or not Email or not Password:
        raise HTTPException(400, "Missing required fields")
    if Username in placeholder_db:
        raise HTTPException(400, "Username already exists")
    for user in placeholder_db.values():
        if user.get("email") == Email:
            raise HTTPException(400, "Email already exists")
        elif user.get("username") == Username:
            raise HTTPException(400, "Username already exists")
 
    placeholder_db[Username] = {
        "username": Username,
        "email": Email,
        "password": pwd_crypt.hash(Password),
        "company_name": Company_Name,
        "disabled": False
    }
    return {"message": "User registered successfully"}

"""
    git_link : str = Field(description="The git link of the project")
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
    rules : str = Field(default="",description="The initial rules to be ingested")
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
"""

@app.post("/run/{run_id}")
def run_Graph(run_id: str, User = Depends(get_current_user_optional)):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run ID not found")
    
    run_data = runs[run_id]
    
    

@app.post("/run/{run_id}/overview")
def get_overview(run_id: str, instruction: str = Form(None), User = Depends(get_current_user_optional)):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run ID not found")
    
    try:
        run_data = runs[run_id]
        
        if isinstance(run_data, dict):
            git_url = run_data.get("gitlink", "")
            current_topics = run_data.get("topics", "")
        else:
            git_url = run_data.git_link
            current_topics = run_data.topics

        code_files = []
        dependencies = {}
        dependencies_in_code_files = {}
        targets = []

        if instruction:
            new_topics = ""
            if current_topics:
                new_topics = f"{current_topics}\nUser Instruction: {instruction}"
            else:
                new_topics = f"User Instruction: {instruction}"
            
            if isinstance(run_data, dict):
                run_data["topics"] = new_topics
            else:
                run_data.topics = new_topics
            
            current_topics = new_topics

        if git_url:
            repo_name = git_url.rstrip("/").split("/")[-1].replace(".git", "")
            if not repo_name:
                    repo_name = "unknown_repo"
            repo_path = os.path.join(REPOS_DIR, f"{run_id}_{repo_name}")
            
            if not os.path.exists(repo_path):
                    try:
                        subprocess.run(["git", "clone", git_url, repo_path], check=True)
                    except Exception as e:
                        print(f"Error cloning repo: {e}")

            ingestor = ProjectIngestor()
            ingestor.ingest_directory_recursive(repo_path)
            code_files, dependencies , dependencies_in_code_files = ingestor.detect_dependencies()
            
            target_discovery = TargetDiscovery(ingestor)
            targets = target_discovery.discover(dependencies)
            
            if current_topics and targets:
                targets = target_discovery.select_target_based_on_topic(targets, current_topics)
                
            if not targets and current_topics:
                print(f"DEBUG: No specific dependencies targeted, but topic '{current_topics}' exists. Adding Global Migration target.")
                global_target = {
                    "dependency": "Global Migration",
                    "priority": "Critical",
                    "current_version": "N/A",
                    "suggestion": "User Requested Migration",
                    "risk": "High"
                }
                targets.append(global_target)
                dependencies_in_code_files["Global Migration"] = code_files
        
        frontend_data = []
        for i in targets:
            frontend_data.append({
                "dependency": i.get("dependency"),  
                "priority": i.get("priority"),
                "current_version": i.get("current_version"),
                "suggestion": i.get("suggestion"),
                "risk": i.get("risk")
            })

        try:
            initial_state = InputState(
                run_id=run_id,
                git_link=git_url,
                is_authenticated=User is not None, 
                topics=current_topics, 
                install_preset="",
                run_profile="",
                run_args={},
                code_files=code_files,
                dependencies=dependencies,
                dependencies_in_code_files=dependencies_in_code_files,
                targets=targets
            )
            runs[run_id] = initial_state
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"State initialization failed: {str(e)}")
        return frontend_data
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"CRITICAL ERROR in get_overview: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/run/{run_id}/generate_migration_plan")
def generate_migration_plan(run_id: str):
    try:
        if run_id not in runs:
            raise HTTPException(status_code=404, detail="Run ID not found")
        run_data = runs[run_id]
        
        if isinstance(run_data, dict):
             raise HTTPException(status_code=500, detail="Invalid run state: Data is dict, expected InputState")
        
        state = run_data
        print(f"Invoking graph for run {run_id}")
        result = graph.invoke(state)
        runs[run_id] = result
        return result
    except Exception as e:
        print(f"CRITICAL ERROR in generate_migration_plan: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {str(e)}")
def get_run_attr(run_state, attr_name, default=None):
    if isinstance(run_state, dict):
        return run_state.get(attr_name, default)
    return getattr(run_state, attr_name, default)

@app.get("/run/{run_id}/knowledge")
def get_knowledge(run_id: str):
    """ documents.append({
                    "priority": priority,
                    "query": q,
                    "title": r.get("title"),
                    "url": r.get("url"),
                    "content": r.get("content"),
                    "score": r.get("score"),
                    "chunk": content if flag else 'no_content',
                    "status": 'works' if flag else 'broken'
                })
    knwoldege docs conme in this format 
    """
    return get_run_attr(runs[run_id], "retrieved_docs", [])




@app.get("/run/{run_id}/plan")
def get_plan(run_id: str ,current_user: User = Depends(get_current_user_optional)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
    
    run_state = runs[run_id]
    depth = get_run_attr(run_state, "depth")
    
    if depth == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for deep research")
    
    return get_run_attr(run_state, "migration_rules"), get_run_attr(run_state, "risks")

@app.get("/run/{run_id}/changes")
def get_changes(run_id: str,current_user: User = Depends(get_current_user_optional)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
    
    run_state = runs[run_id]
    if get_run_attr(run_state, "depth") == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for deep research")
        
    gen_code = get_run_attr(run_state, "generated_code") or {}
    ini_code = get_run_attr(run_state, "code") or {}
    
    # Fallback if names mismatch in InputState
    if not ini_code:
        pass

    changed_code = {}
    for u,v in ini_code.items():
        if not gen_code.get(u):
            changed_code[u] = "No changes"
        else:
            i_code = v.splitlines()
            g_code = gen_code.get(u).splitlines()
            diff =  difflib.unified_diff(i_code,g_code,fromfile="initial_code",tofile="generated_code",lineterm="")
            changed_code[u] = "\n".join(diff)
    return {"Initial_code": ini_code, "Generated_code": gen_code, "Changed_code": changed_code}

@app.get("/run/{run_id}/verify")
def get_verify(run_id: str,current_user: User = Depends(get_current_user_optional)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
    
    run_state = runs[run_id]
    if get_run_attr(run_state, "depth") == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for deep research")
    return get_run_attr(run_state, "verify")

@app.get("/run/{run_id}/reflect")
def get_reflect(run_id: str,current_user: User = Depends(get_current_user_optional)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
        
    run_state = runs[run_id]
    if get_run_attr(run_state, "depth") == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for Reflection")
    return get_run_attr(run_state, "errors")


@app.get("/run/{run_id}/trace")
def get_trace(run_id: str,current_user: User = Depends(get_current_user_optional),req:ReflectionRequest = Depends()):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
        
    run_state = runs[run_id]
    if get_run_attr(run_state, "depth") == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for Trace")
        
    if req.action == "Knowledge":
        return get_run_attr(run_state, "retrieved_docs", [])
    elif req.action == "RuleSynthesis":
        return get_run_attr(run_state, "initial_rules")
    elif req.action == "MigrationRules":
        return get_run_attr(run_state, "migration_rules")
    elif req.action == "PatchGeneration":
        return get_run_attr(run_state, "generated_code")
    elif req.action == "Reflection":
        errors = get_run_attr(run_state, "errors")
        if not errors:
            return "Completed"
        else:
            return errors
    ##this is used to trace the working of the langgraph


