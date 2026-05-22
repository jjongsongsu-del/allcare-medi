# AllCareMedi BFF Server

모바일 앱과 공공 API/AI/OCR/DB를 연결하는 Backend for Frontend 서버 골격입니다.

## DB 선택

기본 개발 DB는 SQLite입니다.

```env
DATABASE_URL=sqlite:///./allcaremedi.db
```

운영 또는 공동 개발 환경에서는 PostgreSQL로 전환합니다.

```env
DATABASE_URL=postgresql+psycopg://allcare:password@localhost:5432/allcaremedi
```

## 실행

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

`.env`에는 공공데이터포털 통합 인증키를 `PUBLIC_DATA_SERVICE_KEY`로 저장합니다. 이 값은 모바일 앱에 포함하지 않고 서버에서만 사용합니다.

## API 관리

- `GET /admin/apis`: 앱에서 사용하는 공공 API 목록
- `GET /admin/apis/{endpoint_id}/test`: 인증키 설정 여부와 엔드포인트 상태 확인
- `GET /facilities/search?latitude=37.5665&longitude=126.978&type=pharmacy`: 병원·약국 검색 프록시

관리 대상 API는 `doc/api`의 가이드 문서를 기준으로 `app/public_api_registry.py`에 등록합니다.

## 인증 API

- `POST /api/auth/social-login`: Google/Kakao/Naver 소셜 토큰을 서버로 전달하고 서비스 토큰을 발급합니다.
- `POST /api/auth/refresh`: refresh token rotation으로 새 토큰을 발급합니다.
- `POST /api/auth/logout`: 현재 기기의 refresh token을 폐기합니다.
- `GET /api/family-profiles`: 회원 가족 프로필 목록
- `POST /api/family-profiles`: 회원 가족 프로필 생성
- `POST /api/migration/guest-data`: 비회원 로컬 데이터 병합 접수

## 역할

- 공공 API 키 보호와 응답 정규화
- 사용자, 가족, 복약 일정, 복약 이력 저장
- DUR, OCR, AI 식별 결과를 앱이 쓰기 쉬운 형태로 중계
- 병원·약국 정보 오류 신고를 `facility_reports` 테이블에 저장하고 관리자 검수로 연결
- 추후 푸시 알림 스케줄러와 리포트 생성 작업 연결
