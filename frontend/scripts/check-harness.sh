#!/usr/bin/env bash
# 하네스 무결성 검사: 미러 동기화, JSON 유효성, 스킬 잠금, 토큰 산출물 최신 여부
set -u
cd "$(dirname "$0")/.."
fail=0

echo "▶ .agents/rules ↔ .claude/rules"
if diff -r .agents/rules .claude/rules >/dev/null; then echo "  OK"; else echo "  FAIL: 미러 불일치 (pnpm harness:sync)"; diff -rq .agents/rules .claude/rules; fail=1; fi

echo "▶ .agents/skills ↔ .claude/skills"
if diff -r .agents/skills .claude/skills >/dev/null; then echo "  OK"; else echo "  FAIL: 미러 불일치 (pnpm harness:sync)"; diff -rq .agents/skills .claude/skills | head -20; fail=1; fi

echo "▶ design/*.json 파싱"
for f in design/tokens.json design/design-map.json; do
  if node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" 2>/dev/null; then echo "  OK $f"; else echo "  FAIL: $f 파싱 오류"; fail=1; fi
done

echo "▶ design.pen ↔ tokens.json (Pencil 변수가 원천)"
if node scripts/sync-pen-tokens.cjs --check; then :; else fail=1; fi

echo "▶ skills-lock.json 이 모든 스킬을 추적하는지"
for d in .agents/skills/*/; do
  name=$(basename "$d")
  if node -e "const l=require('./skills-lock.json'); process.exit(l.skills['$name']?0:1)"; then echo "  OK $name"; else echo "  FAIL: skills-lock.json 에 $name 없음"; fail=1; fi
done

echo "▶ 토큰 산출물 최신 여부"
if node scripts/sync-tokens.cjs --check; then :; else fail=1; fi

echo "▶ 규칙 파일 frontmatter(paths)"
for f in .agents/rules/*.md; do
  if head -1 "$f" | grep -q '^---$' && grep -q '^paths:' "$f"; then :; else echo "  FAIL: $f 에 paths frontmatter 없음"; fail=1; fi
done
[ $fail -eq 0 ] && echo "  OK"

if [ $fail -ne 0 ]; then echo; echo "하네스 검사 실패"; exit 1; fi
echo; echo "하네스 검사 통과"
