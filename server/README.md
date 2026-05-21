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

## 역할

- 공공 API 키 보호와 응답 정규화
- 사용자, 가족, 복약 일정, 복약 이력 저장
- DUR, OCR, AI 식별 결과를 앱이 쓰기 쉬운 형태로 중계
- 병원·약국 정보 오류 신고를 `facility_reports` 테이블에 저장하고 관리자 검수로 연결
- 추후 푸시 알림 스케줄러와 리포트 생성 작업 연결
