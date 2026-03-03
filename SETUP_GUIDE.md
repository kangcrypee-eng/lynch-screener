# 🦁 Lynch Screener — Mac 설치 가이드 (A to Z)

터미널에서 순서대로 복붙하세요.

---

## 🔧 사전 준비 확인 (5분)

### 1. Homebrew

```bash
brew --version
```

없으면:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Node.js (v18 이상)

```bash
node --version
```

없으면:
```bash
brew install node
```

### 3. Git

```bash
git --version
```

없으면:
```bash
brew install git
```

### 4. 계정

- **GitHub**: https://github.com 가입
- **Cloudflare**: https://dash.cloudflare.com 무료 가입

---

## 📁 Step 1: 프로젝트 준비 (2분)

다운로드 받은 `lynch-screener` 폴더를 홈 디렉토리에 놓고:

```bash
cd ~/lynch-screener
ls
```

아래 파일들이 보여야 합니다:

```
.env.example
.github/
.gitignore
README.md
SETUP_GUIDE.md
index.html
package.json
src/
vite.config.js
worker/
```

---

## ☁️ Step 2: Cloudflare Worker 배포 (10분)

### 2-1. Wrangler 설치 & 로그인

```bash
npm install -g wrangler
wrangler login
```

→ 브라우저가 열립니다 → Cloudflare 로그인 → "Allow" 클릭
→ 터미널에 `Successfully logged in` 뜨면 OK

### 2-2. KV 네임스페이스 생성

```bash
cd ~/lynch-screener/worker
wrangler kv namespace create LYNCH_DATA
```

결과 예시:
```
✨ Success!
Add the following to your configuration file:
{ binding = "LYNCH_DATA", id = "abc123def456..." }
```

⚠️ **`id = "abc123..."` 부분을 복사하세요!**

### 2-3. wrangler.toml 수정

VSCode로 `worker/wrangler.toml`을 열고 id를 교체:

```toml
[[kv_namespaces]]
binding = "LYNCH_DATA"
id = "abc123def456..."  ← 여기에 복사한 ID 붙여넣기
```

Cmd+S로 저장.

### 2-4. CORS 설정

VSCode로 `worker/index.js`를 열고 맨 위:

```javascript
const ALLOWED_ORIGINS = [
  'https://YOUR_GITHUB_USERNAME.github.io',  ← 본인 유저네임으로 변경
  'http://localhost:5173',
  'http://localhost:3000',
];
```

Cmd+S로 저장.

### 2-5. Worker 배포

```bash
wrangler deploy
```

성공 시:
```
Published lynch-screener-api (1.23 sec)
  https://lynch-screener-api.xxxx.workers.dev
```

⚠️ **이 URL을 복사해 두세요!**

### 2-6. 배포 확인

브라우저에서 위 URL 접속 → `{"status":"ok"}` 나오면 성공!

---

## 💻 Step 3: 프론트엔드 로컬 테스트 (5분)

### 3-1. 패키지 설치

```bash
cd ~/lynch-screener
npm install
```

### 3-2. 환경변수 설정

```bash
cp .env.example .env
```

VSCode로 `.env` 파일을 열고:

```
VITE_API_URL=https://lynch-screener-api.xxxx.workers.dev
```

→ Step 2-5에서 복사한 URL을 붙여넣기 → Cmd+S 저장

### 3-3. 개발 서버 실행

```bash
npm run dev
```

### 3-4. 브라우저 확인

http://localhost:5173/lynch-screener/ 접속

🦁 화면이 나오면 → "🔍 스크리닝" 클릭 → 종목이 나오는지 확인

확인 후 터미널에서 Ctrl+C로 서버 중지.

---

## 🚀 Step 4: GitHub Pages 배포 (10분)

### 4-1. GitHub 레포 생성

1. https://github.com/new 접속
2. Repository name: `lynch-screener`
3. Public 선택
4. ⚠️ "Add a README file" 체크 해제!
5. "Create repository" 클릭

### 4-2. 코드 Push

```bash
cd ~/lynch-screener

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/lynch-screener.git
git push -u origin main
```

⚠️ `YOUR_USERNAME`을 본인 유저네임으로 변경!

### 4-3. GitHub Secret 추가

1. GitHub 레포 페이지 → **Settings** 탭
2. 왼쪽 메뉴 **Secrets and variables** → **Actions**
3. **"New repository secret"** 클릭
4. Name: `VITE_API_URL`
5. Secret: Worker URL (예: `https://lynch-screener-api.xxxx.workers.dev`)
6. **"Add secret"** 클릭

### 4-4. GitHub Pages 활성화

1. GitHub 레포 → **Settings** 탭
2. 왼쪽 메뉴 **Pages**
3. Source → **GitHub Actions** 선택

### 4-5. 배포 확인

1. GitHub 레포 → **Actions** 탭
2. 워크플로우가 실행중 → 초록 ✅ 뜨면 완료!

### 4-6. 접속!

```
https://YOUR_USERNAME.github.io/lynch-screener/
```

🎉 끝!

---

## ✅ 동작 확인 체크리스트

- [ ] 🔍 스크리너: "스크리닝" 버튼 → 종목 나옴
- [ ] 🔍 개별분석: "NVDA" 입력 → 결과 나옴
- [ ] 🔍 "💾 저장" → 스냅샷 저장
- [ ] 💼 포트폴리오: 종목 카드 → "매수 기록" → 수량 입력
- [ ] 📈 히스토리: 저장한 스냅샷 보임
- [ ] 🚨 매도시그널: 보유종목 경고 확인

---

## 📅 매주 사용법

1. Cron이 매주 일요일 자동 실행 (한국 월요일 새벽 6시)
2. 앱 접속 → 스크리너에서 결과 확인
3. 신규 진입 종목(🆕) 중 10개 선별 → 매수 기록
4. 🚨 매도시그널 확인 → 경고 종목 판단
5. 📈 히스토리에서 추이 검토

---

## 🆘 문제 해결

| 문제 | 해결 |
|------|------|
| `npm: command not found` | `brew install node` |
| `wrangler: command not found` | `npm install -g wrangler` |
| Worker 배포 에러 | `wrangler login` 다시 실행 |
| KV 에러 | `wrangler.toml`의 id 확인 |
| 스크리닝 에러 | `.env`의 Worker URL 확인 |
| CORS 에러 | `worker/index.js` ALLOWED_ORIGINS 확인 후 `wrangler deploy` |
| GitHub Pages 안됨 | Settings → Pages → Source: GitHub Actions 확인 |
| Actions 실패 | Secrets에 VITE_API_URL 설정 확인 |

---

## 코드 수정 후 재배포

프론트엔드 수정 시:
```bash
cd ~/lynch-screener
git add . && git commit -m "update" && git push
```

Worker 수정 시:
```bash
cd ~/lynch-screener/worker
wrangler deploy
```
