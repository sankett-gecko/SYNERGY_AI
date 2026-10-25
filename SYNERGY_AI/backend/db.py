"""
Synergy AI - SQLite Database Manager
Handles user credit tracking with daily resets and persistent generation history.
"""

import sqlite3
import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "synergy.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes the database schema if tables do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # User Credits Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_credits (
        user_id TEXT PRIMARY KEY,
        daily_limit INTEGER NOT NULL DEFAULT 50,
        used_credits INTEGER NOT NULL DEFAULT 0,
        last_reset_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    # Generation History Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS generation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        format_type TEXT NOT NULL DEFAULT 'Detailed Report',
        final_text TEXT NOT NULL,
        formatted_html TEXT,
        word_count INTEGER DEFAULT 0,
        read_time TEXT DEFAULT '1 min read',
        plagiarism_originality TEXT DEFAULT '100% Original',
        ai_score TEXT DEFAULT '98% Organic',
        execution_time_seconds REAL DEFAULT 0.0,
        steps_json TEXT,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'SUCCESS'
    );
    """)

    # Workspace Humanizer History / Drafts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS humanizer_drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        original_text TEXT NOT NULL,
        humanized_text TEXT NOT NULL,
        tone TEXT NOT NULL DEFAULT 'Medium',
        burstiness_index REAL DEFAULT 0.0,
        ai_probability_score TEXT DEFAULT '5% AI',
        credits_used INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_user ON generation_history(user_id, created_at DESC);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_drafts_user ON humanizer_drafts(user_id, created_at DESC);")

    conn.commit()
    conn.close()


def _get_current_date_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _get_current_iso_str() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_user_credits(user_id: str, default_limit: int = 50) -> Dict[str, Any]:
    """
    Fetches credit record for a user. If new day has arrived, automatically resets daily credits.
    """
    clean_user = user_id.strip() if user_id and user_id.strip() else "anonymous-guest"
    today_str = _get_current_date_str()
    now_str = _get_current_iso_str()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM user_credits WHERE user_id = ?", (clean_user,))
    row = cursor.fetchone()

    if not row:
        # Create new user record
        cursor.execute(
            """
            INSERT INTO user_credits (user_id, daily_limit, used_credits, last_reset_date, created_at, updated_at)
            VALUES (?, ?, 0, ?, ?, ?)
            """,
            (clean_user, default_limit, today_str, now_str, now_str)
        )
        conn.commit()
        conn.close()
        return {
            "user_id": clean_user,
            "daily_limit": default_limit,
            "used_credits": 0,
            "remaining_credits": default_limit,
            "last_reset_date": today_str,
            "reset_interval": "Daily (Midnight UTC)"
        }

    # User exists - check if reset needed
    daily_limit = row["daily_limit"]
    used_credits = row["used_credits"]
    last_reset = row["last_reset_date"]

    if last_reset != today_str:
        # Reset for new day
        used_credits = 0
        cursor.execute(
            """
            UPDATE user_credits 
            SET used_credits = 0, last_reset_date = ?, updated_at = ?
            WHERE user_id = ?
            """,
            (today_str, now_str, clean_user)
        )
        conn.commit()

    conn.close()
    remaining = max(0, daily_limit - used_credits)

    return {
        "user_id": clean_user,
        "daily_limit": daily_limit,
        "used_credits": used_credits,
        "remaining_credits": remaining,
        "last_reset_date": today_str,
        "reset_interval": "Daily (Midnight UTC)"
    }


def consume_user_credits(user_id: str, amount: int = 1) -> Dict[str, Any]:
    """
    Consumes credits for a user. Returns updated credit info or raises error if insufficient.
    """
    clean_user = user_id.strip() if user_id and user_id.strip() else "anonymous-guest"
    credits_info = get_user_credits(clean_user)

    if credits_info["remaining_credits"] < amount:
        return {
            "success": False,
            "error": f"Insufficient credits remaining for today (requires {amount} credits, {credits_info['remaining_credits']} left). Your daily allowance will reset at midnight UTC.",
            **credits_info
        }

    new_used = credits_info["used_credits"] + amount
    now_str = _get_current_iso_str()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE user_credits 
        SET used_credits = ?, updated_at = ?
        WHERE user_id = ?
        """,
        (new_used, now_str, clean_user)
    )
    conn.commit()
    conn.close()

    credits_info["used_credits"] = new_used
    credits_info["remaining_credits"] = max(0, credits_info["daily_limit"] - new_used)
    credits_info["success"] = True
    return credits_info


