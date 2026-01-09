"""
Sports Data MCP Setup
=====================
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="sports-data-mcp",
    version="0.1.0",
    author="Your Name",
    author_email="your.email@example.com",
    description="MCP server for sports data from The Odds API and ESPN API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/sports-odds-mcp",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.11",
    install_requires=[
        "mcp>=1.0.0",
        "aiohttp>=3.9.0",
        "aiofiles>=23.0.0",
        "python-dotenv>=1.0.0",
    ],
    entry_points={
        "console_scripts": [
            "sports-mcp=sports_mcp_server:main",
        ],
    },
)
