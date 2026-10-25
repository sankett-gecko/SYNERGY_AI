# Synergy AI - Multi-Agent Content Generation Platform

A full-stack, enterprise-grade AI content generation platform featuring a modern **Next.js 16** frontend designed with pixel-precision from **Stitch** project `8223845716268468269`, powered by a **Python CrewAI 4-Agent** backend system.

---

## Architecture Overview

```
                          SYNERGY AI WORKSPACE
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          │                                                   │
   Frontend (Next.js)                                  Backend (Python FastAPI)
   - App Router (TS + Tailwind)                        - CrewAI Multi-Agent System
   - Stitch Screens (Login & Dashboard)                - 4 Specialized Agents
   - Material Symbols Outlined                         - Plagiarism & Humanizer Tools
   - Dynamic Pipeline Stepper                          - REST API (/api/generate)
```

### The 4 Specialized Agents

1. **👔 Manager Agent (`manager_agent.py`)**:
   - Receives topic prompts directly from the frontend dashboard.
   - Coordinates the execution pipeline and delegates subtasks to the team.

2. **🔍 Research Agent (`research_agent.py`)**:
   - Conducts thorough domain research on the topic.
   - Analyzes factual benchmarks, industry trends, and key insights.

3. **✍️ Content Agent (`content_agent.py`)**:
   - **Step 1: Drafting** - Produces structured, highly compelling editorial content.
   - **Step 2: Automated Grammar Check** - Refines syntax, punctuation, and readability.
   - **Step 3: Humanizer Rewriter** - Varies sentence lengths (burstiness), eliminates robotic AI cliches, and reduces AI detection markers.

4. **🛡️ Reviewer Agent (`reviewer_agent.py`)**:
   - **Strict Plagiarism Check** - Computes n-gram uniqueness and verifies original phrasing.
   - **Final Approval Gate** - Signs off on originality before releasing the final payload to the dashboard.

---

## Quick Start Guide

### 1. Start the Python Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```
*Backend API server runs at `http://localhost:8001` (API documentation at `http://localhost:8001/docs`).*
*(Note: If port 8000 is occupied by Windows services like Manager.exe, it automatically binds to port 8001).*

### 2. Start the Next.js Frontend

```bash
cd frontend
npm install
npm run dev
```
*Frontend web application runs at `http://localhost:3000`.*

---

## Features & Screens

- **Login Page (`/login` or `/`)**:
  - Recreates the Stitch Login design with responsive form inputs, password visibility toggle, animated loading feedback, and smooth navigation.
- **Dashboard Page (`/dashboard`)**:
  - Fixed top navigation with brand logo, active route highlighting, and user avatar.
  - Interactive prompt textarea with one-click suggestion presets (`Async vs Burnout`, `SEO Writing Guide`, `Landing Page Copy`).
  - Real-time **CrewAI 4-Agent Pipeline** execution status indicator.
  - Large **Final Output** card with formatted headings, cards, key takeaway, word count, estimated reading time, and one-click copy button.
