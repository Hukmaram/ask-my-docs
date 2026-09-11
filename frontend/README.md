# Ask My Docs — Frontend Client 💻

> Modern, citation-grounded React 19 Single Page Application (SPA) bundled with Vite and styled with custom vanilla CSS design tokens.

---

## Features

- **Query Interface**: Interactive chat prompt with real-time submission handling and loading state feedback.
- **Citation-Grounded Answers**: Renders generated text with interactive, highlighted citation tags (e.g. `[SOURCE_1]`).
- **Live Evaluation Inspector**: Displays real-time LLM-as-a-judge scores for Faithfulness, Claim Breakdown, and Answer Relevance.
- **Source Explorer**: Inspects retrieved chunks, document metadata, page numbers, and similarity ranks.
- **Dark Mode UI**: Curated aesthetic with glassmorphism effects, smooth micro-animations, and responsive layout.

---

## Tech Stack

- **React 19**
- **TypeScript 5.9**
- **Vite 8**
- **NGINX** (Production container web server)

---

## Local Development

```bash
# Install dependencies
npm install

# Start development server (HMR enabled)
npm run dev
```

Application runs by default on [http://localhost:5173](http://localhost:5173).

---

## Production Build

```bash
npm run build
```
Compiled assets are emitted to the `dist/` directory and served via NGINX in containerized environments.
