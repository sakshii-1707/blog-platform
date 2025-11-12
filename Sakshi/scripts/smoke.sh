#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:8080/api/v1}"

echo "Health:"
curl -sS http://localhost:8080/health | jq .

EMAIL="user$(date +%s)@test.com"
PASS="password123"
NAME="Test User"

echo "Register:"
REG=$(curl -sS -X POST "$API/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"$NAME\"}")
echo "$REG" | jq .
TOKEN=$(echo "$REG" | jq -r .token)

echo "Create post:"
POST=$(curl -sS -X POST "$API/posts" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"Hello","content":"World"}')
echo "$POST" | jq .
POST_ID=$(echo "$POST" | jq -r .id)

echo "List posts:"
curl -sS "$API/posts" | jq .

echo "Add comment:"
curl -sS -X POST "$API/comments" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"postId\":\"$POST_ID\",\"content\":\"Nice!\"}" | jq .

echo "List comments:"
curl -sS "$API/comments?postId=$POST_ID" | jq .

echo "Done."


