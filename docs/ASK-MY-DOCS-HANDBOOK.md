# Ask My Docs — Conceptual Learning Handbook 📖

> A comprehensive, code-independent conceptual guide and interview revision handbook for Retrieval-Augmented Generation (RAG) systems, vector databases, hybrid search, neural reranking, factual evaluation, and production engineering.

---

## Table of Contents

1. [RAG Fundamentals](#1-rag-fundamentals)
2. [Document Processing & Chunking](#2-document-processing--chunking)
3. [Embeddings & Vector Representations](#3-embeddings--vector-representations)
4. [Vector Search & Approximate Nearest Neighbors](#4-vector-search--approximate-nearest-neighbors)
5. [Lexical Search & Inverted Indexes](#5-lexical-search--inverted-indexes)
6. [Hybrid Retrieval & Rank Fusion](#6-hybrid-retrieval--rank-fusion)
7. [Neural Reranking](#7-neural-reranking)
8. [Context Assembly & LLM Generation](#8-context-assembly--llm-generation)
9. [Citation Verification & Attribution Repair](#9-citation-verification--attribution-repair)
10. [Evaluation Framework & LLM-as-a-Judge](#10-evaluation-framework--llm-as-a-judge)
11. [Observability & Distributed Tracing](#11-observability--distributed-tracing)
12. [Backend Architecture & Application Design](#12-backend-architecture--application-design)
13. [Frontend Architecture & Client Separation](#13-frontend-architecture--client-separation)
14. [Infrastructure, Docker & Model Runtimes](#14-infrastructure-docker--model-runtimes)
15. [Continuous Integration & Automated Quality Gates](#15-continuous-integration--automated-quality-gates)
16. [Summary of Core Engineering Tradeoffs](#16-summary-of-core-engineering-tradeoffs)

---

## 1. RAG Fundamentals

### What is RAG?
Retrieval-Augmented Generation (RAG) is an architectural pattern that enhances Large Language Models (LLMs) by retrieving relevant factual passages from an external, authoritative knowledge base and supplying them in the model's context window before text generation.

### Parametric vs. Non-Parametric Memory
- **Parametric Memory**: The static knowledge stored inside the model's neural network weights (parameters), acquired during pre-training and fine-tuning.
- **Non-Parametric Memory**: Dynamic external knowledge stored in external databases, document indexes, or knowledge graphs, retrieved dynamically at query time.

```
+-------------------------------------------------------------------------+
|                              RAG PARADIGM                               |
|                                                                         |
|  [ User Query ] ──► [ Neural Retriever ] ──► [ Non-Parametric Storage ]  |
|                                                       │                 |
|                                                       ▼                 |
|  [ LLM Generator ] ◄── [ Augmented Context ] ◄── [ Retrieved Chunks ]   |
|  (Parametric)                                                           |
|        │                                                                |
|        ▼                                                                |
|  [ Factually Grounded Response with Citations ]                         |
+-------------------------------------------------------------------------+
```

### Why RAG Helps Knowledge-Intensive Tasks
1. **Eliminates Knowledge Cutoffs**: LLM weights are frozen upon training completion; non-parametric memory can be updated continuously without expensive model retraining.
2. **Mitigates Hallucinations**: Constrains the generation to explicit reference texts, reducing speculative or fabricated statements.
3. **Provides Source Attribution**: Enables verifiable citations and audit trails for high-stakes enterprise and academic use cases.
4. **Protects Private Domain Data**: Allows proprietary documents to be queried securely without fine-tuning public or third-party base models.

### Key Conceptual Distinctions
- **RAG vs. Fine-Tuning**: Fine-tuning teaches a model *how to speak* (style, tone, syntax, task formatting); RAG teaches a model *what to know* (facts, documents, fresh data). Fine-tuning does not reliably prevent hallucination or guarantee citation accuracy.
- **RAG vs. Search Engine**: A search engine returns links or documents leaving synthesis to the human; RAG synthesizes an exact answer grounded in those retrieved documents.

### Interview Questions
- *Q: Why not just fine-tune an LLM on your documents instead of building a RAG system?*
  - **Answer**: Fine-tuning encodes knowledge probabilistically into weights where facts can still be hallucinated or confused. It is slow and expensive to update when documents change, cannot provide precise citation spans, and cannot support user-level document access controls.
- *Q: What are the primary failure modes of a naive RAG system?*
  - **Answer**: Retrieval failure (relevant context not fetched), noise injection (distracting irrelevant context fetched), context overflow (exceeding token limits), and generation hallucination (ignoring the context).

---

## 2. Document Processing & Chunking

### What is Document Processing?
Document processing is the preparation phase where unstructured source files (such as academic PDFs) are converted into structured, searchable text representations while preserving page numbers, section headers, and semantic boundaries.

### Chunk Size & Context Windows
Chunking breaks large documents into smaller text units. 
- **Small Chunks (e.g. 128 tokens)**: High embedding specificity; minimal retrieval noise; but risks fragmenting sentences and losing surrounding context.
- **Large Chunks (e.g. 1024 tokens)**: Rich surrounding context; but dilutes embedding vectors and introduces irrelevant text into the prompt.
- **Our Selection**: ~512 tokens with 64-token overlap, providing optimal granularity for research paragraphs.

```
Document: "FlashAttention is an exact attention algorithm... It uses tiling to reduce HBM traffic..."
          │
          ├──────── Chunk 0 (0-512 tokens) ───────┤
                                 ├────── Chunk 1 (448-960 tokens) ──────┤  (64 Token Overlap)
```

### Sentence-Aware Chunking
Naive character or whitespace slicing splits words or sentences in half, causing grammatical incoherence and corrupted embeddings. Sentence-aware chunking uses sentence boundary detectors (regex or NLP tokenizers) to ensure that chunks end strictly on complete sentence delimiters (`.`, `?`, `!`).

### Overlap & Context Preservation
Chunk overlap (e.g., 10–15% of chunk size) ensures that ideas spanning across chunk boundaries are not lost during retrieval, preventing boundary cutoff errors.

### Interview Questions
- *Q: Why is chunk overlap necessary?*
  - **Answer**: If a crucial insight begins in the last 20 words of chunk $N$ and concludes in the first 20 words of chunk $N+1$, an embedding of either chunk alone might fail to capture the complete semantic relation. Overlap ensures at least one chunk contains the complete proposition.
- *Q: How does PDF layout complexity affect RAG?*
  - **Answer**: Multi-column layouts, tables, headers, footers, and footnotes can contaminate the reading order if parsed naively, injecting disconnected fragments into chunks.

---

## 3. Embeddings & Vector Representations

### What is an Embedding?
An embedding is a learned mapping of text into a high-dimensional vector space ($\mathbb{R}^D$), where geometric proximity (angle and distance) reflects semantic similarity.

```
       "RAG combines memory" ──► [ 0.042, -0.198, 0.812, ..., 0.015 ]  (768 dimensions)
       "Retrieval augmented" ──► [ 0.040, -0.185, 0.820, ..., 0.019 ]  (High Cosine Similarity)
       "Recipe for pancakes" ──► [ -0.721, 0.450, -0.110, ..., 0.334 ]  (Low Cosine Similarity)
```

### Vector Dimensions & Model Choice
- `nomic-embed-text`: 768 dimensions. Compact vector footprint with high retrieval benchmark performance (MTEB).
- **Consistency Rule**: You **must** use the identical embedding model for both indexing document chunks and embedding incoming user queries. Mixing models or dimensions corrupts similarity calculations completely.

### Asymmetric Search & Task Prefixes
Modern embedding models distinguish between short search queries and long document passages using task prefixes (e.g. `search_query:` vs. `search_document:`), training the vector space to accommodate asymmetric query-to-document relationships.

### Interview Questions
- *Q: What happens if you index documents with one embedding model and embed queries with a different one?*
  - **Answer**: Retrieval collapses. Every embedding model maps concepts to its own unique coordinate system. Cross-model cosine similarity is mathematically meaningless noise.
- *Q: What is the Curse of Dimensionality in vector search?*
  - **Answer**: In very high-dimensional spaces, the distance between data points becomes relatively uniform, making traditional spatial search algorithms slow and ineffective without specialized indexing like HNSW.

---

## 4. Vector Search & Approximate Nearest Neighbors

### Cosine Similarity vs. Cosine Distance
- **Cosine Similarity**: Measures the cosine of the angle between two vectors:
  $$\text{Cosine Similarity}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$$
  Ranges from $-1.0$ (opposite) to $+1.0$ (identical direction).
- **Cosine Distance**: Normalized metric used for index optimization:
  $$\text{Cosine Distance} = 1 - \text{Cosine Similarity}$$
  Ranges from $0.0$ (identical) to $2.0$.

### Why pgvector?
`pgvector` brings native vector capabilities directly into PostgreSQL. Rather than managing a separate vector database cluster with synchronization pipelines and separate backup strategies, `pgvector` stores embeddings directly in relational tables alongside document metadata.

### Hierarchical Navigable Small World (HNSW)
Exact nearest neighbor search (k-NN) scans every single vector in the database ($\mathcal{O}(N)$), which is prohibitively slow for millions of vectors. HNSW constructs a multi-layer graph where:
- Upper layers have long-range links for fast, coarse spatial navigation.
- Bottom layers have short-range links for fine-grained nearest-neighbor convergence.
- Query search complexity drops to $\mathcal{O}(\log N)$.

```
Layer 2 (Coarse):     (Node A) --------------------------> (Node Z)
                         │                                    │
Layer 1 (Medium):     (Node A) ---------> (Node M) ---------> (Node Z)
                         │                   │                │
Layer 0 (Dense):      (Node A) -> (Node C)->(Node M)->(Node R)->(Node Z)
```

### Key Conceptual Distinction
- **HNSW vs. Cosine Similarity**: HNSW is an *index graph structure* that accelerates search; Cosine Similarity is the *mathematical distance function* calculated along graph nodes.

---

## 5. Lexical Search & Inverted Indexes

### Why Vector Search Alone is Insufficient
Dense vector search excels at conceptual matching but struggles with:
- Exact acronyms (e.g., `DPR`, `BM25`, `RRF`)
- Precise numbers, version tags, or product IDs (e.g., `2005.11401v4`, `RFC-7231`)
- Rare domain jargon and specific personal names

### PostgreSQL Full-Text Search (FTS)
PostgreSQL provides a native lexical search engine that parses natural language text into stemmed, normalized lexemes:
1. **Tokenization**: Splits raw text into words, stripping punctuation.
2. **Normalization & Stemming**: Reduces words to root stems (e.g., `"retrieving"`, `"retrieved"`, `"retrieval"` $\to$ `'retriev'`).
3. **Stop Word Removal**: Eliminates common non-discriminative words (`"the"`, `"is"`, `"at"`).
4. **`tsvector`**: Formats text into sorted, deduplicated lexemes with positional offsets.
5. **`tsquery`**: Represents the user search query with boolean operators (`&`, `|`, `!`).
6. **`ts_rank_cd`**: Scores chunks using cover-density ranking based on word proximity and frequency.

### Generalized Inverted Index (GIN)
A GIN index maps each individual lexeme directly to the list of document rows containing that lexeme. When a query is run, PostgreSQL intersects these posting lists in logarithmic time instead of scanning every text row.

```
LEXEME POSTING LIST (GIN Index)
'attent':  [ Row 1, Row 4, Row 12 ]
'matrix':  [ Row 4, Row 9 ]
'rag':     [ Row 1, Row 2, Row 3 ]
```

### Key Conceptual Distinction
- **GIN is an Index, not the Search Algorithm**: Full-Text Search is the linguistic parsing and ranking algorithm (`to_tsvector`, `tsquery`, `ts_rank_cd`); GIN is the inverted physical storage structure that makes FTS queries fast.

---

## 6. Hybrid Retrieval & Rank Fusion

### What is Hybrid Retrieval?
Hybrid retrieval runs two complementary search systems in parallel—Dense Vector Search and Sparse Lexical Search—and merges their outputs to achieve higher overall recall than either method alone.

### Why Score Normalization Fails
- Cosine similarities range strictly in $[-1, 1]$.
- BM25 / `ts_rank_cd` scores range in $[0, \infty)$ and vary drastically depending on document length and term frequency.
- Directly adding or multiplying these raw scores is fundamentally flawed because their statistical distributions, scales, and variances do not match.

### Reciprocal Rank Fusion (RRF)
RRF solves the score comparability problem by discarding raw scores entirely and working exclusively with **rank positions**.

$$\text{RRF Score}(d) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$

Where:
- $M$ is the set of retrieval systems (Vector and BM25).
- $r_m(d)$ is the 1-based rank position of chunk $d$ in system $m$.
- $k$ is a smoothing constant (standard default $k = 60$) that prevents top ranks from dominating disproportionately.

```
CHUNK EVALUATION EXAMPLE (k = 60):
Chunk A: Vector Rank 1, BM25 Rank 4  ──► Score = 1/(60+1) + 1/(60+4) = 0.01639 + 0.01562 = 0.03201
Chunk B: Vector Rank 20, BM25 Rank 1 ──► Score = 1/(60+20) + 1/(60+1) = 0.01250 + 0.01639 = 0.02889
Chunk C: Vector Rank 2, BM25 not in top 10 ──► Score = 1/(60+2) + 0 = 0.01613
```

### Interview Questions
- *Q: Why is RRF preferred over weighted linear combination of scores?*
  - **Answer**: Weighted score combinations require careful calibration, min-max scaling, or z-score normalization that breaks whenever the document corpus grows. RRF is scale-invariant, robust to outliers, and requires zero parameter tuning across diverse domains.

---

## 7. Neural Reranking

### Bi-Encoders vs. Cross-Encoders
- **Bi-Encoder (Vector Search)**: Query and document chunks are encoded into vectors *independently*. Fast ($\mathcal{O}(1)$ cosine distance against HNSW index), but query-document token interactions are compressed into a single vector.
- **Cross-Encoder (Reranker)**: Query and document chunk are fed *together* into a single transformer model with joint self-attention across all query and chunk tokens. Highly accurate, but computationally expensive ($\mathcal{O}(N^2)$).

```
BI-ENCODER (Retrieval Stage):
  Query  ──► [ Encoder ] ──► Vector Q \
                                        ──► Cosine Distance (Fast dot product)
  Chunk  ──► [ Encoder ] ──► Vector C /

CROSS-ENCODER (Reranking Stage):
  [ Query + [SEP] + Chunk ] ──► [ Full Cross-Attention Transformer ] ──► Relevance Score (0.0 to 1.0)
```

### The Retrieve-Then-Rerank Architecture
To balance speed and precision:
1. **Retrieve**: Use fast hybrid search to fetch top 10–20 broad candidates.
2. **Rerank**: Use `BAAI/bge-reranker-base` to rescore only those top candidates.
3. **Select**: Feed strictly the top 2–3 highest-scoring passages to the LLM generation prompt.

### Interview Questions
- *Q: Why not use a cross-encoder across all documents in the database?*
  - **Answer**: A database of 100,000 chunks would require 100,000 forward passes through a transformer for every single user query. At 50ms per forward pass, each query would take over an hour.

---

## 8. Context Assembly & LLM Generation

### Grounding & Prompt Engineering
The system prompt enforces strict behavioral guardrails on the LLM:
- **Zero Outside Knowledge**: Explicit instruction that answers must be derived *only* from the provided source passages.
- **Explicit Fallback**: Instructed to return a designated fallback string if the context is insufficient.
- **Citation Syntax Enforcement**: Demands that every claim include a bracketed citation matching its provided source number (e.g. `[SOURCE_1]`).

### Hallucination Prevention
Hallucinations occur when an LLM relies on stale parametric memory or interpolates between facts. By injecting explicit sources and enforcing sentence-level citation rules, the generation temperature and model creativity are constrained to verified context.

---

## 9. Citation Verification & Attribution Repair

### Why Generated Citations Cannot Be Blindly Trusted
LLMs are statistical pattern matchers. An LLM may generate a plausible citation (e.g., `[SOURCE_1]`) even when:
- The cited source does not contain the claimed fact.
- The citation index is out of bounds (e.g., citing `[SOURCE_5]` when only 2 sources were provided).
- The LLM cites the first sentence but forgets to cite subsequent sentences in the paragraph.

### Citation Validation Pipeline
1. **Source Range Verification**: Ensures all extracted citation tags reference valid source indices ($1 \le N \le \text{num\_sources}$).
2. **Sentence-Level Coverage**: Segments generated answers into sentences and checks whether each non-trivial sentence contains at least one citation.
3. **Syntactic Correctness**: Detects malformed tags (e.g. `[1]`, `(Source 1)`).

### Attribution Repair
When a generated answer is factually grounded but misses citations on subsequent sentences, the repair algorithm deterministically propagates the preceding valid citation to trailing uncited sentences, restoring verifiable traceability.

```
RAW OUTPUT:      "RAG combines memory. [SOURCE_1] The parametric memory is a seq2seq model."
REPAIR PIPELINE: [ Detected trailing sentence missing attribution ]
REPAIRED OUTPUT: "RAG combines memory. [SOURCE_1] The parametric memory is a seq2seq model. [SOURCE_1]"
```

---

## 10. Evaluation Framework & LLM-as-a-Judge

### The RAG Evaluation Triad
Evaluation must assess both the **retrieval stage** and the **generation stage** independently.

```
                 [ User Query ]
                  /          \
        Retrieval /            \ Relevance
                 v              v
        [ Retrieved Chunks ] ──► [ Generated Answer ]
                 \              /
                  \            /
                   Faithfulness
```

### 1. Retrieval Recall@K
Measures the percentage of relevant gold-standard chunks present in the top-$K$ retrieved candidates:
$$\text{Recall@K} = \frac{|\text{Retrieved Chunks in Top } K \cap \text{Gold Chunks}|}{|\text{Gold Chunks}|}$$

### 2. Faithfulness (Groundedness)
Evaluates whether every factual claim in the generated answer is strictly entailed by the context:
1. **Claim Decomposition**: Break answer into atomic propositions.
2. **Entailment Verification**: LLM judge checks whether Context $\models$ Claim for each proposition.
3. **Score Calculation**:
   $$\text{Faithfulness} = \frac{\text{Number of Entailed Claims}}{\text{Total Claims}}$$

### 3. Answer Relevance
Evaluates whether the generated response directly answers the user's specific question without wandering into irrelevant topics, scored on a continuous scale from $0.0$ to $1.0$.

### Key Conceptual Distinction
- **Faithfulness vs. Answer Relevance**: Faithfulness measures *factual grounding against the retrieved context* (no hallucinations); Answer Relevance measures *topical responsiveness to the user's question*. An answer can be 100% faithful to the context while being 0% relevant to what the user asked.

---

## 11. Observability & Distributed Tracing

### Why Observability Matters in RAG
RAG systems are multi-stage probabilistic pipelines. When a bad response occurs, observability identifies the exact point of failure:
- *Did the retriever fail to find the right chunk?*
- *Did the reranker push the right chunk down?*
- *Did the LLM fail to follow instructions despite having the right chunk?*
- *Did the citation validator reject the formatting?*

### Spans, Traces & OpenTelemetry
- **Trace**: The end-to-end lifecycle of a single user request.
- **Span**: A named, timed operation within the trace (e.g., `retrieval`, `reranking`, `generation`, `faithfulness-evaluation`).
- **Langfuse**: Specialized LLM observability platform that collects OpenTelemetry spans, token usage, prompts, outputs, and evaluation scores for real-time monitoring and regression analysis.

---

## 12. Backend Architecture & Application Design

### Clean Separation of Concerns
```
┌─────────────────────────────────────────────────────────┐
│ API / Transport Layer (NestJS Controllers, DTOs, CORS)  │
├─────────────────────────────────────────────────────────┤
│ Application Layer (ChatService, Dependency Injection)   │
├─────────────────────────────────────────────────────────┤
│ Domain / RAG Core (AskMyDocsAgent, Retrievers, Rerank)  │
│ * Framework-Independent Pure TypeScript Classes *       │
├─────────────────────────────────────────────────────────┤
│ Persistence Layer (PostgreSQL, pgvector, HNSW/GIN)      │
└─────────────────────────────────────────────────────────┘
```

### Framework-Independent RAG Core
The core domain logic (`AskMyDocsAgent`, `VectorRetriever`, `BGEReranker`, etc.) is written as framework-independent TypeScript classes with no NestJS decorators. NestJS manages dependency injection, singleton lifetimes, and HTTP routing via provider factory modules (`rag.providers.ts`). This allows the same RAG core to be executed directly in CLI evaluation scripts, unit tests, and background jobs.

---

## 13. Frontend Architecture & Client Separation

### Architecture: React 19 + Vite SPA
- **Stateless SPA**: Built as a fast client-side Single Page Application served by NGINX.
- **Why Not Next.js / Server Actions?**: The backend is already a dedicated NestJS API. Introducing Next.js would duplicate server infrastructure, create unnecessary SSR overhead, and blur architectural boundaries.
- **Live Evaluation Inspector**: Exposes real-time faithfulness claim breakdowns, relevance explanations, and source chunk details to give users transparency into generation grounding.

---

## 14. Infrastructure, Docker & Model Runtimes

### Container Architecture
- **`postgres`**: `pgvector/pgvector:pg16` with persistent volume `ask_my_docs_pgdata`.
- **`backend`**: Multi-stage `node:22-bookworm-slim` container compiling TypeScript and running pruned production bundles.
- **`frontend`**: Multi-stage build compiling Vite assets and serving via lightweight `nginx:alpine`.

### Host Gateway for Ollama
Ollama models (`llama3.2`, `nomic-embed-text`) are large multi-gigabyte files. Bundling them into Docker images creates massive, bloated containers that are slow to build and push. Instead, Ollama runs on the host machine, and the containerized backend connects via `http://host.docker.internal:11434` using Docker's `host-gateway` bridge.

---

## 15. Continuous Integration & Automated Quality Gates

### Two-Tier CI Strategy
1. **Tier 1 — Fast Deterministic CI (`ci.yml`)**:
   - Executes typechecking (`tsc --noEmit`), linting (`eslint`), unit tests (`node:test`), and frontend builds.
   - Runs in $< 60$ seconds on all PRs and pushes.
2. **Tier 2 — Comprehensive RAG Evaluation (`rag-evaluation.yml`)**:
   - Boots PostgreSQL with `pgvector`, downloads Ollama models, ingests papers, and executes the canonical 15-question evaluation suite.
   - Generates machine-readable `evaluation-summary.json` artifacts and enforces quality thresholds before merges.

---

## 16. Summary of Core Engineering Tradeoffs

| Decision | Chosen Approach | Alternative Considered | Tradeoff Rationale |
| :--- | :--- | :--- | :--- |
| **Vector Storage** | `pgvector` in PostgreSQL | Pinecone / Qdrant | Eliminates multi-database sync and operational overhead; unified ACID transactions with relational metadata. |
| **Search Strategy** | Hybrid (Vector + FTS) | Pure Vector Search | Vector search misses exact acronyms and IDs; hybrid retrieval ensures high recall across conceptual and keyword queries. |
| **Rank Merging** | Reciprocal Rank Fusion | Weighted Score Sum | Scores have incomparable scales; RRF provides stable, parameter-free rank blending. |
| **Passage Precision** | Retrieve-Then-Rerank | Single-stage Vector | Cross-encoders are too slow for full-database scanning; two-stage retrieval achieves both millisecond speed and high precision. |
| **Model Hosting** | Local Host Ollama | Bundled Container Weights | Keeps application Docker images under 300MB; shares model weights across local tools. |
| **RAG Core Design** | Framework-Agnostic Core | NestJS-coupled classes | Enables running evaluation runners, CLI tools, and unit tests without booting HTTP application servers. |
| **CI Architecture** | Two-Tier (Fast CI + Model Eval) | Running full eval on every push | LLM evaluations take minutes; separating deterministic tests keeps developer feedback loops instant. |

---

*This handbook is designed for conceptual review, architectural reference, and technical interview preparation for Ask My Docs.*
