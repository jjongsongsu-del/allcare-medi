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

## 처방전 자체 OCR

외부 OCR API 대신 서버에서 PaddleOCR을 직접 실행하려면 선택 의존성을 설치하고 OCR provider를 `local`로 설정합니다.

```bash
pip install -r requirements-ocr.txt
```

```env
PRESCRIPTION_OCR_PROVIDER=local
PRESCRIPTION_OCR_MIN_CONFIDENCE=0.4
```

`POST /prescriptions/ocr`는 업로드 이미지를 임시 파일로 저장한 뒤 PaddleOCR로 인식하고, 처리 후 원본 임시 파일을 삭제합니다. OCR 결과는 자동 저장하지 않고 앱에서 사용자가 확인한 약 정보와 스케줄만 저장하는 흐름을 권장합니다.

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

`/api/migration/guest-data`는 `userId`가 전달되면 즐겨찾기, 최근 본 장소, 가족 프로필을 서버 테이블에 저장합니다.

가족관리 확장 모델은 `family_groups`, `family_members`, `health_profiles`, `family_permissions` 테이블을 기준으로 하며, 현재 화면은 MVP 호환을 위해 `family_profiles` API를 먼저 사용합니다.

## 역할

- 공공 API 키 보호와 응답 정규화
- 사용자, 가족, 복약 일정, 복약 이력 저장
- DUR, OCR, AI 식별 결과를 앱이 쓰기 쉬운 형태로 중계
- 병원·약국 정보 오류 신고를 `facility_reports` 테이블에 저장하고 관리자 검수로 연결
- 추후 푸시 알림 스케줄러와 리포트 생성 작업 연결
