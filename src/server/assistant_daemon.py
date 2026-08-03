#!/usr/bin/env python3
"""
ZereØ Assistant Manager Daemon (src/server/assistant_daemon.py)
Async Unix Socket Controller + Screen Sharing Telemetry & Touch Overlay Processor
"""
import asyncio
import os
import sys
import json
import time

SOCKET_PATH = "/tmp/assistant_mgr.sock"

class AssistantManagerDaemon:
    def __init__(self):
        self.start_time = time.time()
        self.screen_active = False
        self.screen_resolution = {"width": 1920, "height": 1080}
        self.fps = 30
        self.total_frames_processed = 0
        self.active_touches = []
        self.gestures_logged = []
        self.annotations = []
        self.overlay_config = {
            "mode": "tactical",
            "ripple_enabled": True,
            "pen_color": "#f59e0b",
            "pen_width": 4,
            "opacity": 0.85,
            "ai_auto_scan": False
        }

    async def handle_client(self, reader, writer):
        """Processes IPC command requests over Unix Domain Socket."""
        data = await reader.read(8192)
        if not data:
            writer.close()
            return

        try:
            cmd = json.loads(data.decode('utf-8'))
            action = cmd.get("action")

            if action == "get_status":
                response = {
                    "status": "ok",
                    "uptime_seconds": round(time.time() - self.start_time, 2),
                    "screen_active": self.screen_active,
                    "screen_resolution": self.screen_resolution,
                    "fps": self.fps,
                    "total_frames": self.total_frames_processed,
                    "active_touch_count": len(self.active_touches),
                    "gestures_count": len(self.gestures_logged),
                    "annotations_count": len(self.annotations),
                    "overlay_config": self.overlay_config
                }

            elif action == "update_screen":
                self.screen_active = cmd.get("active", self.screen_active)
                if "width" in cmd and "height" in cmd:
                    self.screen_resolution = {"width": cmd["width"], "height": cmd["height"]}
                if "fps" in cmd:
                    self.fps = cmd["fps"]
                if cmd.get("increment_frame", False):
                    self.total_frames_processed += 1
                response = {"status": "ok", "message": "Screen state synchronized."}

            elif action == "record_touch":
                touch_data = cmd.get("touch", {})
                touch_entry = {
                    "id": touch_data.get("id", time.time()),
                    "x": touch_data.get("x", 0),
                    "y": touch_data.get("y", 0),
                    "type": touch_data.get("type", "pointerdown"),
                    "pressure": touch_data.get("pressure", 1.0),
                    "timestamp": time.time()
                }
                self.active_touches.append(touch_entry)
                # Keep active touches bounded
                if len(self.active_touches) > 50:
                    self.active_touches = self.active_touches[-50:]
                
                if "gesture" in touch_data:
                    self.gestures_logged.append({
                        "gesture": touch_data["gesture"],
                        "timestamp": time.time(),
                        "coords": {"x": touch_data.get("x", 0), "y": touch_data.get("y", 0)}
                    })
                    if len(self.gestures_logged) > 100:
                        self.gestures_logged = self.gestures_logged[-100:]

                response = {"status": "ok", "recorded": touch_entry}

            elif action == "add_annotation":
                annotation = cmd.get("annotation", {})
                self.annotations.append({
                    "id": annotation.get("id", str(time.time())),
                    "type": annotation.get("type", "path"),
                    "points": annotation.get("points", []),
                    "color": annotation.get("color", self.overlay_config["pen_color"]),
                    "timestamp": time.time()
                })
                response = {"status": "ok", "total_annotations": len(self.annotations)}

            elif action == "clear_annotations":
                self.annotations = []
                self.active_touches = []
                response = {"status": "ok", "message": "Touch annotations reset."}

            elif action == "set_overlay_config":
                new_cfg = cmd.get("config", {})
                self.overlay_config.update(new_cfg)
                response = {"status": "ok", "config": self.overlay_config}

            else:
                response = {"status": "error", "message": f"Unknown action: {action}"}

        except Exception as e:
            response = {"status": "error", "message": str(e)}

        writer.write(json.dumps(response).encode('utf-8'))
        await writer.drain()
        writer.close()

    async def run(self):
        if os.path.exists(SOCKET_PATH):
            os.unlink(SOCKET_PATH)

        server = await asyncio.start_unix_server(self.handle_client, path=SOCKET_PATH)
        os.chmod(SOCKET_PATH, 0o777)
        print(f"[ASSISTANT DAEMON] Socket online at {SOCKET_PATH}")
        await server.serve_forever()

if __name__ == "__main__":
    daemon = AssistantManagerDaemon()
    try:
        asyncio.run(daemon.run())
    except KeyboardInterrupt:
        print("\n[ASSISTANT DAEMON] Terminating cleanly...")
        if os.path.exists(SOCKET_PATH):
            os.unlink(SOCKET_PATH)
