"""
SSH Bridge — manages SSH connections to the Freenove FNK0054 board
and executes remote commands / scripts.
"""
import asyncio
import logging
from typing import Optional

import paramiko

import config

logger = logging.getLogger(__name__)


class SSHBridge:
    """Persistent SSH connection to the target board."""

    def __init__(self) -> None:
        self._client: Optional[paramiko.SSHClient] = None
        self._lock = asyncio.Lock()

    @property
    def connected(self) -> bool:
        if self._client is None:
            return False
        transport = self._client.get_transport()
        return transport is not None and transport.is_active()

    async def connect(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        key_file: Optional[str] = None,
    ) -> dict:
        """Open an SSH connexion to the board."""
        async with self._lock:
            if self.connected:
                return {"status": "already_connected", "host": config.SSH_HOST}

            host = host or config.SSH_HOST
            port = port or config.SSH_PORT
            user = user or config.SSH_USER
            password = password or config.SSH_PASSWORD or None
            key_file = key_file or config.SSH_KEY_FILE or None

            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            loop = asyncio.get_running_loop()
            connect_kwargs: dict = {
                "hostname": host,
                "port": port,
                "username": user,
                "timeout": 10,
                "allow_agent": False,
                "look_for_keys": False,
            }
            if key_file:
                connect_kwargs["key_filename"] = key_file
            elif password:
                connect_kwargs["password"] = password

            await loop.run_in_executor(None, lambda: client.connect(**connect_kwargs))
            self._client = client
            logger.info("SSH connected to %s@%s:%d", user, host, port)
            return {"status": "connected", "host": host}

    async def disconnect(self) -> dict:
        async with self._lock:
            if self._client:
                self._client.close()
                self._client = None
                logger.info("SSH disconnected")
            return {"status": "disconnected"}

    async def run(self, command: str, timeout: int = 30) -> dict:
        """Execute a single command on the board and return output."""
        if not self.connected:
            return {"error": "not_connected"}

        loop = asyncio.get_running_loop()

        def _exec():
            stdin, stdout, stderr = self._client.exec_command(
                command, timeout=timeout
            )
            out = stdout.read().decode(errors="replace")
            err = stderr.read().decode(errors="replace")
            rc = stdout.channel.recv_exit_status()
            return out, err, rc

        out, err, rc = await loop.run_in_executor(None, _exec)
        return {"stdout": out, "stderr": err, "returncode": rc}

    async def run_script(self, script_name: str, args: str = "") -> dict:
        """Execute a board-side script from BOARD_SCRIPTS_DIR."""
        path = f"{config.BOARD_SCRIPTS_DIR}/{script_name}"
        cmd = f"python3 {path} {args}"
        return await self.run(cmd)
