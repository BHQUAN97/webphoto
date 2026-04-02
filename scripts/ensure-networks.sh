#!/bin/bash
# Tao shared Docker networks truoc khi start bat ky project nao
# App nao start truoc cung duoc — networks luon ton tai
docker network create webphoto_backend 2>/dev/null && echo "[+] Created webphoto_backend" || echo "[=] webphoto_backend exists"
docker network create vietnet_frontend 2>/dev/null && echo "[+] Created vietnet_frontend" || echo "[=] vietnet_frontend exists"
