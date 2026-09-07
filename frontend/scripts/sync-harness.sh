#!/usr/bin/env bash
# .agents/ (정본) → .claude/ (Claude Code 미러) 동기화
set -eu
cd "$(dirname "$0")/.."
mkdir -p .claude/rules .claude/skills
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete .agents/rules/ .claude/rules/
  rsync -a --delete .agents/skills/ .claude/skills/
else
  # Windows Git Bash 등 rsync가 없는 환경: node로 동일 동작(삭제 후 전체 복사)
  node -e "const fs=require('fs');for(const d of['rules','skills']){fs.rmSync('.claude/'+d,{recursive:true,force:true});fs.cpSync('.agents/'+d,'.claude/'+d,{recursive:true});}"
fi
echo "미러 동기화 완료: .claude/rules, .claude/skills"
