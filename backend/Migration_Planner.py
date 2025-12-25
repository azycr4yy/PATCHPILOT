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