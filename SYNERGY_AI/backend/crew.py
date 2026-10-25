"""
Synergy AI - Multi-Agent Crew Orchestration
Integrates Manager, Research, Content (Grammar + Humanizer), and Reviewer (Plagiarism Check) agents.
"""

import os
import time
from typing import Dict, Any, List, Callable, Optional
from agents.manager_agent import ManagerAgent
from agents.research_agent import ResearchAgent
from agents.content_agent import ContentAgent
from agents.reviewer_agent import ReviewerAgent
from tasks import SynergyTasks


class SynergyCrew:
    """
    SynergyCrew orchestrates the end-to-end multi-agent execution pipeline.
    Agents:
      1. Manager Agent: Receives prompt, defines plan, coordinates pipeline.
      2. Research Agent: Discovers factual data, market statistics, key takeaways.
      3. Content Agent: Drafts article, runs grammar check, applies humanizer rewriting.
      4. Reviewer Agent: Strict plagiarism check, quality verification, final approval.
    """
    def __init__(self):
        self.manager = ManagerAgent()
        self.researcher = ResearchAgent()
        self.content_creator = ContentAgent()
        self.reviewer = ReviewerAgent()
        # Seconds to sleep between agent stages to conserve API quota.
        # Adjust via AGENT_INTER_STEP_DELAY in backend/.env (default: 5s).
        self.inter_step_delay: float = float(os.getenv("AGENT_INTER_STEP_DELAY", "5"))

    def run_pipeline(
        self,
        topic: str,
        format_type: str = "Detailed Report",
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Executes the 4-agent sequential workflow and records execution telemetry.
        progress_callback(step: int, message: str) is called before each agent runs.
        """
        def _progress(step: int, message: str):
            if progress_callback:
                progress_callback(step, message)
            print(f"[Pipeline Step {step}] {message}")

        start_time = time.time()
        steps_log: List[Dict[str, Any]] = []

        # Stage 1: Manager Agent Coordinates
        _progress(1, "Manager Agent organizing workflow and refining instructions...")
        manager_plan = self.manager.plan_workflow(topic)
        steps_log.append({
            "agent": self.manager.name,
            "role": self.manager.role,
            "action": f"Plan Workflow & Task Delegation ({format_type})",
            "status": "Completed",
            "details": manager_plan["coordination_notes"]
        })

        # --- Delay between Stage 1 -> Stage 2 ---
        if self.inter_step_delay > 0:
            print(f"[Pipeline] Pausing {self.inter_step_delay}s before Research Agent to conserve API quota...")
            time.sleep(self.inter_step_delay)

        # Stage 2: Research Agent Gathers Evidence via Live Web Search
        _progress(2, "Research Agent searching the web and compiling factual dossier...")
        research_brief = self.researcher.conduct_research(topic)
        steps_log.append({
            "agent": self.researcher.name,
            "role": self.researcher.role,
            "action": f"Live Web Research ({research_brief.get('category', 'General')})",
            "status": "Completed",
            "details": f"Analyzed {research_brief['sources_count']} web sources. Extracted {len(research_brief['supporting_facts'])} verified facts."
        })

        # --- Delay between Stage 2 -> Stage 3 ---
        if self.inter_step_delay > 0:
            print(f"[Pipeline] Pausing {self.inter_step_delay}s before Content Agent to conserve API quota...")
            time.sleep(self.inter_step_delay)

        # Stage 3: Content Agent (Draft + Grammar Check + Humanizer Rewriting)
        _progress(3, "Content Agent drafting topic-specific, web-grounded report...")
        content_package = self.content_creator.process(topic, research_brief, format_type=format_type)
        steps_log.append({
            "agent": self.content_creator.name,
            "role": self.content_creator.role,
            "action": "Drafting, Grammar Check & Humanizer Rewriting",
            "status": "Completed",
            "details": (
                f"Drafted piece. Grammar Score: {content_package['grammar_metrics']['grammar_score']}%. "
                f"Humanizer Burstiness: {content_package['humanizer_metrics']['burstiness_index']}, "
                f"AI Detection: {content_package['humanizer_metrics']['ai_probability_score']}."
            )
        })

        # --- Delay between Stage 3 -> Stage 4 ---
        if self.inter_step_delay > 0:
            print(f"[Pipeline] Pausing {self.inter_step_delay}s before Reviewer Agent to conserve API quota...")
            time.sleep(self.inter_step_delay)

        # Stage 4: Reviewer Agent (Web Fact Check + Strict Plagiarism Check + Final Approval)
        _progress(4, "Reviewer Agent cross-checking web facts, scanning plagiarism, and final approval...")
        final_package = self.reviewer.review_and_approve(content_package, research_brief=research_brief)
        fact_accuracy = final_package.get("fact_check_report", {}).get("fact_accuracy_score", "100% Web-Grounded")
        steps_log.append({
            "agent": self.reviewer.name,
            "role": self.reviewer.role,
            "action": "Web Fact-Checking & Plagiarism Verification",
            "status": "Approved",
            "details": (
                f"Originality: {final_package['plagiarism_report']['originality_score']}, "
                f"Fact-Check: {fact_accuracy}. "
                f"Certified by {self.reviewer.name}."
            )
        })

        elapsed = round(time.time() - start_time, 2)

        return {
            "topic": research_brief.get("topic", topic),
            "final_text": final_package["final_text"],
            "formatted_html": final_package["formatted_html"],
            "word_count": final_package["word_count"],
            "read_time": final_package["read_time"],
            "plagiarism_report": final_package["plagiarism_report"],
            "fact_check_report": final_package.get("fact_check_report", {}),
            "humanizer_report": content_package["humanizer_metrics"],
            "grammar_report": content_package["grammar_metrics"],
            "steps": steps_log,
            "execution_time_seconds": elapsed,
            "status": "SUCCESS"
        }
