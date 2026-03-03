# 🦁 Lynch Fast Growers Screener

피터 린치의 **고성장주 8가지 기준** 실시간 분석 + 주간 추적 + 포트폴리오 관리 + 매도 시그널

**Yahoo Finance · 무료 · API 키 불필요**

---

## 📊 기능 요약

### 🔍 스크리너
- 린치 8가지 기준 (100점 만점) 자동 스코어링
- 섹터별 필터, 정렬 (Score/PEG/EPS/기관보유율)
- 개별 티커 분석 기능
- 지난주 대비 신규 진입/퇴출 종목 표시

### 💼 포트폴리오 트래커
- 매수/매도 기록 관리
- 실시간 손익 계산
- 보유 종목별 현재 린치 스코어 업데이트

### 📈 주간 히스토리
- 매주 스냅샷 저장 (최대 52주)
- 종목별 스코어 추이 테이블
- 주간 Top 10 변동 기록

### 🚨 매도 시그널
린치 기준 매도 조건 자동 감지:
- 🔴 **매도**: PEG > 2.0 / EPS 음전환 / D/E > 1.5
- 🟡 **주의**: 3주 연속 스코어 하락 / 매출 역성장 / 내부자 순매도 / 기관 과밀

### ⏰ 주간 자동 실행 (Cron)
- 매주 일요일 09:00 UTC (한국 월요일 06:00)
- 자동으로 스크리닝 → 스냅샷 저장

---

## 🚀 셋업 가이드 (Mac + VSCode)

### Step 1: Cloudflare Workers + KV 설정 (10분)

```bash
# Wrangler 설치 & 로그인
npm install -g wrangler
wrangler login

# KV 네임스페이스 생성
cd worker
wrangler kv namespace create LYNCH_DATA
```

⬆️ 위 명령어 실행 후 나오는 `id`를 `wrangler.toml`에 입력:
```toml
[[kv_namespaces]]
binding = "LYNCH_DATA"
id = "여기에_복사한_ID"
```

`index.js`의 `ALLOWED_ORIGINS`에 본인 GitHub Pages URL 추가 후:
```bash
wrangler deploy
```

### Step 2: 프론트엔드 실행 (3분)

```bash
cd ..  # 프로젝트 루트
npm install
cp .env.example .env
```

`.env`에 Worker URL 입력:
```
VITE_API_URL=https://lynch-screener-api.YOUR_SUBDOMAIN.workers.dev
```

```bash
npm run dev
```

### Step 3: GitHub Pages 배포 (5분)

```bash
git init && git add . && git commit -m "init"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/lynch-screener.git
git push -u origin main
```

GitHub → Settings → Secrets → `VITE_API_URL` 추가
GitHub → Settings → Pages → Source: **GitHub Actions**

---

## 📅 주간 루틴

1. **일요일**: Cron이 자동으로 스크리닝 + 스냅샷 저장
2. **월요일**: 앱 접속 → 스크리너 탭에서 결과 확인
3. 신규 진입 종목 중 매수 대상 선별 → 매수 기록
4. 🚨 매도시그널 탭에서 경고 확인 → 판단
5. 히스토리 탭에서 스코어 추이 검토

---

## ⚠️ 참고

- Yahoo Finance는 비공식 API입니다
- 투자 권유가 아닌 참고 자료입니다
- Cloudflare Workers/KV 무료 플랜으로 충분합니다
