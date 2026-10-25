"""
Synergy AI - Multi-Agent Backend API Server
Built with FastAPI to serve the Next.js Dashboard.
Integrates 4-Agent Pipeline, Real-Time Credit Management, Persistent History, and Workspace Humanizer.
"""

import os
import json
import asyncio
import threading
import queue
from fastapi import FastAPI, HTTPException, Query, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional, Union
from crew import SynergyCrew
from humanizer_service import HumanizerService
import db

app = FastAPI(
    title="Synergy AI Multi-Agent Backend",
    description="Python CrewAI multi-agent content generation engine with credit tracking, history, and workspace humanizer.",
    version="2.0.0"
)

# Initialize SQLite database schema on startup
db.init_db()

# Allow CORS for Next.js frontend running locally
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

crew_instance = SynergyCrew()
humanizer_instance = HumanizerService()


# ─── Pydantic Request & Response Schemas ─────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="Topic prompt entered from the frontend dashboard")
    format: str = Field("Detailed Report", description="Requested format: Detailed Report or Multi-paragraph Essay")
    user_id: Optional[str] = Field("guest-user", description="Authenticated user ID or email")


class StepLog(BaseModel):
    agent: str
    role: str
    action: str
    status: str
    details: str


class GenerateResponse(BaseModel):
    id: Optional[int] = None
    topic: str
    final_text: str
    formatted_html: str
    word_count: int
    read_time: str
    plagiarism_report: Dict[str, Any]
    humanizer_report: Dict[str, Any]
    grammar_report: Dict[str, Any]
    fact_check_report: Optional[Dict[str, Any]] = None
    steps: List[StepLog]
    execution_time_seconds: float
    status: str
    credits_remaining: Optional[int] = None
    credits_used_today: Optional[int] = None
    daily_limit: Optional[int] = None


class HumanizeRequest(BaseModel):
    text: str = Field(..., description="Content to rephrase or humanize")
    mode: Optional[str] = Field("Medium", description="Output type/mode: Easy (1 credit), Medium (2 credits), or Maximum (3 credits)")
    intensity: Optional[str] = Field(None, description="Alternative mode alias (Easy, Medium, Maximum)")
    tone: Optional[str] = Field(None, description="Legacy tone parameter if provided")
    user_id: Optional[str] = Field("guest-user", description="Authenticated user ID or email")


class ConsumeCreditsRequest(BaseModel):
    amount: int = Field(1, description="Amount of credits to consume")
    action: Optional[str] = Field("action", description="Description of action")
    user_id: Optional[str] = Field("guest-user", description="User ID")


# ─── System Endpoints ─────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "Synergy AI Multi-Agent API",
        "status": "Online",
        "version": "2.0.0",
        "agents": [
            "Manager Agent",
            "Research Agent",
            "Content Agent (with Grammar + Humanizer)",
            "Reviewer Agent (with Plagiarism Check)"
        ],
        "features": [
            "4-Agent CrewAI Content Pipeline",
            "Real-Time Daily Credit Tracking & Auto-Reset",
            "Persistent Generation & Chat History",
            "Workspace Humanizer with Easy (1 credit), Medium (2 credits), and Maximum (3 credits) modes"
        ]
    }


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Synergy AI"}


@app.get("/api/agents")
def list_agents():
    return {
        "agents": [
            {
                "name": "Manager Agent",
                "role": "Project Coordinator",
                "description": "Receives topic prompt, orchestrates execution roadmap, and coordinates the pipeline."
            },
            {
                "name": "Research Agent",
                "role": "Senior Domain Researcher",
                "description": "Performs live web search (Wikipedia + DuckDuckGo) to discover authentic facts, dates, and background on any topic."
            },
            {
                "name": "Content Agent",
                "role": "Lead Writer & Humanizer Specialist",
                "description": "Drafts structured content grounded strictly in verified web facts, runs automated grammar validation, and applies humanizer rewriting."
            },
            {
                "name": "Reviewer Agent",
                "role": "Chief Editorial Reviewer & Originality Inspector",
                "description": "Performs live web fact-checking, strict plagiarism verification, and anti-AI style enforcement to ensure 100% originality and grounded accuracy."
            }
        ]
    }


