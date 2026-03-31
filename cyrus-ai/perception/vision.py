"""
CYRUS Vision System — Object Detection + Tracking

Wraps an object detection model (YOLO v5/v8) with:
* confidence-threshold filtering
* simple IoU-based object tracker (no external tracker library required)
* graceful degradation when torch / cv2 / ultralytics are not installed
* camera frame capture with configurable source

Configuration (env vars)
------------------------
CYRUS_VISION_MODEL       → model identifier (default: yolov5s)
CYRUS_VISION_CONF        → detection confidence threshold (default: 0.45)
CYRUS_VISION_CAMERA      → camera device index or RTSP URL (default: 0)
CYRUS_VISION_SIMULATED   → true to force simulated mode (no camera/model)
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from dataclasses import dataclass, asdict
from typing import Any

logger = logging.getLogger(__name__)

_MODEL_ID: str    = os.getenv("CYRUS_VISION_MODEL", "yolov5s")
_CONF_THRESH: float = float(os.getenv("CYRUS_VISION_CONF", "0.45"))
_CAMERA_SRC: Any  = os.getenv("CYRUS_VISION_CAMERA", "0")
_SIMULATED: bool  = os.getenv("CYRUS_VISION_SIMULATED", "false").lower() == "true"

# Try to convert camera source to int (local device)
try:
    _CAMERA_SRC = int(_CAMERA_SRC)
except ValueError:
    pass   # keep as string (RTSP URL)

# ── Optional heavy imports ─────────────────────────────────────────────────────

try:
    if _SIMULATED:
        raise ImportError("simulated mode forced via CYRUS_VISION_SIMULATED=true")
    import cv2 as _cv2  # type: ignore[import]
    _CV2_AVAILABLE = True
except ImportError:
    _cv2 = None  # type: ignore[assignment]
    _CV2_AVAILABLE = False
    logger.info("[VisionSystem] OpenCV not available — frame capture disabled")

try:
    if _SIMULATED:
        raise ImportError("simulated mode")
    import torch as _torch  # type: ignore[import]
    _TORCH_AVAILABLE = True
except ImportError:
    _torch = None  # type: ignore[assignment]
    _TORCH_AVAILABLE = False
    logger.info("[VisionSystem] PyTorch not available — detection disabled")


# ── Data model ─────────────────────────────────────────────────────────────────

@dataclass
class Detection:
    track_id:   str
    label:      str
    confidence: float
    x1: float; y1: float; x2: float; y2: float   # bounding box pixels
    cx: float; cy: float                           # centre
    timestamp: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class TrackedObject:
    track_id:   str
    label:      str
    confidence: float
    position:   tuple[float, float]   # (cx, cy) pixels
    bbox:       tuple[float, float, float, float]  # (x1, y1, x2, y2)
    last_seen:  float = 0.0
    frames_seen: int  = 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "track_id":   self.track_id,
            "label":      self.label,
            "confidence": round(self.confidence, 3),
            "position":   self.position,
            "bbox":       self.bbox,
            "frames_seen": self.frames_seen,
        }


# ── Vision System ──────────────────────────────────────────────────────────────

class VisionSystem:
    """
    Camera-based object detection and multi-object tracking.

    Graceful degradation: if PyTorch or OpenCV are missing the system
    returns empty lists rather than crashing.

    Parameters
    ----------
    model_id    : YOLO model variant string (yolov5s, yolov5m, yolov8n …)
    conf_thresh : minimum detection confidence to keep (0.0 – 1.0)
    camera_src  : camera index (int) or RTSP URL (str)
    """

    def __init__(
        self,
        model_id: str = _MODEL_ID,
        conf_thresh: float = _CONF_THRESH,
        camera_src: Any = _CAMERA_SRC,
    ) -> None:
        self.model_id    = model_id
        self.conf_thresh = conf_thresh
        self.camera_src  = camera_src
        self._model: Any = None
        self._model_loaded = False
        self._tracks: dict[str, TrackedObject] = {}
        self._iou_threshold = 0.35

    # ── Model loading ──────────────────────────────────────────────────────────

    def load_model(self) -> bool:
        """
        Lazy-load the YOLO detection model.

        Returns True if the model is ready.  Does nothing if not available.
        """
        if self._model_loaded:
            return True
        if not _TORCH_AVAILABLE:
            logger.info("[Vision] PyTorch unavailable — running without detection")
            self._model_loaded = True
            return False

        try:
            # Try ultralytics (YOLOv8+) first, fall back to torch hub (YOLOv5)
            try:
                from ultralytics import YOLO  # type: ignore[import]  # noqa: PLC0415
                self._model = YOLO(f"{self.model_id}.pt")
                logger.info("[Vision] Ultralytics YOLO model loaded: %s", self.model_id)
            except ImportError:
                self._model = _torch.hub.load(
                    "ultralytics/yolov5", self.model_id, trust_repo=True
                )
                logger.info("[Vision] YOLOv5 torch.hub model loaded: %s", self.model_id)
            self._model_loaded = True
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("[Vision] model load failed (%s) — running without detection", exc)
            self._model_loaded = True
            return False

    # ── Frame capture ──────────────────────────────────────────────────────────

    def capture_frame(self, timeout_sec: float = 0.5) -> Any | None:
        """
        Capture a single frame from the camera.

        Returns
        -------
        numpy.ndarray | None
            BGR image array, or None if capture failed / OpenCV not available.
        """
        if not _CV2_AVAILABLE:
            return None
        try:
            cap = _cv2.VideoCapture(self.camera_src)
            cap.set(_cv2.CAP_PROP_BUFFERSIZE, 1)
            deadline = time.time() + timeout_sec
            ret, frame = False, None
            while time.time() < deadline:
                ret, frame = cap.read()
                if ret:
                    break
            cap.release()
            return frame if ret else None
        except Exception as exc:  # noqa: BLE001
            logger.debug("[Vision] capture error: %s", exc)
            return None

    # ── Detection ──────────────────────────────────────────────────────────────

    def detect(self, frame: Any) -> list[Detection]:
        """
        Run object detection on *frame*.

        Parameters
        ----------
        frame : numpy.ndarray (H×W×3 BGR)

        Returns
        -------
        list[Detection] above the confidence threshold.
        """
        if frame is None:
            return []

        if not self._model_loaded:
            self.load_model()

        if self._model is None:
            return []

        try:
            ts = time.time()
            results = self._model(frame)

            # Ultralytics v8+ result format
            if hasattr(results, "__iter__") and not hasattr(results, "pandas"):
                detections = self._parse_ultralytics(results, ts)
            else:
                # YOLOv5 torch.hub format
                detections = self._parse_yolov5(results, ts)

            return [d for d in detections if d.confidence >= self.conf_thresh]
        except Exception as exc:  # noqa: BLE001
            logger.debug("[Vision] detect error: %s", exc)
            return []

    def _parse_ultralytics(self, results: Any, ts: float) -> list[Detection]:
        """Parse Ultralytics YOLO v8+ result objects."""
        detections: list[Detection] = []
        for result in results:
            if not hasattr(result, "boxes") or result.boxes is None:
                continue
            for box in result.boxes:
                try:
                    x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    label = result.names.get(cls_id, str(cls_id))
                    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                    detections.append(Detection(
                        track_id=str(uuid.uuid4()),
                        label=label, confidence=conf,
                        x1=x1, y1=y1, x2=x2, y2=y2,
                        cx=cx, cy=cy, timestamp=ts,
                    ))
                except Exception:  # noqa: BLE001
                    continue
        return detections

    def _parse_yolov5(self, results: Any, ts: float) -> list[Detection]:
        """Parse YOLOv5 torch.hub Detections result."""
        try:
            rows = results.pandas().xyxy[0].to_dict(orient="records")
        except Exception:  # noqa: BLE001
            return []
        detections = []
        for r in rows:
            x1, y1 = float(r.get("xmin", 0)), float(r.get("ymin", 0))
            x2, y2 = float(r.get("xmax", 0)), float(r.get("ymax", 0))
            conf   = float(r.get("confidence", 0))
            label  = str(r.get("name", r.get("class", "unknown")))
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
            detections.append(Detection(
                track_id=str(uuid.uuid4()),
                label=label, confidence=conf,
                x1=x1, y1=y1, x2=x2, y2=y2,
                cx=cx, cy=cy, timestamp=ts,
            ))
        return detections

    # ── Tracking ───────────────────────────────────────────────────────────────

    def track(self, detections: list[Detection]) -> list[TrackedObject]:
        """
        Associate new detections with existing tracks using IoU matching.

        Simple greedy nearest-neighbour assignment — no Kalman filter.
        Returns the list of currently active TrackedObjects.

        Parameters
        ----------
        detections : detections from the current frame

        Returns
        -------
        list[TrackedObject]
        """
        now = time.time()
        matched_ids: set[str] = set()

        for det in detections:
            best_id, best_iou = None, self._iou_threshold
            for tid, obj in self._tracks.items():
                if tid in matched_ids:
                    continue
                if obj.label != det.label:
                    continue
                iou = _compute_iou(obj.bbox, (det.x1, det.y1, det.x2, det.y2))
                if iou > best_iou:
                    best_iou, best_id = iou, tid

            if best_id:
                obj = self._tracks[best_id]
                obj.confidence = det.confidence
                obj.position   = (det.cx, det.cy)
                obj.bbox       = (det.x1, det.y1, det.x2, det.y2)
                obj.last_seen  = now
                obj.frames_seen += 1
                matched_ids.add(best_id)
                det.track_id = best_id
            else:
                # New track
                det.track_id = str(uuid.uuid4())[:8]
                self._tracks[det.track_id] = TrackedObject(
                    track_id=det.track_id,
                    label=det.label,
                    confidence=det.confidence,
                    position=(det.cx, det.cy),
                    bbox=(det.x1, det.y1, det.x2, det.y2),
                    last_seen=now,
                )

        # Evict stale tracks (not seen for > 5 seconds)
        self._tracks = {
            tid: obj for tid, obj in self._tracks.items()
            if now - obj.last_seen < 5.0
        }

        return list(self._tracks.values())


# ── IoU helper ─────────────────────────────────────────────────────────────────

def _compute_iou(
    box_a: tuple[float, float, float, float],
    box_b: tuple[float, float, float, float],
) -> float:
    """Intersection-over-Union of two axis-aligned bounding boxes."""
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)

    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter == 0.0:
        return 0.0

    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union  = area_a + area_b - inter
    return inter / union if union > 0 else 0.0
