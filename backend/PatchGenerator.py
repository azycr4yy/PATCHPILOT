"""
Docstring for backend.PatchGenerator
Output we get from Migration planner is eg - 
Migration Steps:
- Step 1:
  - Rule ID: pydantic-v2-parse-obj
  - Priority: CRITICAL
  - Description of code change: Replace `User.parse_obj(data)` with `User.model_validate(data)`.
  - Source of Rule(urls): https://docs.pydantic.dev/latest/migration/
- Step 2:
  - Rule ID: pydantic-v2-from-orm
  - Priority: CRITICAL
  - Description of code change: Replace `User.from_orm(db_row)` with `User.model_validate(db_row, from_attributes=True)`.
  - Source of Rule(urls): https://github.com/pydantic/pydantic/discussions/5678
- Step 3:
  - Rule ID: pydantic-v2-config-style
  - Priority: MEDIUM
  - Description of code change: Replace the inner `Config` class with `model_config` attribute.
  - Source of Rule(urls): https://docs.pydantic.dev/latest/concepts/models/#model-config
- Step 4:
  - Rule ID: pydantic-v2-json
  - Priority: HIGH
  - Description of code change: Replace `user.json()` with `user.model_dump_json()`.
  - Source of Rule(urls): https://stackoverflow.com/questions/77432012/pydantic-v2-json

Risks and Caveats:
- Risk 1: The replacement of `User.from_orm(db_row)` with `User.model_validate(db_row, from_attributes=True)` assumes that `db_row` is an ORM instance. If this assumption is incorrect, the migration may fail.
- Risk 2: Changing the configuration style from an inner `Config` class to `model_config` might introduce subtle differences in behavior if there were any custom configurations or hooks in the original `Config` class.
"""
from api_import import HUGGING_FACE
from huggingface_hub import InferenceClient
model_name = "Qwen/Qwen2.5-32B-Instruct"
CODING_GUIDE = """You are a code modification engine.

INPUTS YOU WILL RECEIVE:
1. A code snippet or codebase.
2. A list of migration steps produced by a migration planner.
   The migration steps are FINAL and AUTHORITATIVE.

EACH MIGRATION STEP INCLUDES:
- Rule ID
- Priority (CRITICAL > HIGH > MEDIUM > LOW)
- Description of code change
- One or more source URLs
- Optional risks and caveats (advisory only)

────────────────────────────────────────
ABSOLUTE OUTPUT RULES (NON-NEGOTIABLE)
────────────────────────────────────────
- The ONLY valid output is source code.
- Do NOT output explanations, reasoning, analysis, thoughts, or prose.
- Do NOT include bullet points, paragraphs, or summaries.
- Do NOT include reasoning markers or chain-of-thought.
- Any output that is not valid code is a failure.

────────────────────────────────────────
CODE MODIFICATION RULES
────────────────────────────────────────
- Apply migration steps strictly in the order provided.
- Respect rule priority when conflicts occur:
  - Higher-priority rules override lower-priority rules.
  - Lower-priority rules must NOT undo or override higher-priority changes.
- If two rules modify the same line or construct:
  - Apply the higher-priority rule.
  - Skip or partially apply the lower-priority rule as required.
- If a conflict cannot be resolved safely using priority alone:
  - Insert a TODO comment in the code.
  - Do NOT guess or invent behavior.
- Do NOT invent new rules.
- Do NOT merge, reinterpret, or rewrite rules.
- Do NOT refactor, rename, reformat, or optimize code unless explicitly required.
- Preserve all unrelated code EXACTLY as-is.

────────────────────────────────────────
RISK HANDLING RULES
────────────────────────────────────────
- Risks and caveats are CONTEXT ONLY.
- Do NOT change code solely because of a risk.
- If a risk prevents safe application of a rule:
  - Insert a TODO comment at the relevant location.
  - Do NOT attempt a workaround.

────────────────────────────────────────
TRACEABILITY REQUIREMENTS (STRICT)
────────────────────────────────────────
- For EVERY line of code that you modify or add:
  - Append an inline comment that includes:
    1. The description of the applied code change.
    2. The source URL(s) for that rule.
- Use the description verbatim or minimally adapted for grammar.
- Do NOT paraphrase or reinterpret the description.
- Do NOT add traceability comments to unchanged lines.
- If a lower-priority rule is skipped or overridden:
  - Insert a TODO comment explaining that it was skipped due to a higher-priority rule.
  - Include the rule ID and source URL.

────────────────────────────────────────
FORBIDDEN BEHAVIOR
────────────────────────────────────────
- Do NOT explain why a change was made.
- Do NOT describe assumptions.
- Do NOT mention risks outside TODO comments.
- Do NOT add helper comments or documentation.
- Do NOT add or remove imports unless required by a rule.
- Do NOT change formatting except where a change is applied.
"""
def code_generation(migration_steps:str,code:str):
  client = InferenceClient(model=model_name,token=HUGGING_FACE)
  USER_PROMPT = f"""Apply the following migration steps to the provided code.

Migration Steps:
{migration_steps}

Code to modify:
{code}

OUTPUT REQUIREMENTS:
- Return the FULL updated code.
- Apply migration steps respecting rule priority.
- Higher-priority rules may overwrite lower-priority changes.
- Every modified or added line MUST include an inline comment containing:
  - The migration step's description of the code change
  - The source URL(s) for that rule
- If a lower-priority step is skipped or overridden, document it with a TODO comment.
- Do NOT add explanations outside code comments.
- Do NOT change formatting except where required by the change.
"""
  response = client.chat.completions.create(
      messages=[
          {"role": "system", "content": CODING_GUIDE},
          {"role": "user", "content": USER_PROMPT}
      ],
      max_tokens=2048,
      temperature=0.0
  )
  queries = response.choices[0].message.content
  queries = queries.strip()
  return queries
