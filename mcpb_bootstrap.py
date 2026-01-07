"""
MCPB Bootstrap Script
=====================
Bootstrap script for MCPB package installation.
"""

import os
import sys
import subprocess
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Bootstrap the MCP server installation."""
    logger.info("Bootstrapping Sports Data MCP installation...")
    
    # Get the directory containing this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Install requirements
    requirements_path = os.path.join(script_dir, "requirements.txt")
    if os.path.exists(requirements_path):
        logger.info("Installing dependencies...")
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", "-r", requirements_path
            ])
            logger.info("Dependencies installed successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install dependencies: {e}")
            return 1
    
    logger.info("Bootstrap complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
