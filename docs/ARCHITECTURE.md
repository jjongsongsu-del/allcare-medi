# 올케어메디 개발 아키텍처

## 1. 제품 방향

올케어메디는 공공 의료 데이터, AI 식별, 복약 관리, 응급 안내를 하나의 모바일 경험으로 묶는 통합 헬스케어 앱입니다.

핵심 설계 원칙은 다음과 같습니다.

- 신뢰성: 공공 데이터 출처와 갱신 시각을 사용자에게 명확히 표시합니다.
- 편의성: 검색, 촬영, 위치 기반 탐색을 첫 화면에서 바로 시작합니다.
- 포용성: KRDS 기준의 대비, 글자 크기, 명확한 액션 버튼, 고령층 친화 흐름을 기본값으로 둡니다.
- 안전성: AI 결과는 의료 판단이 아닌 안내로 표현하고, 응급 가능성은 119/응급실 연결을 우선합니다.

## 2. 클라이언트 구조

기술 스택은 Expo + React Native + TypeScript + Expo Router입니다.

```text
app/
  _layout.tsx                 앱 공통 Provider와 라우팅
  index.tsx                   스플래시/온보딩 진입
  (tabs)/                     주요 탭 화면
src/
  components/                 KRDS 스타일 공통 컴포넌트
  features/                   도메인별 화면과 상태
  services/                   외부 API, AI, OCR, 알림 어댑터
  theme/                      색상, 간격, 타이포, 접근성 토큰
  types/                      공통 타입
```

## 3. 도메인 모듈

### AI 알약 식별

- 화면: 카메라 촬영, 이미지 선택, 식별 결과 상세, 복약 등록 연결
- 서비스: `pillRecognitionService`
- 향후 구현: 온디바이스 모델 또는 서버 추론 API, AI-Hub 학습 데이터 기반 모델 배포

### 병·의원 및 약국 찾기

- 화면: 상황 검색, 빠른 필터 칩, 지도/목록 전환, 마커 Bottom Sheet 상세, 최근 본 장소, 즐겨찾기
- 서비스: `medicalFacilityService`, 서버 `/facilities/search`
- 향후 구현: 국립중앙의료원 API, Kakao/Naver 지도 길찾기 딥링크, 정보 오류 신고 검수 흐름

### 건강백과

- 화면: 신체계통별, 생애주기별, 카드뉴스/이달의 건강정보
- 서비스: `healthContentService`
- 향후 구현: 국가건강정보포털 데이터 동기화와 개인화 추천

### 스마트 복약 관리

- 화면: 약 등록, 복약 일정, 알림, 가족 공유, 복약 리포트
- 서비스: `medicationService`, `notificationService`
- 향후 구현: e약은 API, 처방전 OCR, DUR 병용금기/중복성분 검사

### 응급실 안내

- 화면: 주변 응급실, 실시간 수용 현황, 응급 특화 필터, 보호자 공유
- 서비스: `emergencyService`
- 향후 구현: 응급의료포털 API, 119 연결, 위치 공유

## 4. 백엔드 권장 아키텍처

MVP 초기에는 모바일 앱에서 BFF(Backend for Frontend)를 호출하고, BFF가 공공 API와 AI 추론 서버를 중계하는 구성을 권장합니다.

```text
Mobile App
  -> BFF API
    -> Public API Adapters
    -> AI Inference API
    -> OCR Pipeline
    -> Notification Scheduler
    -> User/Family/Medication DB
```

현재 서버 골격은 `server/`에 FastAPI + SQLAlchemy로 구성합니다. 개발 기본값은 SQLite이며, 운영 또는 공동 개발 환경에서는 PostgreSQL로 전환합니다.

- BFF: FastAPI
- AI 추론: Python FastAPI + TorchServe/ONNX Runtime
- DB: SQLite(MVP 로컬 개발), PostgreSQL + PostGIS(운영/위치 검색 고도화), Redis(캐시/알림 큐)
- 파일: S3 호환 스토리지
- 알림: Expo Push Notification, 추후 FCM/APNs 직접 연동
- 인증: 휴대폰 본인인증 또는 OAuth, 가족 초대 토큰

## 7. API 관리

서버는 `doc/api`의 가이드 문서를 기준으로 공공 API 레지스트리를 관리합니다.

- `GET /admin/apis`: 국립중앙의료원 병의원/약국/응급, 질병관리청 건강정보 등 앱 사용 API 목록
- `GET /admin/apis/{endpoint_id}/test`: 인증키 설정과 엔드포인트 상태 점검
- `GET /facilities/search`: 앱의 약국병원 화면에서 사용하는 병원·약국 통합 검색 프록시

통합 인증키는 `server/.env`의 `PUBLIC_DATA_SERVICE_KEY`에만 저장하고, 앱 번들에는 포함하지 않습니다.

## 5. 데이터와 보안

- 건강/복약 데이터는 민감정보로 분류하고 저장 전 암호화 정책을 둡니다.
- 위치 정보는 기능 수행에 필요한 순간에만 사용하고, 가족 공유는 명시적 동의가 필요합니다.
- AI 식별 결과에는 신뢰도와 “최종 확인 필요” 문구를 함께 제공합니다.
- API 키는 앱에 직접 포함하지 않고 BFF 서버 환경변수로 관리합니다.

## 6. MVP 개발 순서

1. 앱 셸: 탭 구조, KRDS 테마, 접근성 설정, 통합 검색
2. 목 데이터 기반 주요 화면: 알약, 병원/약국, 건강백과, 복약, 응급실
3. 위치 권한, 카메라 권한, 알림 권한 연결
4. BFF 서버와 공공 API 어댑터 연결
5. OCR/AI 식별 파이프라인 연결
6. 가족 공유, DUR 검사, 복약 리포트 고도화
