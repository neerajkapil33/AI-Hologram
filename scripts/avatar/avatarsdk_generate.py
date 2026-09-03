#!/usr/bin/env python3
"""Generate the production Neeraj avatar with AvatarSDK and install its GLB.

Required environment variables:
  AVATARSDK_CLIENT_ID
  AVATARSDK_CLIENT_SECRET

The script follows AvatarSDK's official OAuth -> Player -> avatar -> export
workflow. Secrets stay server-side; the generated GLB is written to the app's
public/avatar/avatar.glb path.
"""

from __future__ import annotations

import io
import json
import os
import sys
import time
import zipfile
from pathlib import Path

import requests

BASE_URL = "https://api.avatarsdk.com"
PHOTO = Path("assets_private/neeraj.jpg")
OUTPUT = Path("public/avatar/avatar.glb")
PIPELINE = "metaperson_2.0"
PIPELINE_SUBTYPE = "male"
POLL_SECONDS = 5
MAX_AVATAR_POLLS = 180  # 15 minutes
MAX_EXPORT_POLLS = 120   # 10 minutes


def fail(message: str) -> None:
    raise RuntimeError(message)


def json_or_fail(response: requests.Response):
    if not response.ok:
        try:
            detail = response.json()
        except Exception:
            detail = response.text[:1000]
        fail(f"AvatarSDK HTTP {response.status_code}: {detail}")
    return response.json()


def auth_token() -> str:
    client_id = os.environ.get("AVATARSDK_CLIENT_ID")
    client_secret = os.environ.get("AVATARSDK_CLIENT_SECRET")
    if not client_id or not client_secret:
        fail("AVATARSDK_CLIENT_ID and AVATARSDK_CLIENT_SECRET are required")

    response = requests.post(
        f"{BASE_URL}/o/token/",
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        },
        timeout=60,
    )
    data = json_or_fail(response)
    token = data.get("access_token")
    if not token:
        fail(f"AvatarSDK token response did not contain access_token: {data}")
    return token


def headers(token: str, player: str | None = None) -> dict[str, str]:
    result = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if player:
        result["X-PlayerUID"] = player
    return result


def create_player(token: str) -> str:
    response = requests.post(
        f"{BASE_URL}/players/",
        headers=headers(token),
        timeout=60,
    )
    data = json_or_fail(response)
    player = data.get("code")
    if not player:
        fail(f"AvatarSDK player response did not contain code: {data}")
    return player


def create_avatar(token: str, player: str) -> dict:
    if not PHOTO.is_file():
        fail(f"Missing master identity photo: {PHOTO}")

    parameters = {
        "model_info": {"plus": ["gender", "age", "race"]},
        "avatar_modifications": {
            "remove_smile": False,
            "remove_glasses": False,
            "remove_stubble": False,
        },
    }
    export_parameters = {
        "format": "glb",
        "embed": True,
        "blendshapes": {
            "list": ["mobile_51", "visemes_15"],
            "embed": True,
        },
        "haircuts": {
            "list": ["generated"],
            "embed": True,
        },
    }

    with PHOTO.open("rb") as photo:
        files = {"photo": (PHOTO.name, photo, "image/jpeg")}
        data = {
            "name": "Neeraj AI Career Advisor",
            "description": "Production Neeraj AI-Hologram avatar generated from the approved master reference.",
            "pipeline": PIPELINE,
            "pipeline_subtype": PIPELINE_SUBTYPE,
            "parameters": json.dumps(parameters, separators=(",", ":")),
            "export_parameters": json.dumps(export_parameters, separators=(",", ":")),
        }
        response = requests.post(
            f"{BASE_URL}/avatars/",
            headers=headers(token, player),
            data=data,
            files=files,
            timeout=180,
        )
    return json_or_fail(response)


def poll_avatar(token: str, player: str, avatar: dict) -> dict:
    url = avatar["url"]
    for attempt in range(1, MAX_AVATAR_POLLS + 1):
        data = json_or_fail(requests.get(url, headers=headers(token, player), timeout=60))
        status = data.get("status")
        progress = data.get("progress", 0)
        print(f"AvatarSDK avatar: {status} ({progress}%)")
        if status == "Completed":
            return data
        if status in {"Failed", "Timed Out"}:
            fail(f"AvatarSDK avatar generation failed: {data}")
        time.sleep(POLL_SECONDS)
    fail("Timed out waiting for AvatarSDK avatar computation")


def poll_export(token: str, player: str, avatar: dict) -> dict:
    exports_url = avatar["exports"]
    for _ in range(MAX_EXPORT_POLLS):
        exports = json_or_fail(requests.get(exports_url, headers=headers(token, player), timeout=60))
        if not isinstance(exports, list):
            fail(f"Unexpected AvatarSDK exports response: {exports}")
        completed = [item for item in exports if item.get("status") == "Completed"]
        if completed:
            return completed[0]
        failed = [item for item in exports if item.get("status") in {"Failed", "Timed Out"}]
        if failed:
            fail(f"AvatarSDK export failed: {failed[0]}")
        print("AvatarSDK export: waiting")
        time.sleep(POLL_SECONDS)
    fail("Timed out waiting for AvatarSDK export")


def download_glb(token: str, player: str, export: dict) -> bytes:
    files = export.get("files", [])
    avatar_file = next((item for item in files if item.get("identity") == "avatar"), None)
    if not avatar_file or not avatar_file.get("file"):
        fail(f"AvatarSDK export has no avatar file: {export}")

    response = requests.get(
        avatar_file["file"],
        headers=headers(token, player),
        timeout=300,
    )
    if not response.ok:
        fail(f"AvatarSDK GLB archive download failed: HTTP {response.status_code} {response.text[:500]}")

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        candidates = [
            name for name in archive.namelist()
            if name.lower().endswith(".glb") and not name.endswith("/")
        ]
        if not candidates:
            fail(f"AvatarSDK archive contains no GLB. Files: {archive.namelist()}")
        # Prefer the unified avatar GLB if the archive contains more than one.
        candidates.sort(key=lambda n: ("avatar" not in Path(n).stem.lower(), len(n)))
        glb = archive.read(candidates[0])

    if glb[:4] != b"glTF":
        fail("Downloaded avatar is not a valid GLB (missing glTF magic header)")
    return glb


def main() -> int:
    print("Starting AvatarSDK production generation for Neeraj...")
    token = auth_token()
    player = create_player(token)
    print(f"Created AvatarSDK Player: {player}")

    avatar = create_avatar(token, player)
    print(f"Created AvatarSDK avatar task: {avatar.get('code')}")
    avatar = poll_avatar(token, player, avatar)
    export = poll_export(token, player, avatar)
    print(f"Completed AvatarSDK export: {export.get('code')}")

    glb = download_glb(token, player, export)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(glb)
    print(f"Wrote production GLB: {OUTPUT} ({len(glb):,} bytes)")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
