from RAGs.api_import import HUGGING_FACE
from utils import retry_with_backoff

from model_utils import get_llm_client, MODEL_NAME

class RuleSynthesizer:
    def __init__(self):
        self.model_guide = MODEL_NAME
        self.model_supervise = MODEL_NAME
        self.client_guide = get_llm_client(self.model_guide)
        self.client_supervise = get_llm_client(self.model_supervise)

    @retry_with_backoff()
    def get_guidance(self, doc):
        GUIDE_SYNTHESIS = f"""
        You are a rule synthesis engine.

        Your task is to read a SINGLE content chunk extracted from technical documentation
        and convert it into one or more precise, implementation-ready rules.

        INPUT:
        - query: {doc.get("query", "")}
        - title: {doc.get("title", "")}
        - url: {doc.get("url", "")}
        - content_chunk: {doc.get("chunk", "")}
        - retrieval_score: {doc.get("score", "")}
        - retrieval_priority_hint: {doc.get("priority", "")}

        INSTRUCTIONS:
        1. Extract ONLY rules directly supported by the content chunk.
        2. If no actionable rule exists, return an empty list.
        3. Each rule must be atomic and unambiguous.
        4. Do NOT invent or generalize rules.
        5. Write rules suitable for later overlap comparison.

        PRIORITY LEVELS:
        - CRITICAL
        - HIGH
        - MEDIUM
        - LOW

        OUTPUT FORMAT (STRICT JSON ONLY):

        {{
            "rules": [
                {{
                    "rule_id": "short-id",
                    "rule_text": "Clear enforceable rule",
                    "priority": "CRITICAL | HIGH | MEDIUM | LOW",
                    "source": {{
                        "title": "...",
                        "url": "..."
                    }}
                }}
            ]
        }}
        """
        response = self.client_guide.chat.completions.create(
            messages=[
                {"role": "system", "content": GUIDE_SYNTHESIS},
                {"role": "user", "content": "Genrate answer according to the guide "}
            ],
            max_tokens=1024,
            temperature=0.4
        )
        queries = response.choices[0].message.content
        queries = self._clean_json(queries)
        return queries

    def _clean_json(self, text):
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text.rsplit("\n", 1)[0]
        return text.strip()

    def get_supervision(self, rules_json):
        SUPERVISE_GUIDE = f"""
        You are a rule compiler and consistency checker.

        Your task is to take a LIST of synthesized rules and produce a FINAL,
        NON-OVERLAPPING, CONSISTENT rule set.

        INPUT RULES (JSON FORMAT):
        {rules_json}

        INSTRUCTIONS:
        1. Detect semantic overlap or duplication.
        2. Merge overlapping rules using the most restrictive interpretation.
        3. Resolve conflicts using higher priority and stronger evidence.
        4. Discard weaker or redundant rules 
        5. Normalize priorities to avoid overuse of CRITICAL.

        OUTPUT FORMAT (STRICT JSON ONLY):

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
                }}
            ]
            }}
        """
        response = self.client_supervise.chat.completions.create(
            messages=[
                {"role": "system", "content": SUPERVISE_GUIDE},
                {"role": "user", "content": f"Genrate answer according to the guide \n {rules_json}"}
            ],
            max_tokens=2048,
            temperature=0.1
        )
        queries = response.choices[0].message.content
        queries = self._clean_json(queries)
        return queries

    def rules_synthesis(self, docs):
        rules = []
        for doc in docs:
            rule = self.get_guidance(doc)
            rules.append(rule)
        return rules

    def rule_compiler(self, rules_json):
        final_rules = self.get_supervision(rules_json)
        return final_rules