def save_generation_history(
    user_id: str,
    prompt: str,
    format_type: str,
    final_text: str,
    formatted_html: Optional[str] = None,
    word_count: int = 0,
    read_time: str = "1 min read",
    plagiarism_originality: str = "100% Original",
    ai_score: str = "98% Organic",
    execution_time_seconds: float = 0.0,
    steps: Optional[List[Dict[str, Any]]] = None
) -> int:
    """Saves a multi-agent generation result to SQLite history."""
    clean_user = user_id.strip() if user_id and user_id.strip() else "anonymous-guest"
    now_str = _get_current_iso_str()
    steps_json = json.dumps(steps or [])

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO generation_history (
            user_id, prompt, format_type, final_text, formatted_html, 
            word_count, read_time, plagiarism_originality, ai_score, 
            execution_time_seconds, steps_json, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            clean_user, prompt, format_type, final_text, formatted_html or "",
            word_count, read_time, plagiarism_originality, ai_score,
            execution_time_seconds, steps_json, now_str, "SUCCESS"
        )
    )
    history_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return history_id


def get_generation_history(user_id: str, limit: int = 50, search: str = "") -> List[Dict[str, Any]]:
    """Retrieves combined generation and workspace humanizer history (Easy, Medium, Hard) for a user."""
    clean_user = user_id.strip() if user_id and user_id.strip() else "anonymous-guest"
    conn = get_db_connection()
    cursor = conn.cursor()

    gen_items = []
    draft_items = []

    if search and search.strip():
        search_pattern = f"%{search.strip()}%"
        cursor.execute(
            """
            SELECT id, user_id, prompt, format_type, final_text, formatted_html,
                   word_count, read_time, plagiarism_originality, ai_score,
                   execution_time_seconds, created_at, status
            FROM generation_history
            WHERE user_id = ? AND (prompt LIKE ? OR final_text LIKE ?)
            ORDER BY id DESC
            LIMIT ?
            """,
            (clean_user, search_pattern, search_pattern, limit)
        )
        gen_items = [dict(row) for row in cursor.fetchall()]

        cursor.execute(
            """
            SELECT id, user_id, original_text, humanized_text, tone,
                   burstiness_index, ai_probability_score, credits_used, created_at
            FROM humanizer_drafts
            WHERE user_id = ? AND (original_text LIKE ? OR humanized_text LIKE ? OR tone LIKE ?)
            ORDER BY id DESC
            LIMIT ?
            """,
            (clean_user, search_pattern, search_pattern, search_pattern, limit)
        )
        draft_rows = cursor.fetchall()
    else:
        cursor.execute(
            """
            SELECT id, user_id, prompt, format_type, final_text, formatted_html,
                   word_count, read_time, plagiarism_originality, ai_score,
                   execution_time_seconds, created_at, status
            FROM generation_history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (clean_user, limit)
        )
        gen_items = [dict(row) for row in cursor.fetchall()]

        cursor.execute(
            """
            SELECT id, user_id, original_text, humanized_text, tone,
                   burstiness_index, ai_probability_score, credits_used, created_at
            FROM humanizer_drafts
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (clean_user, limit)
        )
        draft_rows = cursor.fetchall()

    conn.close()

    for d in draft_rows:
        words = len(d["humanized_text"].split())
        preview_prompt = d["original_text"].strip().replace("\n", " ")
        if len(preview_prompt) > 65:
            preview_prompt = preview_prompt[:65] + "..."
        tone_label = d["tone"]
        if tone_label == "Maximum":
            tone_label = "Hard"
        draft_items.append({
            "id": 1000000 + d["id"],
            "user_id": clean_user,
            "prompt": f"Humanizer: {preview_prompt}",
            "format_type": f"Humanizer ({tone_label})",
            "final_text": d["humanized_text"],
            "formatted_html": "",
            "word_count": words,
            "read_time": f"{max(1, words // 200)} min read",
            "plagiarism_originality": "100% Humanized",
            "ai_score": f"{d['burstiness_index']} Burstiness ({d['ai_probability_score']})",
            "execution_time_seconds": 1.5 if tone_label == "Easy" else (4.0 if tone_label == "Medium" else 7.0),
            "created_at": d["created_at"],
            "status": "SUCCESS",
            "is_humanizer": True,
            "humanizer_level": tone_label,
            "original_text": d["original_text"]
        })

    # Combine and sort by created_at descending
    combined = gen_items + draft_items
    combined.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return combined[:limit]


