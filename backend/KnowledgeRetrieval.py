#--------------Assuming the files are already uploaded and we have what to convert from what version to what next version-----------------#
from huggingface_hub import InferenceClient
from api_import import HUGGING_FACE
from bs4 import BeautifulSoup
import requests
from urllib.parse import unquote
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode ,urljoin
from langchain_community.document_loaders import WebBaseLoader



topic = """Library: pydantic
From version: 1.x
To version: 2.x
Goal: migration and breaking changes
"""
guide = """
You are a search query and error-pattern generator.

Your task is to output COMPLETE, STANDALONE web search queries.

Rules:
- Output ONLY search queries or URLs.
- Output ONE query per line.
- Each line MUST be a complete query that can be pasted into a search engine.
- Each query MUST contain meaningful keywords related to the given migration.
- Do NOT repeat queries.
- Do NOT merge queries together.
- Do NOT add explanations or commentary.
- Do NOT add empty lines.

Guidelines:
- Prefer official documentation and primary sources (official docs, GitHub repositories, release notes).
- Use site filters (site:github.com, site:docs.*, site:stackoverflow.com) when they improve precision.
- Every query MUST include version context or breaking-change context if versions are provided.
- Stack Overflow queries MUST resemble realistic developer error searches (include error keywords or symptoms).
- Do NOT generate overly broad queries.
- Queries consisting only of the topic name or library name (e.g. "pydantic") are INVALID.
- Each query must be specific enough to retrieve migration-relevant information on its own.


If you cannot generate valid queries, output NOTHING.

"""
links=[]

def get_response():
    model_name = 'Qwen/Qwen2.5-7B-Instruct'
    client = InferenceClient(model=model_name,token=HUGGING_FACE)
    response = client.chat.completions.create(
        messages=[
            {"role": "system", "content": guide},
            {"role": "user", "content": f"Generate the answer according to the rules for the topic = {topic}"}
        ],
        max_tokens=100,
        temperature=0.1
    )
    query = response.choices[0].message.content
    query = query.strip().splitlines()
##temp link var to work on the search engine - 
query = [['pydantic 1.x to 2.x migration guide', 'pydantic 2.x breaking changes', 'pydantic 1.x to 2.x deprecation list', 'pydantic 1.x to 2.x migration documentation', 'pydantic 2.x migration from 1.x', 'pydantic 1.x to 2.x schema changes', 'pydantic 2.x migration guide official', 'pydantic 1.x to 2.x type changes']]
query = query[0]
links = []
def clean_ddg_link(href: str) -> str:
    if "uddg=" in href:
        return unquote(href.split("uddg=")[-1])
    return href

ALLOWED_QUERY_PARAMS = {
    "page",
    "p",
    "q",
    "tag",
    "version",
    "lang",
    "sort",
    "order",
}

def canonicalize_url(url: str) -> str:
    if not url:
        return ""
    if "&rut=" in url:
        url = url.split("&rut=")[0]
    
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = urljoin("https://duckduckgo.com", url)

    parsed = urlparse(url)

    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/") or "/"

    query_params = parse_qsl(parsed.query, keep_blank_values=False)
    filtered_params = [(k, v) for k, v in query_params if k in ALLOWED_QUERY_PARAMS]
    query = urlencode(filtered_params, doseq=True)

    return urlunparse((scheme, netloc, path, "", query, ""))


def duckduckgo_search(query: str, max_result: int = 10):
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    url = "https://duckduckgo.com/html/"
    params = {"q": query}

    response = requests.get(url, headers=HEADERS, params=params)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    links = []
    for a in soup.select("a.result__a", limit=max_result):
        href = a.get("href")
        if not href:
            continue
        clean = clean_ddg_link(href)
        links.append(canonicalize_url(clean))

    return links
links = duckduckgo_search(query[1])
print(links)






def rule_synth(extracted_data:list):
    model_name = 'Qwen/Qwen2.5-7B-Instruct'
    client = InferenceClient(model=model_name,token=HUGGING_FACE)
    response = client.chat.completions.create(
        messages=[
            {"role": "system", "content": guide},
            {"role": "user", "content": f"Generate the answer according to the rules for the topic = {topic}"}
        ],
        max_tokens=100,
        temperature=0.1
    )
    query = response.choices[0].message.content
    query = query.strip().splitlines()[0]

# i have to get the data in the format of
# conetxt = {{website_url:data})
# idk how i will do it but i have to  