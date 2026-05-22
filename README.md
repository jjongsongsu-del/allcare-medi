# 올케어메디(AllCareMedi)

AI 기반 통합 헬스케어 플랫폼 모바일 앱 골격입니다.

## 실행

```bash
npm install
npm run start
```

## 주요 구조

- `app/`: Expo Router 화면 라우팅
- `src/features/`: 알약 식별, 병원/약국, 건강백과, 복약관리, 응급실 기능 모듈
- `src/services/`: AI-Hub, 국립중앙의료원, 국가건강정보포털, e약은, DUR 등 외부 연동 어댑터
- `src/theme/`: KRDS 기반 디자인 토큰과 접근성 설정
- `server/`: FastAPI 기반 BFF 서버와 SQLite/PostgreSQL DB 계층
- `docs/ARCHITECTURE.md`: 전체 개발 아키텍처

현재는 API 어댑터가 목 데이터로 동작하도록 분리되어 있으며, 실제 인증키와 엔드포인트가 확정되면 `src/services` 구현만 교체하면 됩니다.

## 서버 DB

서버는 기본적으로 SQLite를 사용합니다. 운영 환경 또는 다중 사용자 테스트에서는 `server/.env`의 `DATABASE_URL`을 PostgreSQL 주소로 바꾸면 됩니다.

## API 관리자

홈 화면의 `API 관리자`에서 서버가 관리하는 공공 API 목록을 확인할 수 있습니다. 서버는 `PUBLIC_DATA_SERVICE_KEY`를 이용해 공공데이터포털 API를 호출하고, 앱은 `/facilities/search`를 통해 병원·약국 검색 결과를 받습니다.

## 로그인 구조

앱 최초 실행 시 자동 로그인 세션이 없으면 SNS 로그인 또는 비회원 시작 화면을 보여줍니다.

- SNS 로그인: 서버 `/auth/social-login`에 로그인 정보를 저장하고 access token/refresh token을 발급합니다.
- 비회원 시작: `guest_id`를 기기 로컬에 저장하고 최근 본 장소, 즐겨찾기 같은 데이터를 기기 안에서만 관리합니다.
- 토큰 저장: refresh token은 `expo-secure-store` 기반 저장소를 사용합니다.
