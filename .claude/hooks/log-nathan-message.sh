#!/bin/bash
# Hook: UserPromptSubmit — auto-append every Nathan message to NATHAN_VERBATIM.md
set -e

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
PROJECT_DIR="c:/Apps/TGT"
TARGET="$PROJECT_DIR/docs/ai_context/NATHAN_VERBATIM.md"

# Skip empty prompts
if [ -z "$PROMPT" ]; then
  exit 0
fi

# Append with timestamp
{
  echo ""
  echo "> $(date '+%Y-%m-%d %H:%M') — \"$PROMPT\""
} >> "$TARGET"

exit 0
