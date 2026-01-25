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
from RAGs.api_import import HUGGING_FACE

from utils import retry_with_backoff


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

from model_utils import get_llm_client, MODEL_NAME

class MigrationPlanner:
    def __init__(self, model_name: str = MODEL_NAME):
        self.model_name = model_name
        self.client = get_llm_client(model_name)

    @retry_with_backoff()
    def plan_migration(self, rules, code, error=None):
        response = self.client.chat.completions.create(
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

