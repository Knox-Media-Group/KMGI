#!/usr/bin/env python3
"""
Deploy roku_feed.json to GitHub Pages (gh-pages branch).

After running a sync, this script pushes the feed file to the gh-pages
branch so it's accessible at:
  https://knox-media-group.github.io/KMGI/roku_feed.json

Usage:
  python3 scripts/deploy_feed.py
  python3 scripts/deploy_feed.py --feed-path ./roku_feed.json
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def run(cmd, **kwargs):
    """Run a shell command and return output."""
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, **kwargs
    )
    if result.returncode != 0:
        print(f"Command failed: {cmd}")
        print(f"stderr: {result.stderr}")
    return result


def deploy_to_gh_pages(feed_path: str, repo_dir: str = None):
    """Deploy feed file to gh-pages branch."""
    repo_dir = repo_dir or os.getcwd()
    feed_file = Path(feed_path)

    if not feed_file.exists():
        print(f"Error: Feed file not found: {feed_path}")
        print("Run a sync first: python3 -m vimeo_roku_sdk.cli sync --config config.yaml")
        sys.exit(1)

    feed_size = feed_file.stat().st_size
    print(f"Deploying feed to GitHub Pages...")
    print(f"  Feed file: {feed_path} ({feed_size / 1024:.1f} KB)")

    # Save current branch
    current_branch = run("git rev-parse --abbrev-ref HEAD", cwd=repo_dir).stdout.strip()

    # Create a temp directory for the gh-pages content
    with tempfile.TemporaryDirectory() as tmpdir:
        # Copy the feed file
        shutil.copy2(str(feed_file), os.path.join(tmpdir, "roku_feed.json"))

        # Create a simple index.html
        index_html = """<!DOCTYPE html>
<html>
<head>
    <title>Knox Media Group - Roku Feed</title>
    <style>
        body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        a { color: #0066cc; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
        .status { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Knox Media Group</h1>
    <h2>Roku Direct Publisher Feed</h2>
    <p class="status">Feed is live and updating daily.</p>
    <p><strong>Feed URL:</strong><br>
    <a href="roku_feed.json">https://knox-media-group.github.io/KMGI/roku_feed.json</a></p>
    <p>Use this URL in your Roku Direct Publisher channel configuration.</p>
</body>
</html>"""
        with open(os.path.join(tmpdir, "index.html"), "w") as f:
            f.write(index_html)

        # Add .nojekyll to prevent Jekyll processing
        Path(os.path.join(tmpdir, ".nojekyll")).touch()

        # Check if gh-pages branch exists
        check = run("git ls-remote --heads origin gh-pages", cwd=repo_dir)
        gh_pages_exists = "gh-pages" in check.stdout

        if gh_pages_exists:
            # Checkout existing gh-pages
            run("git fetch origin gh-pages", cwd=repo_dir)
            run("git checkout gh-pages", cwd=repo_dir)
        else:
            # Create orphan gh-pages branch
            run("git checkout --orphan gh-pages", cwd=repo_dir)
            run("git rm -rf .", cwd=repo_dir)

        # Copy files from temp dir to repo
        for filename in ["roku_feed.json", "index.html", ".nojekyll"]:
            src = os.path.join(tmpdir, filename)
            dst = os.path.join(repo_dir, filename)
            shutil.copy2(src, dst)

        # Commit and push
        run("git add roku_feed.json index.html .nojekyll", cwd=repo_dir)

        # Check if there are changes to commit
        status = run("git status --porcelain", cwd=repo_dir)
        if status.stdout.strip():
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            run(
                f'git commit -m "Update Roku feed - {timestamp}"',
                cwd=repo_dir
            )
            print("  Pushing to gh-pages branch...")

            # Push with retries
            for attempt in range(4):
                result = run("git push -u origin gh-pages", cwd=repo_dir)
                if result.returncode == 0:
                    break
                if attempt < 3:
                    import time
                    wait = 2 ** (attempt + 1)
                    print(f"  Push failed, retrying in {wait}s...")
                    time.sleep(wait)

            print("  Deployed successfully!")
        else:
            print("  No changes to deploy (feed unchanged)")

        # Switch back to original branch
        run(f"git checkout {current_branch}", cwd=repo_dir)

    print()
    print("Your feed is available at:")
    print("  https://knox-media-group.github.io/KMGI/roku_feed.json")
    print()
    print("Use this URL in your Roku Direct Publisher channel settings.")


def main():
    parser = argparse.ArgumentParser(
        description="Deploy Roku feed to GitHub Pages"
    )
    parser.add_argument(
        "--feed-path",
        default="./roku_feed.json",
        help="Path to the roku_feed.json file"
    )
    parser.add_argument(
        "--repo-dir",
        default=None,
        help="Path to the git repository"
    )

    args = parser.parse_args()
    deploy_to_gh_pages(args.feed_path, args.repo_dir)


if __name__ == "__main__":
    main()
