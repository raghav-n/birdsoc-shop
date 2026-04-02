import json
import mimetypes
import os

import yaml
from google import genai
from google.genai import types

_config_path = os.path.join(
    os.path.dirname(__file__), "..", "..", "config", "config.yaml"
)

# Padding factor: crop window is this many times larger than the bounding box.
# 1.5 = 50% breathing room around the subject.
_PADDING = 1.5


def _load_model():
    print("Loading Gemini model from config...")
    try:
        with open(_config_path) as f:
            cfg = yaml.safe_load(f)
        model = cfg.get("gemini", {}).get("model", "gemini-2.5-flash")
        print(f"Using Gemini model: {model}")
        return model
    except Exception:
        return "gemini-2.5-flash"


_SCHEMA = {
    "type": "object",
    "description": "Bounding box of the main subject in 0-1000 integer coordinates.",
    "properties": {
        "x_min": {"type": "integer", "description": "Left edge of subject, 0-1000"},
        "y_min": {"type": "integer", "description": "Top edge of subject, 0-1000"},
        "x_max": {"type": "integer", "description": "Right edge of subject, 0-1000"},
        "y_max": {"type": "integer", "description": "Bottom edge of subject, 0-1000"},
    },
    "required": ["x_min", "y_min", "x_max", "y_max"],
}

_PROMPT = (
    "Return the bounding box of the main subject in this product image. "
    "Use 0-1000 integer coordinates where (0, 0) is the top-left corner "
    "and (1000, 1000) is the bottom-right corner. "
    "Include the whole subject but exclude empty background. "
    "If there are multiple subjects, use the box that contains all of them."
)


def _bbox_to_crop(x_min, y_min, x_max, y_max):
    """
    Convert a bounding box (% of image dims) to focal point + zoom.

    Focal point = centre of bounding box.

    Zoom: the square crop window must contain the subject with padding.
    Both axes must fit, so the constraining axis is whichever requires less zoom.
    We take the minimum zoom so neither dimension is clipped.
        zoom = min(100 / (bbox_w * padding), 100 / (bbox_h * padding))
    clamped to [1.0, 3.0].
    """
    cx = (x_min + x_max) / 2.0
    cy = (y_min + y_max) / 2.0
    bbox_w = x_max - x_min
    bbox_h = y_max - y_min

    zooms = []
    if bbox_w > 0:
        zooms.append(100.0 / (bbox_w * _PADDING))
    if bbox_h > 0:
        zooms.append(100.0 / (bbox_h * _PADDING))
    zoom = min(zooms) if zooms else 1.0

    print(f"bbox: ({x_min:.1f}, {y_min:.1f}), ({x_max:.1f}, {y_max:.1f}) -> "
          f"focal: ({cx:.1f}, {cy:.1f}), zoom: {zoom:.2f}")

    return {
        "focal_point_x": max(0, min(100, round(cx))),
        "focal_point_y": max(0, min(100, round(cy))),
        "zoom_level": round(max(1.0, min(3.0, zoom)), 2),
    }


def suggest_crop(image_path: str) -> dict:
    """Call Gemini Vision to get the subject bounding box, derive focal point + zoom."""
    model = _load_model()
    api_key = os.environ.get("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    mime_type, _ = mimetypes.guess_type(image_path)
    if not mime_type or not mime_type.startswith("image/"):
        mime_type = "image/jpeg"

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            types.Part.from_text(text=_PROMPT),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=_SCHEMA,
            temperature=0,
        ),
    )

    data = json.loads(response.text)
    # Convert from 0-1000 native scale to 0-100 percentages
    return _bbox_to_crop(
        data["x_min"] / 10.0,
        data["y_min"] / 10.0,
        data["x_max"] / 10.0,
        data["y_max"] / 10.0,
    )
