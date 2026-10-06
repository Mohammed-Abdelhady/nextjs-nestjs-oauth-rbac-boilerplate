#!/bin/sh
if ! command -v "$1" >/dev/null 2>&1; then
  printf '%s is required for Git hooks. Install it and ensure it is on PATH.\n' "$1" >&2
  exit 1
fi
