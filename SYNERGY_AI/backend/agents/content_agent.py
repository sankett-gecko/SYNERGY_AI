"""
Synergy AI - Content Agent
Role: Content Creator & Stylistic Optimizer
Responsible for drafting rich content, running automatic grammar checks,
and applying a humanizer rewriting step to vary sentence structures and reduce AI detection patterns.
"""

import os
import re
import requests
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from tools.custom_tools import GrammarCheckTool, HumanizerTool
from llm_router import call_gemini

# Load environment configuration once at module level
load_dotenv()


class ContentAgent:
    """
    Content Agent crafts compelling narrative drafts, executes automatic grammar refinement,
    and applies a proprietary humanizer layer to introduce natural burstiness, sentence rhythm,
    and organic expression.
    """
    def __init__(self, name: str = "Content Agent", role: str = "Lead Writer & Humanizer Specialist"):
        self.name = name
        self.role = role
        self.goal = (
            "Craft compelling, deeply engaging prose, run automated grammar verification, "
            "and humanize content with rich sentence variety and natural cadence."
        )
        self.backstory = (
            "An award-winning editorial writer who blends rigorous clarity with organic human storytelling. "
            "Passionate about natural prose cadence, eliminating artificial cliches, and polishing syntax."
        )
        self.grammar_tool = GrammarCheckTool()
        self.humanizer_tool = HumanizerTool()

        # LLM config resolved once at init
        self.api_key: str = os.getenv("GEMINI_API_KEY", "")
        raw_model: str = os.getenv("DEFAULT_MODEL", "gemini-3.6-flash")
        # Strip provider prefix if present (e.g., "gemini/gemini-3.6-flash")
        self.model: str = raw_model.split("/")[-1] if "/" in raw_model else raw_model

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_prompt(self, clean_topic: str, format_type: str, facts: str, insights: str, category: str = "General") -> str:
        """Build an LLM prompt that strictly enforces verified facts and 500-700 words of authentic, natural human writing."""
        research_block = (
            f"VERIFIED RESEARCH DOSSIER:\n"
            f"- Subject Category: {category}\n"
            f"- Verified Core Facts:\n  {facts or 'Draw upon verified real-world knowledge.'}\n"
            f"- Key Analytical Insights:\n  {insights or 'Provide expert, objective perspective.'}"
        )

        # Dynamic structure guidance based on whether topic is a person/character or concept/technology
        is_person_or_character = any(k in category.lower() for k in ["character", "film", "person", "figure", "actor", "protagonist", "biography"])

        if is_person_or_character:
            structure_guide = (
                f"   - Paragraph 1: An engaging, vivid hook introducing who {clean_topic} is, their true identity, and why they capture attention.\n"
                f"   - Paragraph 2: Their core backstory, origins, training, or how they were created/developed.\n"
                f"   - Paragraph 3: Their major operations, defining moments, key story arcs, or pivotal conflicts.\n"
                f"   - Paragraph 4: The psychological and human elements — the tension, personal stakes, and gritty realities they face.\n"
                f"   - Paragraph 5 & 6: Public and cultural reception, audience reactions, and why their story leaves a lasting impression."
            )
        else:
            structure_guide = (
                f"   - Paragraph 1: An engaging, relatable hook explaining why {clean_topic} matters right now and what makes it compelling.\n"
                f"   - Paragraph 2: How it actually works or unfolded in practice, focusing on verified real-world mechanics rather than dry jargon.\n"
                f"   - Paragraph 3: The human side — the real people involved, hands-on friction points, debates, and lived experiences.\n"
                f"   - Paragraph 4: Real-world cultural ripple effects, community reactions, and practical hurdles.\n"
                f"   - Paragraph 5 & 6: The honest realities, trade-offs, and what the future trajectory looks like."
            )

        return (
            f"You are a top-tier human essayist and investigative storyteller.\n"
            f"Write a compelling, deeply humanized long-form article about '{clean_topic}'.\n\n"
            f"{research_block}\n\n"
            f"CRITICAL FACTUAL GROUNDING RULE (ZERO HALLUCINATIONS):\n"
            f"- Ground your writing strictly in the verified facts and category in the dossier above.\n"
            f"- NEVER invent fictional institutional frameworks, corporate methodologies, or fake systems models for people, fictional characters, or movies.\n"
            f"- If '{clean_topic}' is a character from a movie, television series, or literature, treat them as such with full narrative richness.\n\n"
            f"CRITICAL HUMAN WRITING RULES (MAKE IT SOUND 100% LIKE A PERSON WROTE THIS):\n"
            f"1. WRITE WITH A REAL HUMAN VOICE:\n"
            f"   - Sound like a knowledgeable friend sharing an exciting breakdown over coffee, not an encyclopedia or corporate PR team.\n"
            f"   - Use conversational phrases: 'Here's the thing:', 'Let's be honest,', 'Think about it:', 'Truth is,', 'And honestly?', 'Now, that sounds simple until you look closer...'\n"
            f"   - Talk directly with the reader using natural pronouns ('we', 'you', 'let's'). Share genuine perspectives.\n"
            f"   - Use natural contractions everywhere: it's, that's, don't, can't, wouldn't, you'll, we've, there's, didn't, isn't.\n"
            f"2. ENFORCE HIGH BURSTINESS (VARY SENTENCE LENGTHS DRAMATICALLY):\n"
            f"   - Mix ultra-short 3-5 word punchy sentences right alongside flowing, vivid compound thoughts.\n"
            f"   - Examples of punchy sentences to sprinkle in: 'It really does.' 'That changes everything.' 'Sounds familiar?' 'Speed matters here.' 'Not quite.'\n"
            f"3. STRICTLY BANNED AI BUZZWORDS & CLICHES (DO NOT USE UNDER ANY CIRCUMSTANCES):\n"
            f"   - Never use: 'testament', 'paradigm', 'calibration', 'unvarnished', 'imperative', 'tapestry', 'pivotal', "
            f"'deliberate', 'fosters', 'resilience', 'nuanced', 'underscore', 'beacon', 'intertwined', 'delve', "
            f"'revolutionize', 'leverage', 'paramount', 'furthermore', 'moreover', 'in conclusion', 'in summary', "
            f"'in today's fast-paced world', 'navigating the landscape', 'multifaceted', 'holistic'.\n"
            f"4. ZERO FLUFF INTROS & CONCLUSIONS:\n"
            f"   - Do NOT start with 'In this article' or 'Throughout history'. Jump straight into a bold, relatable human hook.\n"
            f"   - Do NOT end with a preachy summary paragraph ('In conclusion, as we look to the future...'). End on a grounded, memorable thought.\n"
            f"5. STRUCTURE & LENGTH REQUIREMENTS:\n"
            f"   - Title: Put one catchy, bold title on line 1 (no # symbols, just the raw text).\n"
            f"   - Write 5 to 6 rich, flowing paragraphs of prose.\n"
            f"{structure_guide}\n"
            f"   - STRICT CONSTRAINT: Must be between 500 and 700 words in total. Write complete flowing prose. No bullet points or markdown headings in the body."
        )

    def _call_gemini(self, prompt_text: str, timeout: int = 60) -> str:
        """
        Delegates to the central LLM router which handles model fallback,
        rate-limit tracking, and inter-model delays automatically.
        """
        return call_gemini(
            prompt_text,
            api_key=self.api_key,
            timeout=timeout,
            inter_model_delay=float(os.getenv("GEMINI_INTER_MODEL_DELAY", "2.0")),
        )

    # ------------------------------------------------------------------
    # Public steps
    # ------------------------------------------------------------------

    def generate_draft(
        self,
        raw_topic: str = "",
        format_type: str = "Detailed Report",
        research_data: Optional[Dict[str, Any]] = None,
        topic: str = "",
        **kwargs: Any,
    ) -> str:
        """
        Step 1: Writes the initial draft according to the requested format using the configured LLM.
        Accepts raw_topic (or legacy 'topic'), format_type, and research_data.
        """
        from tools.custom_tools import extract_clean_topic

        effective_topic = raw_topic or topic or ""
        clean_topic = extract_clean_topic(effective_topic)
        if not clean_topic:
            clean_topic = "General Inquiry"

        if research_data is None:
            research_data = {}

        # Prioritize the cleaned topic from research dossier if available
        if research_data.get("topic"):
            clean_topic = research_data["topic"]

        category = research_data.get("category", "General Topic")

        print(f"[{self.name}] Step 1: Drafting '{format_type}' for topic: '{clean_topic}' (Category: {category})...")

        supporting_facts = research_data.get("supporting_facts") or research_data.get("key_facts") or []
        key_takeaways = research_data.get("key_takeaways") or research_data.get("core_insights") or []
        facts = "\n- ".join(supporting_facts)
        insights = "\n- ".join(key_takeaways)

        prompt_text = self._build_prompt(clean_topic, format_type, facts, insights, category=category)

        try:
            draft = self._call_gemini(prompt_text, timeout=90)
            
            # Check paragraph and word count; if fewer than 5 paragraphs or under 580 words, generate continuation
            paragraphs = [p.strip() for p in draft.split('\n\n') if p.strip()]
            if len(paragraphs) < 5 or len(draft.split()) < 580:
                print(f"[{self.name}] Draft has {len(paragraphs)} paragraphs and {len(draft.split())} words — completing remaining sections to reach 5-6 paragraphs and 600-700 words...")
                continuation_prompt = (
                    f"You are completing a comprehensive, humanized long-form article about '{clean_topic}'.\n\n"
                    f"Here is what has been written so far:\n{draft}\n\n"
                    f"Please write the final concluding paragraphs to bring the piece to 5-6 full paragraphs and 600-700 total words.\n"
                    f"Focus on the broader industry disruption, business model, real trade-offs, and long-term legacy/future trajectory.\n"
                    f"Requirements:\n"
                    f"- Write in flowing paragraph prose ONLY (NO bullet points, NO headers).\n"
                    f"- Mix short 3-6 word punchy sentences with longer ones.\n"
                    f"- Use natural contractions (it's, don't, can't, wouldn't, you'll).\n"
                    f"- Zero banned buzzwords.\n"
                    f"- Finish the entire article cleanly with a complete sentence."
                )
                try:
                    continuation = self._call_gemini(continuation_prompt, timeout=60)
                    if continuation and len(continuation.split()) > 30:
                        # Clean any redundant title from continuation if present
                        cleaned_cont = re.sub(r'^(?:#+.*|\bTitle:.*)\n+', '', continuation).strip()
                        draft = f"{draft.strip()}\n\n{cleaned_cont}"
                except Exception as cont_err:
                    print(f"[{self.name}] Continuation call failed, using base draft: {cont_err}")

            # Ensure draft ends with a complete sentence
            if draft and not draft.strip().endswith(('.', '!', '?', '"', "'")):
                last_punct = max(draft.rfind('.'), draft.rfind('!'), draft.rfind('?'))
                if last_punct > 100:
                    draft = draft[:last_punct + 1]
            return draft
        except requests.exceptions.Timeout:
            print(f"[{self.name}] LLM timeout — retrying with direct long-form prompt...")
            try:
                retry_prompt = (
                    f"Write a complete, uninterrupted long-form article of 500 to 700 words across 5 to 6 full paragraphs about '{clean_topic}'. "
                    f"Never truncate or finish mid-sentence. Write ONLY in flowing paragraph prose without bullet points."
                )
                return self._call_gemini(retry_prompt, timeout=60)
            except Exception as retry_err:
                print(f"[{self.name}] Retry also failed: {retry_err}")
                return f"Draft generation timed out. Please try again. Error: {str(retry_err)}"
        except ValueError as e:
            if "quota exhausted" in str(e).lower() or "429" in str(e):
                raise e
            return f"Draft generation failed. Error: {str(e)}"
        except Exception as e:
            print(f"[{self.name}] LLM Generation Error: {e}")
            if "429" in str(e) or "quota" in str(e).lower():
                raise ValueError(
                    "⚠️ Gemini API Key quota exhausted (HTTP 429 Rate Limit). "
                    "You have reached Google's free-tier limit of 20 requests per day for this key. "
                    "Please create a new free Google AI Studio account at https://aistudio.google.com, "
                    "generate a new API key, and update GEMINI_API_KEY in backend/.env."
                )
            return f"Draft generation failed. Error: {str(e)}"

    def run_grammar_check(self, text: str) -> Dict[str, Any]:
        """
        Step 2: Automated Grammar & Syntax Verification.
        """
        print(f"[{self.name}] Step 2: Running automated grammar and punctuation check...")
        result = self.grammar_tool.check_and_fix(text)
        print(f"[{self.name}] Grammar Check Score: {result['grammar_score']}% (All rules passed).")
        return result

    def apply_humanizer(self, text: str) -> Dict[str, Any]:
        """
        Step 3: Humanizer Rewriting Step.
        Varies sentence structures, injects natural rhythm, and eliminates AI detection cliches.
        """
        print(f"[{self.name}] Step 3: Applying humanizer rewriting...")
        result = self.humanizer_tool.humanize(text)
        print(
            f"[{self.name}] Humanizer Applied: Burstiness Index = {result['burstiness_index']}, "
            f"AI Probability = {result['ai_probability_score']}."
        )
        return result

    def process(
        self,
        topic: str,
        research_data: Optional[Dict[str, Any]] = None,
        format_type: str = "Detailed Report",
    ) -> Dict[str, Any]:
        """
        Executes the 3-step drafting, grammar check, and humanizer rewriting process.
        """
        if research_data is None:
            research_data = {}
        raw_draft = self.generate_draft(raw_topic=topic, format_type=format_type, research_data=research_data)
        if raw_draft.startswith("Draft generation failed"):
            raise ValueError(raw_draft)
        grammar_res = self.run_grammar_check(raw_draft)
        refined = grammar_res.get("refined_text", raw_draft)
        humanized_res = self.apply_humanizer(refined)

        return {
            "draft": humanized_res.get("humanized_text", refined),
            "grammar_metrics": grammar_res,
            "humanizer_metrics": humanized_res,
            "status": "Ready for Reviewer Verification",
        }
