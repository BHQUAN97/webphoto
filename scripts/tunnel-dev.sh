#!/bin/bash
# ============================================
# Cloudflare Named Tunnel — bhquan.site
# Tunnel ID: cdefa36f-12d5-4304-8c81-e3d196f4bb23
# ============================================

echo "=========================================="
echo "  Cloudflare Tunnel - bhquan.site"
echo "=========================================="
echo ""
echo "  bhquan.site       -> localhost:3000"
echo "  api.bhquan.site   -> localhost:4000"
echo "  ws.bhquan.site    -> localhost:4001"
echo ""
echo "  Nhấn Ctrl+C để dừng tunnel."
echo ""

TUNNEL_TOKEN="eyJhIjoiNGQ0ZTBjZGU5ZGZjY2JhMjk0NmY1MjkzYzFlOTAwOTkiLCJ0IjoiY2RlZmEzNmYtMTJkNS00MzA0LThjODEtZTNkMTk2ZjRiYjIzIiwicyI6IlpEQm1PVFZtWW1JdFptSTBOaTAwTTJRMkxXSmlaVE10TldZNU5qTXlNelkwWVRGaCJ9"

cloudflared tunnel run --token "$TUNNEL_TOKEN"