def get_generation_by_id(history_id: int, user_id: str) -> Optional[Dict[str, Any]]:
    """Fetches full generation or humanizer draft details by ID."""
    clean_user = user_id.strip() if user_id and user_id.strip() else "anonymous-guest"
    conn = get_db_connection()
    cursor = conn.cursor()

    if history_id >= 1000000:
        draft_pk = history_id - 1000000
        cursor.execute(
            "SELECT * FROM humanizer_drafts WHERE id = ? AND user_id = ?",
            (draft_pk, clean_user)
        )
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        d = dict(row)
        words = len(d["humanized_text"].split())
        preview_prompt = d["original_text"].strip().replace("\n", " ")
        if len(preview_prompt) > 65:
            preview_prompt = preview_prompt[:65] + "..."
        tone_label = d["tone"]
        if tone_label == "Maximum":
            tone_label = "Hard"
        return {
            "id": history_id,
            "user_id": clean_user,
            "prompt": f"Humanizer: {preview_prompt}",
            "format_type": f"Humanizer ({tone_label})",
            "final_text": d["humanized_text"],
            "formatted_html": "",
            "word_count": words,
            "read_time": f"{max(1, words // 200)} min read",
            "plagiarism_originality": "100% Humanized",
            "ai_score": f"{d['burstiness_index']} Burstiness ({d['ai_probability_score']})",
            "execution_time_seconds": 1.5 if tone_label == "Easy" else (4.0 if tone_label == "Medium" else 7.0),
            "created_at": d["created_at"],
            "status": "SUCCESS",
            "steps": [],
            "is_humanizer": True,
            "humanizer_level": tone_label,
            "original_text": d["original_text"]
        }

    cursor.execute(
        "SELECT * FROM generation_history WHERE id = ? AND user_id = ?",
        (history_id, clean_user)
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None

    item = dict(row)
    if item.get("steps_json"):
        try:
            item["steps"] = json.loads(item["steps_json"])
        except Exception:
            item["steps"] = []
    else:
        item["steps"] = []
    return item


def delete_generation_history(history_id: int, user_id: str) -> bool:
    """Deletes a generation history or humanizer draft record."""
    clean_user = user_id.strip() if user_id and user_id.strip() else "anonymous-guest"
    conn = get_db_connection()
    cursor = conn.cursor()

    if history_id >= 1000000:
        draft_pk = history_id - 1000000
        cursor.execute(
            "DELETE FROM humanizer_drafts WHERE id = ? AND user_id = ?",
            (draft_pk, clean_user)
        )
        affected = cursor.rowcount
        conn.commit()
        conn.close()
        return affected > 0

    cursor.execute(
        "DELETE FROM generation_history WHERE id = ? AND user_id = ?",
        (history_id, clean_user)
    )
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def save_humanizer_draft(
    user_id: str,
    original_text: str,
    humanized_text: str,
    tone: str,
    burstiness: float,
    ai_prob: str,
    credits_used: int = 1
) -> int:
    """Saves a workspace humanizer output draft."""
    clean_user = user_id.strip() if user_id and user_id.strip() else "anonymous-guest"
    now_str = _get_current_iso_str()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO humanizer_drafts (user_id, original_text, humanized_text, tone, burstiness_index, ai_probability_score, credits_used, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (clean_user, original_text, humanized_text, tone, burstiness, ai_prob, credits_used, now_str)
    )
    draft_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return draft_id
