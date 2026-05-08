# New System Documentation Set

이 디렉토리는 신규 `AI_Game` 시스템의 목표 구조와 구현 규칙을 정의한다.

역할:
- 레거시 서비스 문서를 기준선으로 삼아 신규 시스템의 설계 방향을 고정
- React + TypeScript + Vite + Tailwind 기반 재구축 시 누락과 재작업을 줄임
- 계정 시스템, 둘러보기, 정책 페이지, 광고 준비까지 고려한 목표 구조를 정함

선행 기준 문서:
- [Legacy README](../legacy-service/README.md)
- [Legacy Service Spec](../../LEGACY_SERVICE_SPEC.md)
- [Checklist](../../WORK_CHECKLIST.md)

문서 목록:
- [01_TARGET_ARCHITECTURE.md](./01_TARGET_ARCHITECTURE.md)
- [02_FRONTEND_STRUCTURE.md](./02_FRONTEND_STRUCTURE.md)
- [03_STYLE_SYSTEM.md](./03_STYLE_SYSTEM.md)
- [04_MIGRATION_EXECUTION_PLAN.md](./04_MIGRATION_EXECUTION_PLAN.md)

사용 원칙:
1. 레거시 parity가 우선이다.
2. 신규 구조는 계정/게스트/관리자 분기를 전제로 설계한다.
3. 스타일은 Tailwind utility 남용이 아니라 토큰 + 공통 컴포넌트 중심으로 운영한다.
4. API 계약은 1차 마이그레이션 동안 최대한 유지한다.
