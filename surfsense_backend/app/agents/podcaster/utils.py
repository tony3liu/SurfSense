def get_voice_for_provider(provider: str, speaker_id: int) -> dict | str:
    """
    Get the appropriate voice configuration based on the TTS provider and speaker ID.

    Args:
        provider: The TTS provider (e.g., "openai/tts-1", "vertex_ai/test")
        speaker_id: The ID of the speaker (0-5)

    Returns:
        Voice configuration - string for OpenAI, dict for Vertex AI
    """
    if provider == "local/kokoro":
        # Kokoro voice mapping - https://huggingface.co/hexgrad/Kokoro-82M/tree/main/voices
        kokoro_voices = {
            0: "am_adam",  # Default/intro voice
            1: "af_bella",  # First speaker
        }
        return kokoro_voices.get(speaker_id, "af_heart")

    # Extract provider type from the model string
    provider_type = (
        provider.split("/")[0].lower() if "/" in provider else provider.lower()
    )

    if provider_type == "openai":
        # OpenAI voice mapping - simple string values
        openai_voices = {
            0: "alloy",  # Default/intro voice
            1: "echo",  # First speaker
            2: "fable",  # Second speaker
            3: "onyx",  # Third speaker
            4: "nova",  # Fourth speaker
            5: "shimmer",  # Fifth speaker
        }
        return openai_voices.get(speaker_id, "alloy")

    elif provider_type == "vertex_ai":
        # Vertex AI voice mapping - dict with languageCode and name
        vertex_voices = {
            0: {
                "languageCode": "en-US",
                "name": "en-US-Studio-O",
            },
            1: {
                "languageCode": "en-US",
                "name": "en-US-Studio-M",
            },
            2: {
                "languageCode": "en-UK",
                "name": "en-UK-Studio-A",
            },
            3: {
                "languageCode": "en-UK",
                "name": "en-UK-Studio-B",
            },
            4: {
                "languageCode": "en-AU",
                "name": "en-AU-Studio-A",
            },
            5: {
                "languageCode": "en-AU",
                "name": "en-AU-Studio-B",
            },
        }
        return vertex_voices.get(speaker_id, vertex_voices[0])
    elif provider_type == "azure":
        # OpenAI voice mapping - simple string values
        azure_voices = {
            0: "alloy",  # Default/intro voice
            1: "echo",  # First speaker
            2: "fable",  # Second speaker
            3: "onyx",  # Third speaker
            4: "nova",  # Fourth speaker
            5: "shimmer",  # Fifth speaker
        }
        return azure_voices.get(speaker_id, "alloy")

    else:
        # Default fallback to OpenAI format for unknown providers
        default_voices = {
            0: {},
            1: {},
        }
        return default_voices.get(speaker_id, default_voices[0])


def get_available_voices(provider: str) -> list[dict]:
    """
    Get a list of available voices for the specified TTS provider.

    Args:
        provider: The TTS provider (e.g., "openai/tts-1", "vertex_ai/test", "local/kokoro")

    Returns:
        List of voice dictionaries with structure: [{"id": str, "name": str, "description": str}, ...]
    """
    if provider == "local/kokoro":
        # Kokoro voices from https://huggingface.co/hexgrad/Kokoro-82M/tree/main/voices
        return [
            {"id": "am_adam", "name": "Adam (Male)", "description": "American English male voice"},
            {"id": "af_bella", "name": "Bella (Female)", "description": "American English female voice"},
            {"id": "af_heart", "name": "Heart (Female)", "description": "American English female voice (warm)"},
            {"id": "af_sarah", "name": "Sarah (Female)", "description": "American English female voice"},
            {"id": "am_michael", "name": "Michael (Male)", "description": "American English male voice"},
            {"id": "bf_emma", "name": "Emma (Female)", "description": "British English female voice"},
            {"id": "bm_george", "name": "George (Male)", "description": "British English male voice"},
        ]

    # Extract provider type from the model string
    provider_type = provider.split("/")[0].lower() if "/" in provider else provider.lower()

    if provider_type == "openai":
        return [
            {"id": "alloy", "name": "Alloy", "description": "Neutral, balanced voice"},
            {"id": "echo", "name": "Echo", "description": "Male, clear voice"},
            {"id": "fable", "name": "Fable", "description": "British, expressive voice"},
            {"id": "onyx", "name": "Onyx", "description": "Deep, authoritative voice"},
            {"id": "nova", "name": "Nova", "description": "Female, energetic voice"},
            {"id": "shimmer", "name": "Shimmer", "description": "Female, soft voice"},
        ]

    elif provider_type == "vertex_ai":
        return [
            {"id": "en-US-Studio-O", "name": "US Studio O", "description": "US English neutral voice"},
            {"id": "en-US-Studio-M", "name": "US Studio M", "description": "US English male voice"},
            {"id": "en-UK-Studio-A", "name": "UK Studio A", "description": "UK English voice A"},
            {"id": "en-UK-Studio-B", "name": "UK Studio B", "description": "UK English voice B"},
            {"id": "en-AU-Studio-A", "name": "AU Studio A", "description": "Australian English voice A"},
            {"id": "en-AU-Studio-B", "name": "AU Studio B", "description": "Australian English voice B"},
        ]

    elif provider_type == "azure":
        # Azure uses OpenAI-compatible voices
        return [
            {"id": "alloy", "name": "Alloy", "description": "Neutral, balanced voice"},
            {"id": "echo", "name": "Echo", "description": "Male, clear voice"},
            {"id": "fable", "name": "Fable", "description": "British, expressive voice"},
            {"id": "onyx", "name": "Onyx", "description": "Deep, authoritative voice"},
            {"id": "nova", "name": "Nova", "description": "Female, energetic voice"},
            {"id": "shimmer", "name": "Shimmer", "description": "Female, soft voice"},
        ]

    else:
        # Default empty list for unknown providers
        return []
