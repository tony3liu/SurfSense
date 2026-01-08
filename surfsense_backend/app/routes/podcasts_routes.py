"""
Podcast routes for task status polling and audio retrieval.

These routes support the podcast generation feature in new-chat.
Note: The old Chat-based podcast generation has been removed.
"""

import os
from pathlib import Path
from urllib.parse import unquote

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.podcaster.utils import get_available_voices
from app.celery_app import celery_app
from app.db import (
    Permission,
    Podcast,
    SearchSpace,
    SearchSpaceMembership,
    User,
    get_async_session,
)
from app.schemas import PodcastRead
from app.tasks.celery_tasks.podcast_tasks import generate_content_podcast_task
from app.users import current_active_user
from app.utils.rbac import check_permission

router = APIRouter()


@router.get("/podcasts", response_model=list[PodcastRead])
async def read_podcasts(
    skip: int = 0,
    limit: int = 100,
    search_space_id: int | None = None,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    List podcasts the user has access to.
    Requires PODCASTS_READ permission for the search space(s).
    """
    if skip < 0 or limit < 1:
        raise HTTPException(status_code=400, detail="Invalid pagination parameters")
    try:
        if search_space_id is not None:
            # Check permission for specific search space
            await check_permission(
                session,
                user,
                search_space_id,
                Permission.PODCASTS_READ.value,
                "You don't have permission to read podcasts in this search space",
            )
            result = await session.execute(
                select(Podcast)
                .filter(Podcast.search_space_id == search_space_id)
                .offset(skip)
                .limit(limit)
            )
        else:
            # Get podcasts from all search spaces user has membership in
            result = await session.execute(
                select(Podcast)
                .join(SearchSpace)
                .join(SearchSpaceMembership)
                .filter(SearchSpaceMembership.user_id == user.id)
                .offset(skip)
                .limit(limit)
            )
        return result.scalars().all()
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=500, detail="Database error occurred while fetching podcasts"
        ) from None


@router.get("/podcasts/{podcast_id}", response_model=PodcastRead)
async def read_podcast(
    podcast_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    Get a specific podcast by ID.
    Requires PODCASTS_READ permission for the search space.
    """
    try:
        result = await session.execute(select(Podcast).filter(Podcast.id == podcast_id))
        podcast = result.scalars().first()

        if not podcast:
            raise HTTPException(
                status_code=404,
                detail="Podcast not found",
            )

        # Check permission for the search space
        await check_permission(
            session,
            user,
            podcast.search_space_id,
            Permission.PODCASTS_READ.value,
            "You don't have permission to read podcasts in this search space",
        )

        return podcast
    except HTTPException as he:
        raise he
    except SQLAlchemyError:
        raise HTTPException(
            status_code=500, detail="Database error occurred while fetching podcast"
        ) from None


@router.delete("/podcasts/{podcast_id}", response_model=dict)
async def delete_podcast(
    podcast_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    Delete a podcast.
    Requires PODCASTS_DELETE permission for the search space.
    """
    try:
        result = await session.execute(select(Podcast).filter(Podcast.id == podcast_id))
        db_podcast = result.scalars().first()

        if not db_podcast:
            raise HTTPException(status_code=404, detail="Podcast not found")

        # Check permission for the search space
        await check_permission(
            session,
            user,
            db_podcast.search_space_id,
            Permission.PODCASTS_DELETE.value,
            "You don't have permission to delete podcasts in this search space",
        )

        await session.delete(db_podcast)
        await session.commit()
        return {"message": "Podcast deleted successfully"}
    except HTTPException as he:
        raise he
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500, detail="Database error occurred while deleting podcast"
        ) from None


@router.get("/podcasts/{podcast_id}/stream")
@router.get("/podcasts/{podcast_id}/audio")
async def stream_podcast(
    podcast_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    Stream a podcast audio file.
    Requires PODCASTS_READ permission for the search space.

    Note: Both /stream and /audio endpoints are supported for compatibility.
    """
    try:
        result = await session.execute(select(Podcast).filter(Podcast.id == podcast_id))
        podcast = result.scalars().first()

        if not podcast:
            raise HTTPException(
                status_code=404,
                detail="Podcast not found",
            )

        # Check permission for the search space
        await check_permission(
            session,
            user,
            podcast.search_space_id,
            Permission.PODCASTS_READ.value,
            "You don't have permission to access podcasts in this search space",
        )

        # Get the file path
        file_path = podcast.file_location

        # Check if the file exists
        if not file_path or not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="Podcast audio file not found")

        # Define a generator function to stream the file
        def iterfile():
            with open(file_path, mode="rb") as file_like:
                yield from file_like

        # Return a streaming response with appropriate headers
        return StreamingResponse(
            iterfile(),
            media_type="audio/mpeg",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Disposition": f"inline; filename={Path(file_path).name}",
            },
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error streaming podcast: {e!s}"
        ) from e