# ─── Credit Tracking Endpoints ───────────────────────────────────────────────

@app.get("/api/credits")
def get_credits(
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    uid = user_id or x_user_id or "guest-user"
    credits_info = db.get_user_credits(uid)
    remaining = credits_info.get("remaining_credits", 0)
    warning = None
    if remaining < 10:
        warning = "Low credit warning: Your remaining credits are below 10. Consider replenishing to avoid interruptions."
    response = {
        **credits_info,
        "credits": remaining,
    }
    if warning:
        response["warning"] = warning
    return response


@app.post("/api/credits/consume")
def consume_credits(
    payload: ConsumeCreditsRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    uid = payload.user_id or x_user_id or "guest-user"
    res = db.consume_user_credits(uid, payload.amount)
    if not res.get("success"):
        raise HTTPException(status_code=402, detail=res.get("error", "Insufficient credits"))
    return res


# ─── Generation & Chat History Endpoints ─────────────────────────────────────

@app.get("/api/history")
def list_history(
    user_id: Optional[str] = Query(None),
    search: Optional[str] = Query(""),
    limit: int = Query(50, ge=1, le=100),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    uid = user_id or x_user_id or "guest-user"
    items = db.get_generation_history(uid, limit=limit, search=search or "")
    return {"history": items, "count": len(items), "user_id": uid}


@app.get("/api/history/{history_id}")
def get_history_item(
    history_id: int,
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    uid = user_id or x_user_id or "guest-user"
    item = db.get_generation_by_id(history_id, uid)
    if not item:
        raise HTTPException(status_code=404, detail="Generation history record not found.")
    return item


@app.delete("/api/history/{history_id}")
def delete_history_item(
    history_id: int,
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    uid = user_id or x_user_id or "guest-user"
    deleted = db.delete_generation_history(history_id, uid)
    if not deleted:
        raise HTTPException(status_code=404, detail="History record not found or already deleted.")
    return {"success": True, "message": f"History item {history_id} deleted."}


# ─── Workspace Humanizer Endpoints ───────────────────────────────────────────

@app.post("/api/humanize")
def humanize_text(
    payload: HumanizeRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_workspace_api_key: Optional[str] = Header(None, alias="X-Workspace-Api-Key"),
    x_groq_api_key: Optional[str] = Header(None, alias="X-Groq-Api-Key")
):
    uid = payload.user_id or x_user_id or "guest-user"

    # Determine requested mode: Easy, Medium, or Maximum
    requested_mode = payload.mode or payload.intensity or payload.tone or "Medium"
    normalized_mode = "Medium"
    m_lower = requested_mode.strip().lower()
    if "easy" in m_lower or "light" in m_lower or "standard" in m_lower:
        normalized_mode = "Easy"
    elif "max" in m_lower or "bypass" in m_lower or "high" in m_lower:
        normalized_mode = "Maximum"
    else:
        normalized_mode = "Medium"

    # Credit deduction: Easy = 1 credit, Medium = 2 credits, Maximum = 3 credits
    credit_amount = HumanizerService.CREDIT_COSTS.get(normalized_mode, 1)

    credit_res = db.consume_user_credits(uid, amount=credit_amount)
    if not credit_res.get("success"):
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient daily credits ({credit_amount} credits required for {normalized_mode} mode). Your daily allowance resets at midnight UTC."
        )

    # Resolve custom key if passed
    effective_custom_key = x_groq_api_key or x_workspace_api_key

    try:
        result = humanizer_instance.humanize(
            text=payload.text,
            mode=normalized_mode,
            custom_key=effective_custom_key
        )

        # Save draft
        draft_id = db.save_humanizer_draft(
            user_id=uid,
            original_text=payload.text,
            humanized_text=result["humanized_text"],
            tone=normalized_mode,
            burstiness=result["burstiness_index"],
            ai_prob=result["ai_probability_score"],
            credits_used=credit_amount
        )
        result["draft_id"] = draft_id
        result["credits_remaining"] = credit_res["remaining_credits"]
        result["credits_used_today"] = credit_res.get("used_credits", 0)
        result["daily_limit"] = credit_res.get("daily_limit", 50)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Humanizer error: {str(e)}")


@app.post("/api/analyze-text")
def analyze_text(payload: Dict[str, str]):
    text = payload.get("text", "")
    return humanizer_instance.analyze_text(text)


# ─── Multi-Agent Generation Pipeline ─────────────────────────────────────────

def _build_enhanced_prompt(prompt: str, format_type: str) -> str:
    from tools.custom_tools import extract_clean_topic
    clean_topic = extract_clean_topic(prompt)
    return (
        f"Topic: {clean_topic}\n"
        f"User Prompt: {prompt}\n"
        f"CRITICAL INSTRUCTIONS:\n"
        f"1. Format: {format_type} — produce a complete, richly detailed, web-grounded piece between 500 and 700 words across 5 to 6 distinct paragraphs.\n"
        f"2. Write ONLY in flowing paragraph prose. Absolutely NO bullet points, dashes, or numbered lists anywhere.\n"
        f"3. STRICT FACTUAL ACCURACY: Ground every claim in authentic real-world knowledge and web research. Never invent fictional corporate frameworks or fake systems models for people, fictional characters, or cultural works.\n"
        f"4. BANNED AI BUZZWORDS (DO NOT USE): testament, paradigm, calibration, unvarnished, imperative, tapestry, pivotal, deliberate, fosters, resilience, nuanced, underscore, beacon, intertwined, delve, furthermore, moreover.\n"
        f"5. HIGH BURSTINESS: Mix short punchy sentences (3-6 words) with medium and long sentences. Every single paragraph must include at least one very short sentence.\n"
        f"6. NATURAL CONVERSATIONAL TONE: Use contractions everywhere (it's, don't, can't, wouldn't, you'll). Write in active voice like a knowledgeable expert sharing a deep dive over coffee.\n"
        f"7. NO academic introductory filler. Start directly with the main point. NO preachy concluding summaries. End naturally.\n"
        f"8. STRICT CONSTRAINT: Must be 500 to 700 words across 5 to 6 full paragraphs. No brief summaries."
    )


@app.post("/api/generate", response_model=GenerateResponse)
def generate_content(
    payload: GenerateRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    uid = payload.user_id or x_user_id or "guest-user"
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Topic prompt cannot be empty.")

    # Deduct 2 credits for full 4-agent run
    credit_res = db.consume_user_credits(uid, amount=2)
    if not credit_res.get("success"):
        raise HTTPException(
            status_code=402,
            detail="Insufficient daily credits for 4-Agent Generation (2 credits required). Your credits reset daily at midnight UTC."
        )

    format_type = payload.format.strip() if payload.format else "Detailed Report"
    enhanced_prompt = _build_enhanced_prompt(prompt, format_type)

    try:
        result = crew_instance.run_pipeline(enhanced_prompt, format_type=format_type)
        # Save to generation history
        history_id = db.save_generation_history(
            user_id=uid,
            prompt=prompt,
            format_type=format_type,
            final_text=result["final_text"],
            formatted_html=result.get("formatted_html"),
            word_count=result.get("word_count", 0),
            read_time=result.get("read_time", "1 min read"),
            plagiarism_originality=result.get("plagiarism_report", {}).get("originality_score", "100% Original"),
            ai_score=result.get("humanizer_report", {}).get("ai_probability_score", "98% Organic"),
            execution_time_seconds=result.get("execution_time_seconds", 0.0),
            steps=result.get("steps", [])
        )
        result["id"] = history_id
        result["credits_remaining"] = credit_res["remaining_credits"]
        result["credits_used_today"] = credit_res.get("used_credits", 0)
        result["daily_limit"] = credit_res.get("daily_limit", 50)
        return result
    except ValueError as ve:
        # The crew pipeline may raise a ValueError when LLM quota is exhausted.
        # We surface this as a 402 error with a clear suggestion to the user.
        if "quota exhausted" in str(ve).lower():
            # Provide guidance for a new API key/account.
            suggestion = (
                "⚠️ Gemini API key quota exhausted. "
                "Please obtain a new Google AI Studio account or generate a fresh API key. "
                "Updating the GEMINI_API_KEY in backend/.env will resolve the issue. "
                "Note: The multi‑agent pipeline uses only the Gemini key; no Groq fallback is performed."
            )
            raise HTTPException(status_code=402, detail=suggestion)
        # For any other ValueError, return a generic 500 error.
        raise HTTPException(status_code=500, detail=f"Multi-agent pipeline error: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multi-agent pipeline error: {str(e)}")


@app.post("/api/generate-stream")
async def generate_content_stream(
    payload: GenerateRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    """
    SSE streaming endpoint. Sends real-time progress events as the pipeline runs,
    saves history, updates credits, and delivers the final result as the last event.
    """
    uid = payload.user_id or x_user_id or "guest-user"
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Topic prompt cannot be empty.")

    # Deduct 2 credits for 4-agent run
    credit_res = db.consume_user_credits(uid, amount=2)
    if not credit_res.get("success"):
        raise HTTPException(
            status_code=402,
            detail="Insufficient daily credits for 4-Agent Generation (2 credits required). Your credits reset daily at midnight UTC."
        )

    format_type = payload.format.strip() if payload.format else "Detailed Report"
    enhanced_prompt = _build_enhanced_prompt(prompt, format_type)

    # Queue for thread-safe communication between pipeline thread and SSE generator
    event_queue: queue.Queue = queue.Queue()

    def progress_callback(step: int, message: str):
        event_queue.put({"type": "progress", "step": step, "message": message})

    def run_pipeline_thread():
        try:
            result = crew_instance.run_pipeline(
                enhanced_prompt,
                format_type=format_type,
                progress_callback=progress_callback
            )
        except ValueError as ve:
            if "quota exhausted" in str(ve).lower():
                event_queue.put({"type": "error", "message": str(ve)})
                return
            event_queue.put({"type": "error", "message": f"Multi-agent pipeline error: {str(ve)}"})
            return
        except Exception as e:
            event_queue.put({"type": "error", "message": f"Multi-agent pipeline error: {str(e)}"})
            return

        # Persist to database history
        history_id = db.save_generation_history(
            user_id=uid,
            prompt=prompt,
            format_type=format_type,
            final_text=result["final_text"],
            formatted_html=result.get("formatted_html"),
            word_count=result.get("word_count", 0),
            read_time=result.get("read_time", "1 min read"),
            plagiarism_originality=result.get("plagiarism_report", {}).get("originality_score", "100% Original"),
            ai_score=result.get("humanizer_report", {}).get("ai_probability_score", "98% Organic"),
            execution_time_seconds=result.get("execution_time_seconds", 0.0),
            steps=result.get("steps", [])
        )
        result["id"] = history_id
        result["credits_remaining"] = credit_res["remaining_credits"]
        result["credits_used_today"] = credit_res.get("used_credits", 0)
        result["daily_limit"] = credit_res.get("daily_limit", 50)

        event_queue.put({"type": "result", "data": result})

    # Run the pipeline in a background thread
    thread = threading.Thread(target=run_pipeline_thread, daemon=True)
    thread.start()

    async def event_generator():
        while True:
            try:
                try:
                    event = event_queue.get_nowait()
                except queue.Empty:
                    await asyncio.sleep(0.1)
                    continue

                yield f"data: {json.dumps(event)}\n\n"

                if event["type"] in ("result", "error"):
                    break
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


def find_available_port(host: str, preferred_port: int, max_attempts: int = 20) -> int:
    import socket
    for p in range(preferred_port, preferred_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((host, p))
                return p
        except OSError:
            continue
    return preferred_port


if __name__ == "__main__":
    import uvicorn
    from dotenv import load_dotenv
    load_dotenv()

    host = os.getenv("HOST", "127.0.0.1")
    requested_port = int(os.getenv("PORT", 8001))
    port = find_available_port(host, requested_port)

    if port != requested_port:
        print(f"\n[WARNING] Port {requested_port} is busy or restricted by permissions (WinError 10013).")
        print(f"[INFO] Automatically falling back to available port: {port}\n")
    else:
        print(f"\n[INFO] Starting Synergy AI Backend on http://{host}:{port}\n")

    uvicorn.run(app, host=host, port=port)

