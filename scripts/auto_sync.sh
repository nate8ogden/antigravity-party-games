#!/bin/bash
# Auto-sync watcher for Antigravity Party Games
# Runs periodically, checks for file changes, verifies build integrity, and pushes to GitHub.

REPO_DIR="/Users/elizabethyrose/Downloads/Antigravity 2 Player games"
cd "$REPO_DIR" || exit 1

echo "Auto-sync watcher started for Antigravity Party Games..."

while true; do
  sleep 120

  # Check if there are unstaged or uncommitted changes
  CHANGES=$(git status --porcelain)

  if [ -n "$CHANGES" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Changes detected! Verifying build before pushing..."

    # Test if project builds cleanly
    if npm run build > /dev/null 2>&1; then
      git add .
      # Capture summary of modified game files or generic message
      SUMMARY=$(git diff --name-only --cached | tr '\n' ', ' | sed 's/, $//')
      git commit -m "Auto-sync: updated $SUMMARY"
      
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pushing to GitHub..."
      if git push origin main; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Successfully synced and pushed to GitHub!"
      else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Push failed, will retry next cycle."
      fi
    else
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Build failed or in-progress. Waiting for code to stabilize..."
    fi
  fi
done