@router.get("/podcasts/task/{task_id}/status")
async def get_podcast_task_status(
    task_id: str,
    user: User = Depends(current_active_user),
):
    """
    Get the status of a podcast generation task.
    Used by new-chat frontend to poll for completion.

    Returns:
    - status: "processing" | "success" | "error"
    - podcast_id: (only if status == "success")
    - title: (only if status == "success")
    - error: (only if status == "error")
    """
    try:
        result = AsyncResult(task_id, app=celery_app)

        if result.ready():
            # Task completed
            if result.successful():
                task_result = result.result
                if isinstance(task_result, dict):
                    if task_result.get("status") == "success":
                        return {
                            "status": "success",
                            "podcast_id": task_result.get("podcast_id"),
                            "title": task_result.get("title"),
                            "transcript_entries": task_result.get("transcript_entries"),
                        }
                    else:
                        return {
                            "status": "error",
                            "error": task_result.get("error", "Unknown error"),
                        }
                else:
                    return {
                        "status": "error",
                        "error": "Unexpected task result format",
                    }
            else:
                # Task failed
                return {
                    "status": "error",
                    "error": str(result.result) if result.result else "Task failed",
                }
        else:
            # Task still processing
            return {
                "status": "processing",
                "state": result.state,
            }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error checking task status: {e!s}"
        ) from e


@router.get("/podcasts/tts-voices/{provider}")
async def get_tts_voices(
    provider: str,
    user: User = Depends(current_active_user),
):
    """
    Get available TTS voices for a specific provider.

    Args:
        provider: TTS provider (e.g., "openai/tts-1", "vertex_ai/test", "local/kokoro")
                  URL-encoded if it contains "/"

    Returns:
        List of available voices with structure: [{"id": str, "name": str, "description": str}, ...]
    """
    try:
        # URL decode the provider parameter
        decoded_provider = unquote(provider)

        # Get available voices from utils
        voices = get_available_voices(decoded_provider)

        return {"provider": decoded_provider, "voices": voices}

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching TTS voices: {e!s}"
        ) from e


@router.post("/podcasts/generate")
async def generate_podcast(
    search_space_id: int = Form(...),
    podcast_title: str = Form("SurfSense Podcast"),
    user_prompt: str | None = Form(None),
    tts_provider: str | None = Form(None),
    speaker_0_voice: str | None = Form(None),
    speaker_1_voice: str | None = Form(None),
    source_type: str = Form("text"),
    text_content: str | None = Form(None),
    document_file: UploadFile | None = File(None),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    Generate a podcast from text content or uploaded document.

    Requires PODCASTS_CREATE permission for the search space.

    Args:
        search_space_id: ID of the search space
        podcast_title: Title for the podcast
        user_prompt: Optional style/tone instructions
        tts_provider: TTS provider to use (e.g., "openai/tts-1")
        speaker_0_voice: Voice for speaker 0
        speaker_1_voice: Voice for speaker 1
        source_type: "text" or "document"
        text_content: Text content (if source_type="text")
        document_file: Uploaded document (if source_type="document")

    Returns:
        {"status": "processing", "task_id": str}
    """
    try:
        # Check permission
        await check_permission(
            session,
            user,
            search_space_id,
            Permission.PODCASTS_CREATE.value,
            "You don't have permission to create podcasts in this search space",
        )

        # Validate input based on source_type
        if source_type == "text":
            if not text_content or not text_content.strip():
                raise HTTPException(
                    status_code=400, detail="text_content is required when source_type is 'text'"
                )
            source_content = text_content.strip()

        elif source_type == "document":
            if not document_file:
                raise HTTPException(
                    status_code=400, detail="document_file is required when source_type is 'document'"
                )

            # TODO: Extract text from document using ETL service
            # For now, read as plain text (this should be replaced with proper ETL integration)
            try:
                file_content = await document_file.read()
                source_content = file_content.decode("utf-8")
            except UnicodeDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail="Could not decode document. Please upload a text file or implement ETL service.",
                ) from None
        else:
            raise HTTPException(
                status_code=400, detail="source_type must be 'text' or 'document'"
            )

        # Build custom voices mapping
        custom_voices = None
        if speaker_0_voice or speaker_1_voice:
            custom_voices = {}
            if speaker_0_voice:
                custom_voices[0] = speaker_0_voice
            if speaker_1_voice:
                custom_voices[1] = speaker_1_voice

        # Submit Celery task
        task = generate_content_podcast_task.delay(
            source_content=source_content,
            search_space_id=search_space_id,
            podcast_title=podcast_title,
            user_prompt=user_prompt,
            tts_provider=tts_provider,
            custom_voices=custom_voices,
            source_type=source_type,
        )

        return {"status": "processing", "task_id": task.id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating podcast: {e!s}"
        ) from e
