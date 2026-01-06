import json
import os 
from pathlib import Path
from ProjectIngestion import  process_file
OUTPUT_STRUCT = {
  "dependency": "",
  "priority": "",
  "current_version": "",
  "suggestion": "",
  "risk": ""
}

def target_discovery(count_dependencies,deps):
    for dep in count_dependencies:
        OUTPUT_STRUCT["dependency"] = dep
        OUTPUT_STRUCT["priority"] = "high" if count_dependencies[dep] > 3 else "low"
        OUTPUT_STRUCT["current_version"] = deps[dep]
        OUTPUT_STRUCT["suggestion"] = "upgrade" if count_dependencies[dep] > 1 else "downgrade"
        OUTPUT_STRUCT["risk"] = "high" if OUTPUT_STRUCT["priority"] == "high" else "medium" if OUTPUT_STRUCT["priority"] == "medium" else "low"

    return OUTPUT_STRUCT