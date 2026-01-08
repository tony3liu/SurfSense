"""Define the configurable parameters for the agent."""

from __future__ import annotations

from dataclasses import dataclass, fields

from langchain_core.runnables import RunnableConfig


@dataclass(kw_only=True)
class Configuration:
    """The configuration for the agent."""

    # Changeme: Add configurable values here!
    # these values can be pre-set when you
    # create assistants (https://langchain-ai.github.io/langgraph/cloud/how-tos/configuration_cloud/)
    # and when you invoke the graph
    podcast_title: str
    search_space_id: int
    user_prompt: str | None = None

    # TTS configuration
    tts_provider: str | None = None  # Override global TTS_SERVICE (e.g., "openai/tts-1")
    custom_voices: dict[int, str] | None = None  # Custom voice mapping {0: "alloy", 1: "echo"}

    @classmethod
    def from_runnable_config(
        cls, config: RunnableConfig | None = None
    ) -> Configuration:
        """Create a Configuration instance from a RunnableConfig object."""
        configurable = (config.get("configurable") or {}) if config else {}
        _fields = {f.name for f in fields(cls) if f.init}
        return cls(**{k: v for k, v in configurable.items() if k in _fields})
