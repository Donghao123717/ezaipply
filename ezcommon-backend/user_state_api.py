"""
User State API

Stores the per-user application state (profile answers, DS-160 answers, essays,
college list, chat history) server-side so it follows a student across devices
instead of living only in one browser's localStorage.

Values are stored as opaque strings - exactly what the browser holds - so the
backend never needs to track the frontend's schemas.
"""
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from botocore.exceptions import ClientError

from s3_service import get_s3_service

router = APIRouter()

USER_STATE_PREFIX = "user-state"

# Guard against a runaway client filling the bucket with one enormous document.
MAX_STATE_BYTES = 5 * 1024 * 1024


class UserStateResponse(BaseModel):
    ok: bool = True
    state: Dict[str, str] = Field(default_factory=dict)


class UserStateWriteRequest(BaseModel):
    entries: Dict[str, Optional[str]] = Field(
        default_factory=dict,
        description="Keys to write. A null value deletes that key.",
    )


class UserStateWriteResponse(BaseModel):
    ok: bool = True
    keys: int = 0


def _state_key(user_id: str) -> str:
    return f"{USER_STATE_PREFIX}/{user_id}.json"


def _read_state(user_id: str) -> Dict[str, str]:
    svc = get_s3_service()
    try:
        obj = svc.client.get_object(Bucket=svc.bucket_name, Key=_state_key(user_id))
        payload = json.loads(obj["Body"].read().decode("utf-8"))
        return payload if isinstance(payload, dict) else {}
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
            return {}
        raise
    except (ValueError, UnicodeDecodeError):
        # A corrupt document should not lock the student out of their account.
        return {}


def _write_state(user_id: str, state: Dict[str, str]) -> None:
    svc = get_s3_service()
    body = json.dumps(state, ensure_ascii=False).encode("utf-8")
    if len(body) > MAX_STATE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Saved data is too large",
        )
    svc.client.put_object(
        Bucket=svc.bucket_name,
        Key=_state_key(user_id),
        Body=body,
        ContentType="application/json",
    )


@router.get("/api/user-state/{user_id}", response_model=UserStateResponse, tags=["User State"])
def get_user_state(user_id: str):
    """Return every saved key for this user, for the browser to hydrate from."""
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id is required")
    try:
        return UserStateResponse(state=_read_state(user_id))
    except ClientError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/api/user-state/{user_id}", response_model=UserStateWriteResponse, tags=["User State"])
def put_user_state(user_id: str, body: UserStateWriteRequest):
    """Merge the given keys into this user's saved state."""
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id is required")
    if not body.entries:
        return UserStateWriteResponse(keys=0)

    try:
        state = _read_state(user_id)
        for key, value in body.entries.items():
            if value is None:
                state.pop(key, None)
            else:
                state[key] = value
        _write_state(user_id, state)
        return UserStateWriteResponse(keys=len(body.entries))
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
