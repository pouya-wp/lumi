#!/bin/sh
# Copies the shared web message catalogs into the Flutter app (single source of truth: apps/web/messages).
cd "$(dirname "$0")/.." && cp ../web/messages/fa.json ../web/messages/en.json assets/i18n/
