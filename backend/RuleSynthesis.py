"""
this is the output we will get from KnowledgeRetrieval.py and we have to use this as an input to our llm
 documents.append({
                "priority":priority_assignment(),
                "query": q,
                "title": r.get("title"),
                "url": r.get("url"),
                "content": r.get("content"),
                "score": r.get("score"),
                "chunk":content if flag else 'no_content',
                "status":'works' if flag else 'broken'
            })
we will basically feed the llm chunks -> it will make rules out of the chunks -> after all chunks are done we feed the rules made back into the llm so no rules overlap each other

chunks -> llm -> rules -> llm
"""
from api_import import HUGGING_FACE
from huggingface_hub import InferenceClient
model_guide = 'Qwen/Qwen2.5-7B-Instruct'
model_supervise = "Qwen/Qwen2.5-32B-Instruct" 
def get_guidance(doc):
  GUIDE_SYNTHESIS = rule_synthesis_prompt = f"""
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
  client = InferenceClient(model=model_guide,token=HUGGING_FACE)
  response = client.chat.completions.create(
      messages=[
          {"role": "system", "content": GUIDE_SYNTHESIS},
          {"role": "user", "content": f"Genrate answer according to the guide "}
      ],
      max_tokens=1024,
      temperature=0.4
  )
  queries = response.choices[0].message.content
  queries = queries.strip().splitlines()[0]
  return queries
def get_supervision(rules_json):
  SUPERVISE_GUIDE = rule_compiler_prompt = f"""
  You are a rule compiler and consistency checker.

  Your task is to take a LIST of synthesized rules and produce a FINAL,
  NON-OVERLAPPING, CONSISTENT rule set.

  INPUT RULES (JSON):
  {rules_json}

  INSTRUCTIONS:
  1. Detect semantic overlap or duplication.
  2. Merge overlapping rules using the most restrictive interpretation.
  3. Resolve conflicts using higher priority and stronger evidence.
  4. Discard weaker or redundant rules with justification.
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
    ],
    "discarded_rules": [
      {{
        "rule_id": "...",
        "reason": "duplicate | conflicting | subsumed"
      }}
    ]
  }}
  """
  client = InferenceClient(model=model_guide,token=HUGGING_FACE)
  response = client.chat.completions.create(
      messages=[
          {"role": "system", "content": SUPERVISE_GUIDE},
          {"role": "user", "content": f"Genrate answer according to the guide "}
      ],
      max_tokens=2048,
      temperature=0.1
  )
  queries = response.choices[0].message.content
  queries = queries.strip().splitlines()[0]
  return queries
def rules_synthesis(docs):
    rules=[]
    for doc in docs:
        rule = get_guidance(doc)
        rules.append(rule)
    return rules
def rule_compiler(rules_json):
    final_rules = get_supervision(rules_json)
    return final_rules

"""
doc ={
    "priority": "HIGH",
    "query": "pydantic v2 migration",
    "title": "Pydantic V2 Migration Guide",
    "url": "https://docs.pydantic.dev/latest/migration/",
    "content": (
        "In Pydantic v2, BaseModel.parse_obj() has been removed. "
        "Users must now use BaseModel.model_validate() to validate "
        "Python dictionaries. Attempting to use parse_obj will raise "
        "an AttributeError."
    ),
    "score": 0.91,
    "chunk": (
        "BaseModel.parse_obj() has been removed in Pydantic v2. "
        "To validate a dictionary, use BaseModel.model_validate(data). "
        "Calling parse_obj will result in an AttributeError."
    ),
    "status": "works"
}
"""