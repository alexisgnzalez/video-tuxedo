"""
Background task registry and lifecycle management for Tuxedo Editor.
Replaces one-off dictionary hacks with a unified, thread-safe task runner.
"""

from __future__ import annotations

import time
import uuid
from threading import Thread, Lock
from typing import Any, Callable, Dict, Optional


class Task:
    def __init__(self, task_id: str, kind: str, metadata: Optional[Dict[str, Any]] = None):
        self.task_id = task_id
        self.kind = kind
        self.status = "starting"  # starting | running | completed | cancelled | error
        self.percent = 0.0
        self.message = "Initializing..."
        self.metadata = metadata or {}
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.cancelled = False
        self.created_at = time.time()
        self.updated_at = time.time()

    def is_cancelled(self) -> bool:
        return self.cancelled

    def update(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
        self.updated_at = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "kind": self.kind,
            "status": self.status,
            "percent": round(self.percent, 1),
            "message": self.message,
            "result": self.result,
            "error": self.error,
            "cancelled": self.cancelled,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "elapsed_s": round(time.time() - self.created_at, 1),
            "metadata": self.metadata,
        }


class TaskRegistry:
    def __init__(self):
        self._tasks: Dict[str, Task] = {}
        self._lock = Lock()

    def start_task(
        self,
        kind: str,
        target_fn: Callable[[Task, Callable[[], bool], Callable[[float, str], None]], Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Task:
        """
        Starts a background thread for a long-running operation.
        target_fn signature: (task, is_cancelled, report_progress) -> result_dict
        """
        task_id = str(uuid.uuid4())[:8]
        task = Task(task_id=task_id, kind=kind, metadata=metadata)

        with self._lock:
            self._tasks[task_id] = task

        def _runner():
            def is_cancelled() -> bool:
                return task.cancelled

            def report_progress(percent: float, message: str = ""):
                task.update(
                    status="running",
                    percent=max(0.0, min(100.0, percent)),
                    message=message or task.message,
                )

            try:
                task.update(status="running", message="Running...")
                result = target_fn(task, is_cancelled, report_progress)
                if task.cancelled:
                    task.update(status="cancelled", message="Task cancelled by user.")
                else:
                    task.update(status="completed", percent=100.0, message="Completed.", result=result)
            except InterruptedError:
                task.update(status="cancelled", message="Task cancelled by user.")
            except Exception as e:
                import traceback
                traceback.print_exc()
                task.update(status="error", error=str(e), message=f"Failed: {e}")

        t = Thread(target=_runner, daemon=True)
        t.start()
        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        with self._lock:
            return self._tasks.get(task_id)

    def cancel_task(self, task_id: str) -> bool:
        with self._lock:
            task = self._tasks.get(task_id)
            if task and task.status in ("starting", "running"):
                task.cancelled = True
                task.update(status="cancelling", message="Cancelling...")
                return True
        return False


# Global singleton instance
tasks = TaskRegistry()
