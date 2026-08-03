#!/usr/bin/env python3
"""
ZereØ Voice Modulation Daemon
Async Unix Socket Controller + Low Latency Audio Stream Interceptor
"""
import asyncio
import os
import sys
import json
import socket
import sounddevice as sd
import numpy as np
from dsp import VoiceDSP

SOCKET_PATH = "/tmp/voicemod.sock"
SAMPLE_RATE = 44100
BLOCK_SIZE = 1024

class VoiceDaemon:
    def __init__(self):
        self.dsp = VoiceDSP(sample_rate=SAMPLE_RATE, frame_size=BLOCK_SIZE)
        self.time_counter = 0.0
        self.running = False

    def audio_callback(self, indata, outdata, frames, time_info, status):
        """High-priority audio input/output stream callback."""
        if status:
            sys.stderr.write(f"[AUDIO WARN] {status}\n")
            
        # Convert mono/stereo input stream
        mono_input = indata[:, 0] if indata.ndim > 1 else indata
        
        # Execute DSP processing
        processed = self.dsp.process_frame(mono_input, self.time_counter)
        self.time_counter += frames

        # Map back to output channels
        if outdata.shape[1] > 1:
            outdata[:] = np.column_stack([processed] * outdata.shape[1])
        else:
            outdata[:, 0] = processed

    async def handle_client(self, reader, writer):
        """IPC socket command processor."""
        data = await reader.read(1024)
        if not data:
            writer.close()
            return

        try:
            cmd = json.loads(data.decode('utf-8'))
            action = cmd.get("action")

            if action == "set_params":
                self.dsp.set_parameters(
                    pitch=cmd.get("pitch"),
                    ring_mod=cmd.get("ring_mod"),
                    gain=cmd.get("gain")
                )
                response = {"status": "ok", "message": "DSP Parameters Updated."}
            elif action == "get_status":
                response = {
                    "status": "ok",
                    "pitch": self.dsp.pitch_shift,
                    "ring_mod": self.dsp.ring_mod_freq,
                    "gain": self.dsp.gain
                }
            else:
                response = {"status": "error", "message": "Unknown Command."}

        except Exception as e:
            response = {"status": "error", "message": str(e)}

        writer.write(json.dumps(response).encode('utf-8'))
        await writer.drain()
        writer.close()

    async def run(self):
        # Clean up existing socket if present
        if os.path.exists(SOCKET_PATH):
            os.unlink(SOCKET_PATH)

        # Start Unix domain socket server
        server = await asyncio.start_unix_server(self.handle_client, path=SOCKET_PATH)
        os.chmod(SOCKET_PATH, 0o777)
        print(f"[DAEMON] Control socket opened at {SOCKET_PATH}")

        # Start audio passthrough stream
        with sd.Stream(channels=1, samplerate=SAMPLE_RATE, blocksize=BLOCK_SIZE, callback=self.audio_callback):
            print(f"[DAEMON] Real-Time Voice Processing Active. Directing stream...")
            await server.serve_forever()

if __name__ == "__main__":
    daemon = VoiceDaemon()
    try:
        asyncio.run(daemon.run())
    except KeyboardInterrupt:
        print("\n[DAEMON] Terminating cleanly...")
        if os.path.exists(SOCKET_PATH):
            os.unlink(SOCKET_PATH)
