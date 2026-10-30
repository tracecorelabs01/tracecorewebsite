#!/bin/sh
# Updates Tracer from GitHub when discord-bot/ has changed, then restarts it. tracer-update.timer runs this every
# 5 minutes; run it as root to update straight away. Its log: journalctl -u tracer-update
set -eu
cd /opt/tracecore
git fetch -q origin main
if git diff --quiet HEAD origin/main -- discord-bot; then
  exit 0
fi
git merge -q --ff-only origin/main
cd discord-bot
.venv/bin/pip install -q --disable-pip-version-check -r requirements.txt
# A version that doesn't compile never replaces the running one.
if ! .venv/bin/python -m py_compile *.py cogs/*.py; then
  git -C /opt/tracecore reset -q --hard ORIG_HEAD
  echo "The new version doesn't compile, so Tracer keeps running the old one." >&2
  exit 1
fi
cp tracer.service tracer-update.service tracer-update.timer /etc/systemd/system/
systemctl daemon-reload
systemctl restart tracer
echo "Updated to $(git log -1 --format='%h %s')"
