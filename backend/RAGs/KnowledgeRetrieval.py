from huggingface_hub import InferenceClient
from .api_import import HUGGING_FACE, TAVILY
from urllib.parse import urlparse
from langchain_community.document_loaders import WebBaseLoader
from tavily import TavilyClient
from pydantic import AnyUrl
from utils import retry_with_backoff

from model_utils import get_llm_client, MODEL_NAME

class KnowledgeRetriever:
    def __init__(self):
        self.hf_token = HUGGING_FACE
        self.tavily_api_key = TAVILY
        self.ui_patterns = [
            r"skip to content",
            r"table of contents",
            r"was this page helpful",
            r"back to top",
            r"edit this page",
            r"previous\s+next",
            r"on this page",
        ]
        # Default hardcoded queries for fallback or specific testing
        self.default_queries = [
            'pydantic 1.x to 2.x migration guide',
            'pydantic 2.x breaking changes',
            'pydantic 1.x to 2.x deprecation list',
            'pydantic 1.x to 2.x migration documentation',
            'pydantic 2.x migration from 1.x',
            'pydantic 1.x to 2.x schema changes',
            'pydantic 2.x migration guide official',
            'pydantic 1.x to 2.x type changes'
        ]

    @retry_with_backoff()
    def generate_queries(self, topic):
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
        model_name = MODEL_NAME
        client = get_llm_client(model_name)
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": guide},
                {"role": "user", "content": f"Generate the answer according to the rules for the topic = {topic}"}
            ],
            max_tokens=100,
            temperature=0.1
        )
        content = response.choices[0].message.content
        queries = [q.strip() for q in content.strip().splitlines() if q.strip()]
        return queries

    def chunking_results(self, link: AnyUrl):
        try:
            docs = WebBaseLoader(link).load()
        except Exception as e:
            print(f"Error loading {link}: {e}")
            return None
        if not docs or len(docs[-1].page_content) < 10:
            return None
        if "Enable JavaScript and cookies to continue" in docs[-1].page_content:
            return None

        normalized = []
        for doc in docs:
            text = doc.page_content
            text = text.replace("\t", " ")
            text = "\n".join(l.strip() for l in text.splitlines())
            text = "\n".join(l for l in text.splitlines() if l)
            if len(text.split()) < 10:
                continue
            for pattern in self.ui_patterns:
                text = text.replace(pattern, "")
            doc.page_content = text
            normalized.append(doc)
        return normalized

    @retry_with_backoff()
    def priority_assignment(self, url):
        url_parsed = urlparse(url)
        hostname = url_parsed.hostname
        if hostname == 'github.com':
            return 'High'
        elif 'docs.' in hostname:
            return 'Critical'
        elif hostname == 'stackoverflow.com':
            return 'Medium'
        else:
            model_name = MODEL_NAME
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
                    "Critical | High | Medium | low"
                    """
            client = get_llm_client(model_name)
            try:
                response = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": guide},
                        {"role": "user", "content": f"{url}"}
                    ],
                    max_tokens=100,
                    temperature=0.1
                )
                authority_level = response.choices[0].message.content
                authority_level = authority_level.strip().splitlines()[0]
                return authority_level
            except Exception:
                return 'Low'

    def search(self, search_queries=None):
        if not search_queries:
            print("No generated queries provided. Falling back to default queries.")
            search_queries = self.default_queries
        client = TavilyClient(api_key=self.tavily_api_key)
        documents = []
        for q in search_queries:
            print(f"Searching for: {q}")
            try:
                response = client.search(
                    query=q,
                    max_results=1,
                )
            except Exception as e:
                print(f"Error searching for {q}: {e}")
                continue
                
            for r in response.get("results", []):
                flag = True
                url = r.get("url")
                if "youtube" in url:
                    continue
                print(f"Processing URL: {url}")
                try:
                    content = self.chunking_results(url)
                    if not content:
                        flag = False
                except Exception as e:
                    print(f"  Failed to chunk {url}: {e}")
                    flag = False
                    continue
                
                priority = self.priority_assignment(url)
                
                documents.append({
                    "priority": priority,
                    "query": q,
                    "title": r.get("title"),
                    "url": r.get("url"),
                    "content": r.get("content"),
                    "score": r.get("score"),
                    "chunk": "\n\n".join([d.page_content for d in content]) if flag and content else 'no_content',
                    "status": 'works' if flag else 'broken'
                })
        return documents
