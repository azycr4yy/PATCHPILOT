#--------------Assuming the files are already uploaded and we have what to convert from what version to what next version-----------------#
from huggingface_hub import InferenceClient
from api_import import HUGGING_FACE ,TAVILY
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode ,urljoin
from langchain_community.document_loaders import WebBaseLoader
from tavily import TavilyClient
import time
from pydantic import AnyUrl
from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter
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
    queries = response.choices[0].message.content
    queries = query.strip().splitlines()[0]
    return queries
##temp link var to work on the search engine - 
queries = [['pydantic 1.x to 2.x migration guide', 'pydantic 2.x breaking changes', 'pydantic 1.x to 2.x deprecation list', 'pydantic 1.x to 2.x migration documentation', 'pydantic 2.x migration from 1.x', 'pydantic 1.x to 2.x schema changes', 'pydantic 2.x migration guide official', 'pydantic 1.x to 2.x type changes']]
query = queries[0]
links = []

def chunking_results(link:AnyUrl):
    docs = WebBaseLoader(link).load()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_documents(docs)
    return chunks


def priority_assignment(url):
    url_parsed = urlparse(url)
    hostname = url_parsed.hostname
    if hostname == 'github.com':
        return 'High'
    elif 'docs.' in hostname:
        return 'High'
    elif hostname == 'stackoverflow.com':
        return 'Medium'
    else:
        model_name = 'mistralai/Mistral-7B-Instruct-v0.2'
        guide = """You are a source authority classifier.

Your task is to assign an authority level to a web source
based only on its origin and role, not on the claims it makes.

Authority levels:
- high: official documentation, specifications, or primary maintainers
- medium: widely trusted community-maintained sources
- low: personal blogs, opinion pieces, SEO content, forums

Rules:
- If the source is not official, it cannot be high.
- If unsure, choose the lower authority.
- Never infer authority from writing quality or popularity.
- Never override known official domains.
- Base your decision on source type and domain only.

Output ONLY valid one word answer:
"High | Medium | low"
"""
        client = InferenceClient(model=model_name,token=HUGGING_FACE)
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content":guide },
                {"role": "user", "content": f"{url}"}
            ],
            max_tokens=100,
            temperature=0.1
        )
        queries = response.choices[0].message.content
        queries = query.strip().splitlines()[0]
        return queries
    


def search():
    client = TavilyClient(api_key=TAVILY)
    documents = []

    for q in queries:
        response = client.search(
            query=q,
            max_results=5,
        )
        for r in response.get("results", []):
            flag = True
            url = r.get("url")
            try:
                content = chunking_results(url)
            except Exception as e:
                flag = False
                continue
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