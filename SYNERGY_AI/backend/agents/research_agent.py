"""
Synergy AI - Research Agent
Role: Domain Researcher & Context Specialist
Searches for facts, trends, and analytical context on the requested topic.
"""

from typing import Dict, Any
from tools.custom_tools import ResearchTool


class ResearchAgent:
    """
    Research Agent investigates the topic thoroughly, unearthing statistics,
    core concepts, industry benchmarks, and actionable insights.
    """
    def __init__(self, name: str = "Research Agent", role: str = "Senior Domain Researcher"):
        self.name = name
        self.role = role
        self.goal = "Uncover authoritative facts, statistical data, and deep contextual insights for any given topic."
        self.backstory = (
            "A meticulous analytical researcher skilled in deep information retrieval, data verification, "
            "and extracting the most compelling angles from complex industry landscapes."
        )
        self.tool = ResearchTool()

    def conduct_research(self, topic: str) -> Dict[str, Any]:
        """
        Executes domain research and fact gathering via live web search.
        """
        print(f"[{self.name}] Searching web (Wikipedia + DuckDuckGo) for '{topic}'...")
        research_data = self.tool.search_facts(topic)
        clean_topic = research_data.get("topic", topic)
        category = research_data.get("category", "General Topic")
        key_facts = research_data.get("key_facts", [])

        brief = {
            "topic": clean_topic,
            "raw_topic": topic,
            "category": category,
            "key_takeaways": research_data.get("core_insights", []),
            "supporting_facts": key_facts,
            "sources_count": research_data.get("sources_analyzed", 0),
            "sources_list": research_data.get("sources_list", []),
            "summary": f"Comprehensive web-verified dossier on '{clean_topic}' ({category}) with {len(key_facts)} evidence points across {research_data.get('sources_analyzed', 0)} sources."
        }

        print(f"[{self.name}] Web research complete: Categorized as '{category}' with {len(key_facts)} facts. Handing dossier to Content Agent.")
        return brief
