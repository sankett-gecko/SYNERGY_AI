"""
Synergy AI - Multi-Agent Tasks Specification
Defines task descriptions and expected outputs for Manager, Research, Content, and Reviewer agents.
"""

from typing import Dict, Any


class SynergyTasks:
    """
    Standard task definitions ensuring uninterrupted, long-form depth across the pipeline.
    """

    @staticmethod
    def manager_coordination_task(topic: str) -> Dict[str, Any]:
        return {
            "description": f"Coordinate the 4-agent pipeline for topic '{topic}'. Define a 5-6 paragraph structure covering background, mechanics, personalities, social impact, business model, and long-term legacy.",
            "expected_output": "A coordinated workflow roadmap directing all agents to produce a 500-700 word long-form publication-ready article.",
            "agent": "Manager Agent"
        }

    @staticmethod
    def research_task(topic: str) -> Dict[str, Any]:
        return {
            "description": f"Gather live web search evidence (Wikipedia, DuckDuckGo), factual dimensions, and contextual insights on '{topic}'.",
            "expected_output": "A comprehensive, web-verified research brief with key evidence points, category identification, and core insights.",
            "agent": "Research Agent"
        }

    @staticmethod
    def content_creation_task(topic: str, format_type: str = "Detailed Report") -> Dict[str, Any]:
        return {
            "description": f"Draft an authentic, humanized {format_type} about '{topic}' across 5 to 6 full paragraphs grounded in verified facts with high sentence burstiness and zero AI clichés.",
            "expected_output": "A complete, uninterrupted long-form article of 500 to 700 words across 5 to 6 full paragraphs. Never truncate or finish mid-sentence.",
            "agent": "Content Agent"
        }

    @staticmethod
    def review_and_approval_task(topic: str) -> Dict[str, Any]:
        return {
            "description": f"Inspect the complete draft on '{topic}' for web fact-checking accuracy, originality, paragraph structure, word count (500-700 words), zero banned buzzwords, and burstiness.",
            "expected_output": "A complete, uninterrupted long-form article of 500 to 700 words across 5 to 6 full paragraphs with web fact verification and originality certificate.",
            "agent": "Reviewer Agent"
        }
