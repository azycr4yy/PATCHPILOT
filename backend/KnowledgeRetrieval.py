#--------------Assuming the files are already uploaded and we have what to convert from what version to what next version-----------------#
from huggingface_hub import InferenceClient
topic = ["""Library: pydantic
From version: 1.x
To version: 2.x
Goal: migration and breaking changes
"""]
guide = """You are a search query and error-pattern generator.


Your ONLY task is to output search queries or URLs that can be used to retrieve:
1) authoritative documentation
2) common Stack Overflow error discussions

Rules:
- Output ONLY plain text.
- Output ONLY search queries or URLs.
- Separate each item with a single space.
- Do NOT use newlines.
- Do NOT use quotes.
- Do NOT number items.
- Do NOT add explanations or commentary.
- Do NOT include any text before or after the queries.

Guidelines:
- Prefer official documentation and GitHub sources.
- Include site filters when appropriate (e.g. site:github.com, site:stackoverflow.com).
- Include version information if provided.
- For Stack Overflow, include common error message fragments developers would search for.
- Error queries must look like real error searches, not explanations.

If any rule is violated, the output is invalid.
"""
model_name = "mistralai/Mistral-7B-Instruct-v0.3"
client = InferenceClient(model=model_name)

response = client.chat.completions.create(
    messages=[
        {"role": "system", "content": guide},
        {"role": "user", "content": "Generate the answer according to the rules for the topic = {topic}"}
    ],
    max_tokens=100,
    temperature=0.1
)
print(response.choices[0].message.content)
    