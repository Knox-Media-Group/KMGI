"""Setup script for KMGI Radio Music Automation System"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="kmgi-radio-automation",
    version="1.0.0",
    author="Knox Media Group Inc.",
    author_email="tech@knoxmediagroup.com",
    description="Radio music automation system with OP-X integration",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Knox-Media-Group/KMGI",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Telecommunications Industry",
        "License :: Other/Proprietary License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Multimedia :: Sound/Audio",
    ],
    python_requires=">=3.9",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "kmgi=src.main:cli",
        ],
    },
    include_package_data=True,
    package_data={
        "src.web": ["templates/*.html", "static/css/*.css", "static/js/*.js"],
    },
)
