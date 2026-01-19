# KIFF AI Frontend

Vue 3 + TypeScript Frontend for the KIFF LangChain Agent.

## Features

- 💬 Chat interface with LLM
- 📁 Document management
- 🔍 RAG (Retrieval-Augmented Generation) configuration
- ⚙️ Settings and profile management

## Tech Stack

- Vue 3 with Composition API
- TypeScript
- Vite
- Vue Router
- Pinia (State Management)
- Axios (API Client)

## Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## API Integration

The frontend communicates with the FastAPI backend via proxy configuration in `vite.config.ts`:
- All `/api/*` requests are proxied to `http://localhost:8000`
- Backend must be running on port 8000

## Project Structure

```
src/
├── api/          # API client and types
├── components/   # Reusable Vue components
├── router/       # Vue Router configuration
├── stores/       # Pinia stores
├── views/        # Page components
└── main.ts       # App entry point
```

## Usage as Git Submodule

This repository is designed to be used as a Git submodule in the main `langchain` project:

```bash
# In the main project:
git submodule add https://github.com/YOUR_USERNAME/kiff-ai-frontend.git frontend
git submodule update --init --recursive
```
