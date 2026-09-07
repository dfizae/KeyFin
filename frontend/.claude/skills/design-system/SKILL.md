---
name: design-system
description: Token architecture reference (primitive→semantic→component), spacing/typography scales, component state specs. 이 프로젝트에서는 참조 문서로만 사용하며 실제 토큰 원천은 design/tokens.json, 생성은 scripts/sync-tokens.cjs다.
argument-hint: "[component or token]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# Design System

토큰 아키텍처와 컴포넌트 상태 명세의 참조 스킬. **이 프로젝트의 토큰 원천은 `design/tokens.json`이고 산출물은 `pnpm tokens:sync`가 생성한다.** 아래 CSS 변수 예시는 개념 설명용이며, RN에서는 생성된 NativeWind 테마(`tailwind.config.js`)와 `lib/theme.ts`를 사용한다. 원본의 슬라이드 생성 기능과 스크립트는 제거했다.

## When to Use

- Design token creation
- Component state definitions
- CSS variable systems
- Spacing/typography scales
- Design-to-code handoff
- Tailwind theme configuration

## Token Architecture

Load: `references/token-architecture.md`

### Three-Layer Structure

```
Primitive (raw values)
       ↓
Semantic (purpose aliases)
       ↓
Component (component-specific)
```

**Example:**
```css
/* Primitive */
--color-blue-600: #2563EB;

/* Semantic */
--color-primary: var(--color-blue-600);

/* Component */
--button-bg: var(--color-primary);
```

## References

| Topic | File |
|-------|------|
| Token Architecture | `references/token-architecture.md` |
| Primitive Tokens | `references/primitive-tokens.md` |
| Semantic Tokens | `references/semantic-tokens.md` |
| Component Tokens | `references/component-tokens.md` |
| Component Specs | `references/component-specs.md` |
| States & Variants | `references/states-and-variants.md` |
| Tailwind Integration | `references/tailwind-integration.md` |

## Component Spec Pattern

| Property | Default | Hover | Active | Disabled |
|----------|---------|-------|--------|----------|
| Background | primary | primary-dark | primary-darker | muted |
| Text | white | white | white | muted-fg |
| Border | none | none | none | muted-border |
| Shadow | sm | md | none | none |

## Best Practices

1. Never use raw hex in components - always reference tokens
2. Semantic layer enables theme switching (light/dark)
3. Component tokens enable per-component customization
4. Use HSL format for opacity control
5. Document every token's purpose
