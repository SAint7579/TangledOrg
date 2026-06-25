"""Conversational chat agent for the Tangled Org platform.

Uses all available tools (Tangled-native + governance) in a ReAct loop so it
can answer questions like:
  - "What repos do we have?"
  - "Show me open issues in the payments-api repo"
  - "What PRs are waiting for review?"
  - "Does the auth-service have a compliance profile?"
  - "Which controls failed in the last PR assessment for checkout?"
  - "Give me a summary of what's going on in the org"

Usage:
    from src.agent.chat import run_chat

    response = run_chat("What are our open incidents?")
    print(response)

Or via the API: POST /api/agent/chat
    {"message": "List open issues in payments-api", "history": []}
"""

from typing import Optional

try:
    from langchain_anthropic import ChatAnthropic
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
    from langgraph.prebuilt import create_react_agent

    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False

from src.agent.tools import ALL_TOOLS
from src.config import settings

_SYSTEM_PROMPT = """You are the Tangled Org assistant — an AI that helps teams understand \
their repositories, issues, pull requests, and compliance state on the Tangled platform.

You have access to tools that can:
- List and inspect repositories, issues, and pull requests
- Browse repo file trees and commit history
- Read compliance profiles, policy packs, and control evaluations
- Check audit logs, agent runs, and waivers
- View dependency graphs between repos and code
- Look up organization members, teams, and roles

Guidelines:
- Always use tools to fetch current data before answering; never guess
- When asked about "issues" clarify if you mean Tangled issues or compliance incidents if ambiguous
- Be concise: summarize lists rather than dumping raw data unless the user asks for details
- If a tool returns an error, explain what happened and offer alternatives
- Format lists with bullet points or tables when there are multiple items
"""

_graph = None


def _get_graph():
    global _graph
    if _graph is None:
        if not _AVAILABLE:
            raise RuntimeError(
                "Chat agent requires langchain-anthropic and langgraph. "
                "Install with: pip install 'tangled-org[agent]'"
            )
        api_key = settings.anthropic_api_key
        if not api_key:
            raise RuntimeError(
                "TANGLED_ORG_ANTHROPIC_API_KEY is not set in your .env file."
            )
        llm = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=api_key,
            max_tokens=4096,
        )
        _graph = create_react_agent(
            model=llm,
            tools=ALL_TOOLS,
            prompt=_SYSTEM_PROMPT,
        )
    return _graph


def run_chat(
    message: str,
    history: Optional[list[dict]] = None,
) -> str:
    """Run the chat agent for a single turn.

    message: the user's current message
    history: list of prior turns as [{"role": "human"|"assistant", "content": str}, ...]

    Returns the assistant's response as a string.
    """
    graph = _get_graph()

    messages = []
    for turn in (history or []):
        role = turn.get("role", "")
        content = turn.get("content", "")
        if role == "human":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=message))

    result = graph.invoke({"messages": messages})

    # The last message in the result is the assistant's reply
    last = result["messages"][-1]
    if hasattr(last, "content"):
        return last.content
    return str(last)
