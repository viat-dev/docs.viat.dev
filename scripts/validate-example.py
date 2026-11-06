"""Run an authored unit fixture with accidental network/process calls blocked.

This is a guard against mistakes in trusted repository tests, NOT a security
sandbox for hostile code. Real integration uses separate explicit acceptance.
"""
from pathlib import Path
import os
import runpy
import socket
import subprocess
import sys


def blocked(*args, **kwargs):
    raise RuntimeError("offline example validation may not use networking or spawn processes")


root = Path(__file__).resolve().parent.parent / "examples"
case = Path(sys.argv[1]).resolve()
if case.parent != root.resolve() or not (case / "validate.py").is_file():
    raise SystemExit("expected an immediate example directory with validate.py")

socket.create_connection = blocked
socket.getaddrinfo = blocked
socket.socket.connect = blocked
socket.socket.connect_ex = blocked
socket.socket.bind = blocked
socket.socket.sendto = blocked
subprocess.Popen = blocked
os.system = blocked
for name in ("execl", "execle", "execlp", "execlpe", "execv", "execve", "execvp", "execvpe", "fork", "posix_spawn", "posix_spawnp"):
    if hasattr(os, name):
        setattr(os, name, blocked)

sys.dont_write_bytecode = True
sys.argv = [str(case / "validate.py")]
os.chdir(case)
runpy.run_path(sys.argv[0], run_name="__main__")
