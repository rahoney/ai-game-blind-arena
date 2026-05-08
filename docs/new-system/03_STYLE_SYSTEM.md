# Style System Plan

## 1. 목표

Tailwind를 도입하되 유틸리티 난립을 막고 다음을 달성한다.

- 레거시 대비 더 안정적인 구조
- 빠른 화면 제작
- 테마 일관성 유지
- 마이페이지 전용 테마와 기본 테마의 명확한 분리
- 공통 컴포넌트 재사용성 확보

## 2. 스타일링 원칙

### 2.1 토큰 우선
- 하드코딩 색상 금지
- Tailwind config와 CSS variables로 토큰 정의

### 2.2 컴포넌트 우선
- 긴 class 문자열을 페이지마다 반복하지 않는다.
- 버튼, 카드, 모달, 탭, input은 공통 variant를 만든다.

### 2.3 테마 전환 가능성 확보
- 기본 테마와 mypage 테마를 명시적으로 나눈다.
- 광고/정책 페이지 확장에도 대응 가능하게 한다.

### 2.4 레거시 parity 유지
- 온보딩, 팝업, 결과 페이지, 마이페이지는 체감이 크게 달라지지 않아야 한다.

## 3. 테마 토큰

## 3.1 기본 테마

```text
background: #07090f
surface:    #0d1424
card:       #111e35
accent:     #3b82f6
border:     #1a304f
badgeText:  #93c5fd
text:       #dbeafe
mutedText:  #9fb3d9
success:    #22c55e
danger:     #ef4444
warning:    #f59e0b
overlay:    rgba(3, 7, 18, 0.72)
```

## 3.2 마이페이지 테마

```text
background: #050f10
surface:    #0d1f22
card:       #112a2d
accent:     #14b8a6
border:     #1b3d42
badgeText:  #5eead4
text:       #d5fffb
mutedText:  #9ad8d2
success:    #34d399
danger:     #f87171
warning:    #fbbf24
overlay:    rgba(2, 10, 11, 0.72)
```

## 4. Tailwind config 설계

정의할 항목:
- colors
- borderRadius
- boxShadow
- fontSize
- spacing
- maxWidth
- zIndex
- transitionTimingFunction

예시 규칙:
- `max-w-content`: 1200px
- `max-w-reading`: 980px
- `radius-card`: 20px
- `radius-modal`: 22px
- `shadow-panel`
- `shadow-floating`

## 5. CSS 변수 운영

Tailwind만으로 모든 걸 해결하지 않는다.

`src/shared/styles/theme.css`에 다음 변수를 둔다.
- `--bg`
- `--surface`
- `--card`
- `--accent`
- `--border`
- `--text`
- `--text-muted`
- `--badge-text`
- `--overlay`

body 또는 root attribute:
- `data-theme="default"`
- `data-theme="mypage"`

## 6. 레이아웃 규칙

### 6.1 페이지 컨테이너
- 기본 max width: `1200px`
- reading/policy page: `980px`
- section vertical gap: `24px`

### 6.2 카드
- background: `card`
- border: `border`
- radius: large
- padding: `20~24px`

### 6.3 표면 계층
- 페이지 배경
- 서피스 패널
- 카드
- elevated modal

레이어가 섞이지 않도록 역할을 고정한다.

## 7. 공통 컴포넌트 스타일 규칙

## 7.1 Button

variants:
- `primary`
- `secondary`
- `ghost`
- `danger`
- `link`

sizes:
- `sm`
- `md`
- `lg`

states:
- `default`
- `hover`
- `focus-visible`
- `disabled`
- `loading`

정책:
- CTA는 primary
- 되돌아가기/보조 액션은 secondary
- 결과 정렬/탭 계열은 ghost or segmented tab

## 7.2 Input

종류:
- text
- password
- textarea
- score control

규칙:
- placeholder는 본문보다 작게
- focus ring 명확히
- guest 제한 상태에서는 disabled UI를 명확히 구분

## 7.3 Card

variants:
- default
- highlighted
- interactive
- muted
- mypage

사용처:
- 모델 카드
- 코멘트 카드
- 통계 카드
- 배지 카드

## 7.4 Modal

종류:
- success
- info
- warning
- auth required
- admin password

규칙:
- 기본 alert 금지
- 타이포 중앙 정렬
- 아이콘 영역, 제목, 본문, 액션 영역 구조 고정

## 7.5 Badge/Chip

용도:
- 평가 여부
- 관리자 상태
- 정렬 상태
- 배지 이름 표시

규칙:
- 의미 있는 색으로만 사용
- decorative 용도는 최소화

## 8. 페이지별 스타일 가이드

### 8.1 온보딩
- 중앙 배치
- 세로 리듬 강조
- 슬라이드 애니메이션을 위한 overflow/height 구조 유지

### 8.2 게임 목록
- 타이틀 -> 설명문구 -> 모델 그리드 순서
- 모델 카드는 동일 높이 유지

### 8.3 플레이 화면
- 게임 뷰포트가 최우선
- 평가 그리드는 정렬 안정성이 중요
- 댓글 패널은 게임 영역보다 시각적으로 한 단계 아래

### 8.4 결과 화면
- 테이블과 댓글 섹션 분리
- 코멘트 카드 내 hierarchy 명확화
- 좋아요/싫어요 버튼은 shape 왜곡 없는 icon 사용

### 8.5 마이페이지
- 별도 테마
- 프로필 summary를 hero panel처럼 다룸
- 배지 컬렉션은 grid와 selection state가 명확해야 함

### 8.6 정책 페이지
- 읽기 중심 레이아웃
- section 간 분리감 확보
- 링크는 식별 가능해야 함

## 9. 타이포그래피 규칙

font strategy:
- 시스템 기본이 아니라 명확한 UI font와 heading font 분리 고려
- 다만 한글/영문 혼용 안정성이 최우선

권장 계층:
- `display`
- `page-title`
- `section-title`
- `card-title`
- `body`
- `body-small`
- `meta`

정책:
- 본문 minimum 16px
- 메타도 13px 이하로 과도하게 내리지 않음
- 푸터는 레거시보다 약간 큰 가독성 유지

## 10. 애니메이션 규칙

### 10.1 유지해야 할 애니메이션
- 온보딩 세로 슬라이드
- modal 등장
- sidebar 등장
- comments section 부분 갱신 시 과한 motion 없음

### 10.2 금지
- 전체 페이지 flash
- 댓글 액션마다 iframe remount
- 과한 scale bounce

### 10.3 timing
- onboarding: ~1.0s soft
- modal: 0.24~0.32s
- hover transition: 0.18~0.22s

## 11. Tailwind 사용 금지 사례

- 동일한 class 묶음을 3회 이상 반복
- 조건부 class가 복잡한데 component variant로 승격하지 않음
- 페이지마다 다른 max-width를 임의로 지정
- 상태별 색을 직접 하드코딩

## 12. 스타일 구현 우선순위

1. theme tokens
2. layout primitives
3. button/input/card/modal 공통 컴포넌트
4. page composition
5. legacy parity fine-tuning