code = """from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    id: int
    name: str
    email: Optional[str]

    class Config:
        orm_mode = True
        anystr_strip_whitespace = True


def load_user_from_request(data: dict) -> User:
    user = User.parse_obj(data)
    return user


def load_user_from_db(db_row) -> User:
    return User.from_orm(db_row)


def serialize_user(user: User) -> str:
    return user.json()
"""

migration_steps = """Migration Steps:
- Step 1:
  - Rule ID: pydantic-v2-parse-obj
  - Priority: CRITICAL
  - Description of code change: Replace `User.parse_obj(data)` with `User.model_validate(data)`.
  - Source of Rule(urls): https://docs.pydantic.dev/latest/migration/
- Step 2:
  - Rule ID: pydantic-v2-from-orm
  - Priority: CRITICAL
  - Description of code change: Replace `User.from_orm(db_row)` with `User.model_validate(db_row, from_attributes=True)`.
  - Source of Rule(urls): https://github.com/pydantic/pydantic/discussions/5678
- Step 3:
  - Rule ID: pydantic-v2-config-style
  - Priority: MEDIUM
  - Description of code change: Replace the inner `Config` class with `model_config` attribute.
  - Source of Rule(urls): https://docs.pydantic.dev/latest/concepts/models/#model-config
- Step 4:
  - Rule ID: pydantic-v2-json
  - Priority: HIGH
  - Description of code change: Replace `user.json()` with `user.model_dump_json()`.
  - Source of Rule(urls): https://stackoverflow.com/questions/77432012/pydantic-v2-json

Risks and Caveats:
- Risk 1: The replacement of `User.from_orm(db_row)` with `User.model_validate(db_row, from_attributes=True)` assumes that `db_row` is an ORM instance. If this assumption is incorrect, the migration may fail.
- Risk 2: Changing the configuration style from an inner `Config` class to `model_config` might introduce subtle differences in behavior if there were any custom configurations or hooks in the original `Config` class.
"""
ans = code_generation(migration_steps=migration_steps,code=code)
print(ans)
