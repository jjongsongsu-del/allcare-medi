# Oracle Cloud IP 배포 가이드

AllCareMedi 서버를 Oracle Cloud Compute VM에서 `http://131.186.26.5` IP로 서비스하는 구성입니다.

## 기본 전제

- 접속 계정: `opc`
- 서버 IP: `131.186.26.5`
- Runtime: Python venv + FastAPI + uvicorn
- Reverse proxy: Nginx
- DB MVP: SQLite (`/opt/allcare-medi-data/allcaremedi.db`)

## OCI 콘솔 준비

1. VCN/Subnet의 Security List 또는 NSG에서 인바운드 `80/tcp`를 허용합니다.
2. SSH `22/tcp`는 본인 IP만 허용하는 것을 권장합니다.
3. HTTPS는 도메인을 연결한 뒤 나중에 certbot 또는 OCI Load Balancer로 붙이면 됩니다.

## 빠른 설치

서버에 `opc`로 SSH 접속한 뒤 실행합니다.

```bash
sudo dnf install -y git
sudo mkdir -p /opt/allcare-medi
sudo chown -R opc:opc /opt/allcare-medi
git clone https://github.com/jjongsongsu-del/allcare-medi.git /opt/allcare-medi
sudo APP_USER=opc API_DOMAIN=131.186.26.5 bash /opt/allcare-medi/deploy/oci/setup_ubuntu.sh
```

Ubuntu 이미지에서 `opc` 계정을 쓰는 경우에도 같은 명령으로 동작합니다. 스크립트가 `apt-get`과 `dnf`를 자동 감지합니다.

## 환경 변수 설정

설치 후 서버 환경 파일을 수정합니다.

```bash
sudo nano /etc/allcaremedi/server.env
```

필수 값은 통합 인증키로 채웁니다.

```env
PUBLIC_DATA_SERVICE_KEY=통합_인증키
NMC_API_KEY=통합_인증키
EMERGENCY_API_KEY=통합_인증키
E_DRUG_API_KEY=통합_인증키
```

수정 후 재시작합니다.

```bash
sudo systemctl restart allcaremedi
```

## 동작 확인

```bash
curl http://127.0.0.1:8000/health
curl http://131.186.26.5/health
```

정상 응답 예시:

```json
{"status":"ok","db":"sqlite"}
```

## 운영 명령

```bash
sudo systemctl status allcaremedi
sudo journalctl -u allcaremedi -f
sudo systemctl restart allcaremedi
sudo nginx -t
sudo systemctl reload nginx
```

## 앱 서버 주소

모바일 앱은 빌드 또는 실행 전에 다음 값을 사용합니다.

```env
EXPO_PUBLIC_API_BASE_URL=http://131.186.26.5
```

## PostgreSQL 전환

나중에 PostgreSQL을 쓰려면 `/etc/allcaremedi/server.env`의 `DATABASE_URL`만 교체합니다.

```env
DATABASE_URL=postgresql+psycopg://allcare:password@db-host:5432/allcaremedi
```

그 다음 서버를 재시작합니다.

```bash
sudo systemctl restart allcaremedi
```
