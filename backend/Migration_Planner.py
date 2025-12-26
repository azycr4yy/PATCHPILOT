"""
Docstring for backend.Migration_Planner
We get a list of rules from RuleSynthesis 
The input of migration planner will be ->
{{
    "final_rules": [
      {{
        "rule_id": "canonical-id",
        "rule_text": "Final non-overlapping rule",
        "priority": "CRITICAL | HIGH | MEDIUM | LOW",
        "sources": [
          {{
            "url": "...",
            "evidence_snippet": "..."
          }}
        ]
}} + code_snippet + error from reflection agent

The output will be
Steps to change code + risks faced

"""
from api_import import HUGGING_FACE
from huggingface_hub import InferenceClient


MIGRATION_GUIDE = """You are a migration planning assistant.

You are given:
1. A list of FINAL, NON-OVERLAPPING migration rules.
2. A code snippet that must be migrated.
3. An error or warning from a reflection agent. (optional depends whether we get erros as an iput or not)

IMPORTANT CONSTRAINTS:
- The rules are authoritative and must not be reinterpreted, merged, or modified.
- Do NOT invent new rules.
- Do NOT refactor code unless a rule explicitly requires it.
- If a rule conflicts with the existing code, the code must change.
- If you are unsure how to apply a rule, do NOT guess. Flag it as a risk.
- Prefer minimal, safe changes over aggressive rewrites.

YOUR TASK:
1. Identify which rules apply to the given code.
2. Translate each applicable rule into a concrete code change.
3. Order the changes in a safe execution sequence.
4. Cross-check the plan against the reflection error.
5. Explicitly list risks, unknowns, or assumptions.

OUTPUT FORMAT (STRICT):

Migration Steps:
- Step 1:
  - Rule ID:
  - Priority:
  - Description of code change:
  - Source of Rule(urls):
- Step 2:
  - Rule ID:
  - Priority:
  - Description of code change:
  - Source of Rule(urls):
(...)

Risks and Caveats:
- Risk 1:
- Risk 2:
(...)

DO NOT include explanations unrelated to the migration.
DO NOT summarize the rules.
DO NOT suggest alternatives outside the rules.
If a rule requires configuration changes to enable behavior, apply configuration rules before behavior rules.
"""
model_name = "Qwen/Qwen2.5-14B-Instruct"
def migration_prompt(rules,code,error=None):
  client = InferenceClient(model=model_name,token=HUGGING_FACE)
  response = client.chat.completions.create(
      messages=[
          {"role": "system", "content": MIGRATION_GUIDE},
          {"role": "user", "content": f"Follow the guide with the inputs being: \n rules:{rules} \n code :{code} \n errors :{error} \n "}
      ],
      max_tokens=2048,
      temperature=0.1
  )
  queries = response.choices[0].message.content
  queries = queries.strip()
  return queries
rules = [
    {
        "rule_id": "pydantic-v2-parse-obj",
        "rule_text": "In Pydantic v2, BaseModel.parse_obj() must be replaced with BaseModel.model_validate().",
        "priority": "CRITICAL",
        "sources": [
            {
                "url": "https://docs.pydantic.dev/latest/migration/",
                "evidence_snippet": "parse_obj() has been replaced by model_validate() in Pydantic V2."
            }
        ]
    },
    {
        "rule_id": "pydantic-v2-from-orm",
        "rule_text": "In Pydantic v2, BaseModel.from_orm() is deprecated and must be replaced with BaseModel.model_validate() with from_attributes=True enabled in model configuration.",
        "priority": "CRITICAL",
        "sources": [
            {
                "url": "https://github.com/pydantic/pydantic/discussions/5678",
                "evidence_snippet": "from_orm is deprecated in v2; use model_validate with from_attributes=True."
            }
        ]
    },
    {
        "rule_id": "pydantic-v2-config-style",
        "rule_text": "In Pydantic v2, model configuration must be defined using the model_config attribute instead of an inner Config class.",
        "priority": "MEDIUM",
        "sources": [
            {
                "url": "https://docs.pydantic.dev/latest/concepts/models/#model-config",
                "evidence_snippet": "Configuration is now specified via the model_config attribute."
            }
        ]
    },
    {
        "rule_id": "pydantic-v2-json",
        "rule_text": "In Pydantic v2, BaseModel.json() must be replaced with BaseModel.model_dump_json().",
        "priority": "HIGH",
        "sources": [
            {
                "url": "https://stackoverflow.com/questions/77432012/pydantic-v2-json",
                "evidence_snippet": "json() is deprecated in Pydantic v2; model_dump_json() should be used instead."
            }
        ]
    }
]

error = "AttributeError: type object 'User' has no attribute 'parse_obj'"
code = """
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True

def load_user(data):
    return User.parse_obj(data)

def load_user_from_db(db_row):
    return User.from_orm(db_row)

user = load_user({"id": 1, "name": "Alice"})
print(user.json())
"""


ans = migration_prompt(rules=rules,code=code,error=error)
print(ans)
print(type(ans))
