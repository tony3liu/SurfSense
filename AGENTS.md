# AGENTS.md - SurfSense Development Guidelines

This file provides guidelines for AI agents operating in the SurfSense repository.

## Project Overview

SurfSense is a multi-component project with:
- **surfsense_web/** - Next.js web application (TypeScript, React 19)
- **surfsense_browser_extension/** - Browser extension (Plasmo, React 18)
- **surfsense_backend/** - Python FastAPI backend

## Build/Lint/Test Commands

### surfsense_web (Frontend)

```bash
cd surfsense_web && pnpm install
pnpm dev              # Dev server with Turbopack
pnpm build            # Production build
pnpm lint             # ESLint
pnpm format           # Biome check
pnpm format:fix       # Biome autofix
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes
```

### surfsense_browser_extension

```bash
cd surfsense_browser_extension && pnpm install
pnpm dev              # Plasmo dev server
pnpm build            # Build extension
pnpm package          # Package for distribution
```

### surfsense_backend (Python)

```bash
uv pip install -e ".[dev]"      # Install with dev deps
ruff check .                    # Lint
ruff format .                   # Format
pre-commit run --all-files      # Run pre-commit hooks
cd surfsense_backend && python -m uvicorn app.app:app --reload  # Start server
```

## Code Style Guidelines

### TypeScript (surfsense_web, surfsense_browser_extension)

**Formatting (Biome)**
- Indent: tabs (width 2), Line width: 100
- Quote style: double quotes, Semicolons: always
- Trailing commas: ES5 style

**Naming**
- Variables/functions: camelCase
- Constants: SCREAMING_SNAKE_CASE or camelCase
- Components: PascalCase

**Type Annotations**
- Explicit types for parameters and return values
- Use `type` over `interface` for unions
- Use `| null` instead of nullable types
- Avoid `any` - use `unknown` or explicit types

**Imports**
```typescript
import type { Message } from "@ai-sdk/react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
```
Organize: external → internal → relative, use type imports.

**React/Next.js**
- Server Components by default, Client Components with `use client`
- Next.js App Router conventions
- State: Jotai (global), TanStack Query (server), Zustand (client)

### Python (surfsense_backend)

**Formatting (Ruff)**
- Line length: 88, Indent: 4 spaces, Quotes: double

**Naming**
- Variables/functions: snake_case
- Classes: PascalCase
- Private methods: `_private_method`

**Imports**
```python
import logging

import litellm
from langchain_core.messages import HumanMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.db import SearchSpace
```
Organize: stdlib → third-party → local app.

**Type Hints**
- Python 3.12+ syntax with `|` (not Optional/Union)
- Return types required for public functions

**Error Handling**
```python
try:
    result = await session.execute(select(Model).where(Model.id == id))
    return result.scalars().first()
except Exception as e:
    logger.error(f"Failed to get model {id}: {e!s}")
    return None
```

**Async/Await**
- Use async for I/O, `AsyncSession` with SQLAlchemy

## Database Management

- **Frontend**: Drizzle ORM (`app/db/schema.ts`), `pnpm db:generate` → `pnpm db:migrate`
- **Backend**: SQLAlchemy + Alembic, `alembic revision -m "desc"` → `alembic upgrade head`

## Git Workflow

**Branch naming**: `feature/...`, `fix/...`, `docs/...`
**Commit messages**: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`
**PRs**: One feature/fix per PR, link issues, ensure CI passes

## Security

- Never commit secrets/API keys
- Use `.env.example` template, `.env` is gitignored
- Validate user inputs, sanitize HTML/Markdown

## Package Manager

Always use `pnpm` for TypeScript projects.

## Additional Notes

- **Cursor Rules**: `.cursorrules` in surfsense_web specifies `pnpm`
- **Tests**: No formal test suite - add tests for new features
- **Documentation**: Update `CONTRIBUTING.md` for process changes
