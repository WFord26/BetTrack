#!/usr/bin/env bash
# Apply .github/rulesets/main-protection.json to the repository.
# The JSON in git is the source of truth; this pushes it to GitHub.
#
#   ./scripts/apply-branch-protection.sh            # create or update
#   ./scripts/apply-branch-protection.sh --show     # print what is live now
#
# Requires: gh (authenticated with repo admin), jq.
set -euo pipefail
cd "$(dirname "$0")/.."

file=".github/rulesets/main-protection.json"
repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
name="$(jq -r .name "$file")"

id="$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name==\"$name\") | .id" | head -1)"

if [ "${1:-}" = "--show" ]; then
  if [ -z "$id" ]; then
    echo "No ruleset named \"$name\" on $repo."
    exit 1
  fi
  gh api "repos/$repo/rulesets/$id"
  exit 0
fi

if [ -n "$id" ]; then
  echo "Updating ruleset \"$name\" (id $id) on $repo..."
  gh api -X PUT "repos/$repo/rulesets/$id" --input "$file" >/dev/null
else
  echo "Creating ruleset \"$name\" on $repo..."
  gh api -X POST "repos/$repo/rulesets" --input "$file" >/dev/null
fi

echo "Done. Live rules:"
gh api "repos/$repo/rulesets" --jq ".[] | select(.name==\"$name\") | \"  \(.name): \(.enforcement)\""
