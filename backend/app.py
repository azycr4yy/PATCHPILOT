from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import uuid
import shutil
import os
import subprocess
from models import InputConfig, InputType, ConfigResponse, AnalysisResponse

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


UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
REPOS_DIR = "repos"
os.makedirs(REPOS_DIR, exist_ok=True)

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
                options=["Quick Scan", "Deep Analysis", "Security Audit"],
                required=True
            )
        ]
    )

@app.post("/upload", response_model=AnalysisResponse)
async def upload_file(file: UploadFile = File(...)):

    try:
        if not file.filename.endswith(('.zip', '.tar.gz')):
             raise HTTPException(status_code=400, detail="Invalid file format. Please upload a ZIP or TAR.GZ file.")

        file_location = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
        with open(file_location, "wb+") as buffer:
            shutil.copyfileobj(file.file, buffer)

        run_id = str(uuid.uuid4())
        
        return AnalysisResponse(
            run_id=run_id,
            status="uploaded",
            message=f"File {file.filename} uploaded successfully. Analysis run {run_id} created."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/github", response_model=AnalysisResponse)
async def analyze_github(url: str = Form(...), depth: str = Form("Quick Scan")):

    run_id = str(uuid.uuid4())
    
    # Extract repo name for folder creation
    try:
        # Simple extraction from URL
        repo_name = url.rstrip('/').split('/')[-1]
        if not repo_name:
             repo_name = "unknown_repo"
    except:
        repo_name = "unknown_repo"

    target_dir = os.path.join(REPOS_DIR, f"{run_id}_{repo_name}")

    try:
        # Clone the repository
        # Security Note: interactively running git with user provided URLs can be risky in prod without sanitization.
        # Assuming trusted user for this desktop app context.
        subprocess.run(["git", "clone", url, target_dir], check=True, capture_output=True)
        
        return AnalysisResponse(
            run_id=run_id,
            status="queued",
            message=f"GitHub repository {url} cloned to {target_dir} and queued for {depth}."
        )
    except subprocess.CalledProcessError as e:
         raise HTTPException(status_code=400, detail=f"Failed to clone repository: {e.stderr.decode() if e.stderr else str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
