import os
import json
from loguru import logger

# ── Safe Import with Mock Fallback (Fail-Safe Engineering) ─────────────────────
CHROMA_AVAILABLE = True
if os.environ.get("RENDER") or os.environ.get("VERCEL") or os.environ.get("DISABLE_CHROMA") == "true":
    CHROMA_AVAILABLE = False
    logger.info("ℹ️ Running in Render/low-memory environment. Disabling ChromaDB to prevent ONNX model download OOM (512MB RAM limit). Using memory-efficient in-memory fallback.")
else:
    try:
        import chromadb
        from chromadb.config import Settings
    except ImportError:
        CHROMA_AVAILABLE = False
        logger.warning("⚠️ 'chromadb' package is not installed. Using lightweight MockRAGEngine fallback.")

class RAGService:
    def __init__(self, db_path: str = "./chroma_db"):
        self.db_path = db_path
        self.client = None
        self.collection = None
        self.mock_db = []  # Fallback in-memory database
        
        if CHROMA_AVAILABLE:
            try:
                # Ensure the data directory exists
                os.makedirs(db_path, exist_ok=True)
                self.client = chromadb.PersistentClient(
                    path=db_path,
                    settings=Settings(allow_reset=True)
                )
                self.collection = self.client.get_or_create_collection("resource_kb")
                logger.info(f"🎯 Persistent ChromaDB initialized at: {db_path}")
            except Exception as e:
                logger.warning(f"Failed to initialize ChromaDB at {db_path}: {e}. Retrying with temporary directory /tmp/chroma_db...")
                try:
                    alt_path = "/tmp/chroma_db"
                    os.makedirs(alt_path, exist_ok=True)
                    self.client = chromadb.PersistentClient(
                        path=alt_path,
                        settings=Settings(allow_reset=True)
                    )
                    self.collection = self.client.get_or_create_collection("resource_kb")
                    self.db_path = alt_path
                    logger.info(f"🎯 Persistent ChromaDB initialized at: {alt_path}")
                except Exception as e2:
                    logger.error(f"Failed to initialize ChromaDB: {e2}. Falling back to MockRAGEngine.")
                    self.client = None

    def auto_seed(self):
        """
        Loads curated resources from the JSON seed database and indices them in ChromaDB.
        Runs once on container/server startup.
        """
        seed_file_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "data",
            "curated_resources.json"
        )
        
        if not os.path.exists(seed_file_path):
            logger.warning(f"Seed file not found at {seed_file_path}. Skipping auto-seeding.")
            return

        try:
            with open(seed_file_path, "r", encoding="utf-8") as f:
                resources = json.load(f)
        except Exception as e:
            logger.error(f"Failed to read seed file: {e}")
            return

        # Populating the Mock DB fallback always
        self.mock_db = resources
        logger.info(f"Loaded {len(resources)} curated resources into memory.")

        if self.client and self.collection:
            try:
                # Check if collection is already populated and matches length to avoid stale seeding
                count = self.collection.count()
                if count == len(resources):
                    logger.info(f"ChromaDB collection already contains all {count} items. Skipping seeding.")
                    return

                logger.info(f"Collection count ({count}) differs from curated resources count ({len(resources)}). Re-indexing database...")
                try:
                    self.client.delete_collection("resource_kb")
                except Exception:
                    pass
                self.collection = self.client.create_collection("resource_kb")
                
                logger.info("Starting high-speed auto-seeding in ChromaDB...")
                
                texts = []
                metadatas = []
                ids = []

                for idx, res in enumerate(resources):
                    # ChromaDB matches query text against 'documents'
                    # We combine Title and Topic to form rich semantic documents
                    doc_content = f"Topic: {res['topic']} | Title: {res['title']}"
                    texts.append(doc_content)
                    
                    metadatas.append({
                        "topic": res["topic"],
                        "youtube_url": res.get("youtube_url", ""),
                        "article_url": res.get("article_url", ""),
                        "github_url": res.get("github_url", ""),
                        "doc_url": res.get("doc_url", "")
                    })
                    ids.append(f"res_id_{idx}")

                # ChromaDB auto-downloads 'all-MiniLM-L6-v2' local embeddings internally
                self.collection.add(
                    documents=texts,
                    metadatas=metadatas,
                    ids=ids
                )
                logger.info(f"🚀 Successfully indexed {len(texts)} gold-standard resources in ChromaDB!")
            except Exception as e:
                logger.error(f"Error seeding ChromaDB: {e}. Fallback database is ready.")
        else:
            logger.info("Auto-seeding: ChromaDB not available. Fallback in-memory indexing active.")

    def query_similarity(self, query_text: str, n_results: int = 1) -> list:
        """
        Queries the Vector DB for similar topics.
        If ChromaDB is disabled or fails, it falls back to a smart keyword-based search.
        """
        query_text_lower = query_text.lower()
        
        # ── 1. If ChromaDB is Active, use Vector Cosine Search ──
        if self.client and self.collection:
            try:
                results = self.collection.query(
                    query_texts=[query_text],
                    n_results=n_results
                )
                
                formatted = []
                if results and "documents" in results and results["documents"]:
                    docs = results["documents"][0]
                    metas = results["metadatas"][0] if results["metadatas"] else [{}] * len(docs)
                    distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)
                    
                    for doc, meta, dist in zip(docs, metas, distances):
                        # Convert distance to similarity score
                        similarity = round(1.0 - dist, 4)
                        formatted.append({
                            "content": doc,
                            "metadata": meta,
                            "similarity_score": similarity
                        })
                return formatted
            except Exception as e:
                logger.error(f"ChromaDB query failed: {e}. Falling back to semantic lookup.")

        # ── 2. Fallback Smart Keyword Semantic Matcher (Zero Dependencies) ──
        matches = []
        for res in self.mock_db:
            # Score based on keyword presence
            score = 0
            topic_words = res["topic"].lower().split()
            title_words = res["title"].lower().split()
            
            for word in topic_words + title_words:
                if len(word) > 3 and word in query_text_lower:
                    score += 5
            
            # Direct full matches get high scores
            if res["topic"].lower() in query_text_lower or query_text_lower in res["topic"].lower():
                score += 15

            if score > 0:
                matches.append((score, res))

        # Sort matches by highest score first
        matches = sorted(matches, key=lambda x: x[0], reverse=True)
        
        formatted_fallback = []
        for score, res in matches[:n_results]:
            formatted_fallback.append({
                "content": f"Topic: {res['topic']} | Title: {res['title']}",
                "metadata": {
                    "topic": res["topic"],
                    "youtube_url": res.get("youtube_url", ""),
                    "article_url": res.get("article_url", ""),
                    "github_url": res.get("github_url", ""),
                    "doc_url": res.get("doc_url", "")
                },
                "similarity_score": round(min(1.0, 0.5 + (score / 40)), 2)
            })
            
        return formatted_fallback

# Initialize global engine
rag_engine = RAGService()
