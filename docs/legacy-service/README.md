# Legacy Service Documentation Set

이 디렉토리는 현재 `AI_Game_legacy` 서비스의 기능, 화면, 구조, 정책을
신규 `AI_Game` 마이그레이션 기준선으로 고정하기 위한 문서 모음이다.

주의:
- 이 디렉토리의 문서는 레거시 기준선 보존용이다.
- 신규 구현 작업은 `AI_Game_Blind_Arena/docs/` 아래에 복사된 문서를 기준으로 진행한다.
- 레거시 문서는 신규 구현 진행 중 직접 수정 대상이 아니라, 기준선 확인용 참조 문서로 본다.

목적:
- 레거시 서비스의 실제 동작을 누락 없이 기록
- 신규 프런트/백엔드 재구축 시 기준 문서로 사용
- 정책, 예외 처리, 화면 흐름, 데이터 구조의 회귀 여부 검증

문서 목록:
- [01_PRD.md](./01_PRD.md)
- [02_FUNCTIONAL_SPEC.md](./02_FUNCTIONAL_SPEC.md)
- [03_IA.md](./03_IA.md)
- [04_SCREEN_SPEC.md](./04_SCREEN_SPEC.md)
- [05_DETAILED_DESIGN.md](./05_DETAILED_DESIGN.md)
- [06_RULES_AND_ENVIRONMENT.md](./06_RULES_AND_ENVIRONMENT.md)
- [07_WBS.md](./07_WBS.md)

함께 참고할 기준 문서:
- [LEGACY_SERVICE_SPEC.md](../../LEGACY_SERVICE_SPEC.md)
- [WORK_CHECKLIST.md](../../WORK_CHECKLIST.md)

활용 원칙:
1. 신규 구현은 이 문서 세트를 기준으로 화면/기능 parity를 맞춘다.
2. 정책 변경이 없는 한 레거시의 동작을 임의로 단순화하지 않는다.
3. 계정 시스템, 광고, 정책 보강처럼 신규 요구사항은 별도 변경점으로 기록한다.
4. 마이그레이션 단계마다 이 문서 세트와 실제 구현을 대조한다.
