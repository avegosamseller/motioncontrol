"""Magnific API helper for video generation."""

import asyncio
import logging
import aiohttp
from config import (
    MAGNIFIC_API_KEY,
    MODEL_ENDPOINTS,
    MODEL_STATUS_ENDPOINTS,
    POLL_INTERVAL,
    POLL_TIMEOUT,
)

logger = logging.getLogger(__name__)


async def generate_video(
    model: str,
    image_url: str,
    video_url: str,
    prompt: str = "",
    cfg_scale: float = 0.5,
) -> dict:
    """Submit a video generation task to Magnific API."""
    endpoint = MODEL_ENDPOINTS.get(model)
    if not endpoint:
        return {"error": f"Invalid model: {model}"}

    payload = {
        "image_url": image_url,
        "video_url": video_url,
        "character_orientation": "video",
    }

    if prompt.strip():
        payload["prompt"] = prompt.strip()

    if cfg_scale is not None:
        payload["cfg_scale"] = cfg_scale

    headers = {
        "Content-Type": "application/json",
        "x-freepik-api-key": MAGNIFIC_API_KEY,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(endpoint, json=payload, headers=headers) as resp:
            logger.info(f"Generate request to {endpoint} - Status: {resp.status}")
            if resp.content_type == "application/json":
                data = await resp.json()
            else:
                text = await resp.text()
                logger.error(f"Non-JSON response: {text[:200]}")
                return {"error": f"API error ({resp.status}): {text[:200]}"}

            logger.info(f"Generate response: {str(data)[:300]}")

            if resp.status != 200:
                error_msg = data.get("message") or data.get("error") or f"API error ({resp.status})"
                return {"error": error_msg, "details": data}

            return data


async def check_status(model: str, task_id: str) -> dict:
    """Check the status of a generation task."""
    base_endpoint = MODEL_STATUS_ENDPOINTS.get(model)
    if not base_endpoint:
        return {"error": f"Invalid model: {model}"}

    endpoint = f"{base_endpoint}/{task_id}"

    headers = {
        "x-freepik-api-key": MAGNIFIC_API_KEY,
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(endpoint, headers=headers) as resp:
            if resp.content_type == "application/json":
                data = await resp.json()
            else:
                text = await resp.text()
                return {"error": f"API error ({resp.status}): {text[:200]}"}

            if resp.status != 200:
                error_msg = data.get("message") or data.get("error") or f"Status check failed ({resp.status})"
                return {"error": error_msg}

            return data


def extract_task_id(data: dict) -> str | None:
    """Extract task ID from various response formats."""
    d = data.get("data", {})
    return (
        d.get("id")
        or d.get("task_id")
        or data.get("id")
        or data.get("task_id")
        or data.get("taskId")
    )


def extract_video_url(data: dict) -> str | None:
    """Extract video URL from status response."""
    d = data.get("data", {})

    # Check generated array (Magnific format)
    generated = d.get("generated") or data.get("generated")
    if generated and isinstance(generated, list) and len(generated) > 0:
        return generated[0]

    # Check other possible fields
    if d.get("video_url"):
        return d["video_url"]
    if data.get("video_url"):
        return data["video_url"]

    # Check video array
    videos = d.get("video") or data.get("video")
    if videos and isinstance(videos, list) and len(videos) > 0:
        if isinstance(videos[0], dict):
            return videos[0].get("url")
        return videos[0]

    return None


async def generate_and_wait(
    model: str,
    image_url: str,
    video_url: str,
    prompt: str = "",
    cfg_scale: float = 0.5,
    on_status=None,
) -> dict:
    """
    Submit generation and poll until completed.
    on_status: async callback(status_str) called on each poll
    Returns: {"video_url": "..."} or {"error": "..."}
    """
    # Submit task
    result = await generate_video(model, image_url, video_url, prompt, cfg_scale)

    if "error" in result:
        return result

    task_id = extract_task_id(result)
    if not task_id:
        return {"error": f"No task ID in response: {str(result)[:200]}"}

    # Poll for completion
    elapsed = 0
    while elapsed < POLL_TIMEOUT:
        await asyncio.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

        status_data = await check_status(model, task_id)

        if "error" in status_data:
            return status_data

        status = (status_data.get("data", {}).get("status") or status_data.get("status") or "").lower()

        if on_status:
            await on_status(status)

        if status in ("completed", "succeed", "done"):
            video_url_result = extract_video_url(status_data)
            if video_url_result:
                return {"video_url": video_url_result, "task_id": task_id}
            else:
                return {"error": "Completed but no video URL found"}

        elif status in ("failed", "error"):
            d = status_data.get("data", {})
            error_msg = (
                d.get("error")
                or d.get("message")
                or d.get("failure_reason")
                or status_data.get("error")
                or status_data.get("message")
                or f"Generation failed. Full response: {str(status_data)[:300]}"
            )
            return {"error": error_msg}

    return {"error": f"Timeout after {POLL_TIMEOUT}s. Task ID: {task_id}"}
