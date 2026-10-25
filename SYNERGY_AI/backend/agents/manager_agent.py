"""
Synergy AI - Manager Agent
Role: Multi-Agent System Coordinator
Coordinates the end-to-end execution pipeline, distributes tasks,
and ensures proper information flow between Research, Content, and Reviewer agents.
"""

from typing import Dict, Any, List


class ManagerAgent:
    """
    Manager Agent receives the topic prompt from the frontend dashboard,
    validates the request context, orchestrates task delegations across the team,
    and consolidates pipeline progress.
    """
    def __init__(self, name: str = "Manager Agent", role: str = "Project Coordinator"):
        self.name = name
        self.role = role
        self.goal = "Orchestrate research, drafting, humanizing, and quality review to produce publication-ready content."
        self.backstory = (
            "An experienced editorial manager and technical lead who oversees multi-agent workflows, "
            "ensures seamless collaboration, and enforces rigorous quality standards at every milestone."
        )

    def plan_workflow(self, topic: str) -> Dict[str, Any]:
        """
        Formulates the execution roadmap for the incoming user prompt.
        """
        from tools.custom_tools import extract_clean_topic
        clean_topic = extract_clean_topic(topic)
        print(f"[{self.name}] Received request for: '{clean_topic}'")
        print(f"[{self.name}] Orchestrating 4-stage web-grounded multi-agent pipeline...")

        milestones = [
            {"step": 1, "agent": "Research Agent", "objective": "Live web search (Wikipedia + DuckDuckGo) to unearth authentic facts, background, and categorize entity."},
            {"step": 2, "agent": "Content Agent", "objective": "Draft 500-700 word long-form piece across 5-6 paragraphs grounded strictly in verified web facts with high burstiness."},
            {"step": 3, "agent": "Reviewer Agent", "objective": "Cross-check facts against web search results, verify burstiness, zero banned words, and certify originality."},
            {"step": 4, "agent": "Manager Agent", "objective": "Consolidate telemetry and package final publication payload."}
        ]

        return {
            "topic": clean_topic,
            "status": "Pipeline Initialized",
            "milestones": milestones,
            "coordination_notes": f"Manager scheduled web-researched, fact-verified generation for '{clean_topic}' across 4 specialized agents."
        }
