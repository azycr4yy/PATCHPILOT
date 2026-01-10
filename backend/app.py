from fastapi import FastAPI, File, UploadFile, HTTPException, Form , Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import uuid
import shutil
import os
import subprocess
from models import InputConfig, InputType, ConfigResponse, AnalysisResponse, User , UserinDB , Token , TokenData
from fastapi.security import OAuth2PasswordBearer , OAuth2PasswordRequestForm
from fastapi import Depends
from RAGs.api_import import SECRET_KEY
from fastapi import Depends, HTTPException, status , FastAPI
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from uuid import uuid4


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
        "status": "queued"
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
            "filename": "",
            "gitlink" : "",
            "depth": "",
            "status": "queued"
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
async def analyze_github(url: str = Form(...), depth: str = Form("Quick Scan"), run_id: str = Form(None)):
    if run_id is None:
        run_id = uuid4().hex
        runs[run_id] = {
        "filename": "",
        "gitlink" : "",
        "depth": "",
        "status": "queued",
        "knowledge" : "",
        "plan": "",
        "changes": "",
        "verify": "",
        "reflect": "",
        "trace": ""
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
async def analyze(run_id: str = Query(...),current_user: User = Depends(get_current_user)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
    if runs[run_id]["depth"] == "Deep Research" and not current_user:
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

@app.get("/run/{run_id}/overview")
def get_overview(run_id: str = Path(...)):
    pass

@app.get("/run/{run_id}/knowledge")
def get_knowledge(run_id: str = Path(...)):
    pass

@app.get("/run/{run_id}/plan")
def get_plan(run_id: str = Path(...),current_user: User = Depends(get_current_user)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
    if runs[run_id]["depth"] == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for deep research")


@app.get("/run/{run_id}/changes")
def get_changes(run_id: str = Path(...),current_user: User = Depends(get_current_user)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
    if runs[run_id]["depth"] == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for deep research")


@app.get("/run/{run_id}/verify")
def get_verify(run_id: str = Path(...),current_user: User = Depends(get_current_user)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
    if runs[run_id]["depth"] == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for deep research")


@app.get("/run/{run_id}/reflect")
def get_reflect(run_id: str = Path(...),current_user: User = Depends(get_current_user)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
    if runs[run_id]["depth"] == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for deep research")


@app.get("/run/{run_id}/trace")
def get_trace(run_id: str = Path(...),current_user: User = Depends(get_current_user)):
    if run_id not in runs:
        raise HTTPException(404, "Run ID not found")
    if runs[run_id]["depth"] == "Deep Research" and not current_user:
        raise HTTPException(401, "Login required for deep research")


