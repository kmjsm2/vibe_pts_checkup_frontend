# ClinicalAI — Medical Imaging AI Assistant

영상의학 AI 보조 진단 플랫폼 | Lunit 포트폴리오 프로젝트

- Live Demo: https://vibe-pts-checkup-frontend-vxci.vercel.app
- Backend: https://vibe-pts-checkup-backend-1.onrender.com

---

## 프로젝트 개요

ClinicalAI는 의료 영상(X-ray, CT, MRI)을 업로드하면 Claude Vision AI가 구조화된 영상 소견을 생성하고, 시계열 영상을 비교해 병변 변화를 자동 분석하는 임상 보조 플랫폼입니다.

루닛이 추구하는 AI 기반 영상 판독 보조 비전에 맞춰, 실제 임상 워크플로우에 Vision LLM이 어떻게 통합될 수 있는지를 탐구하는 목적으로 개발하였습니다.

---

## 핵심 기능

### 1. 영상 업로드 및 AI 소견 생성

- X-ray / CT / MRI 이미지 업로드 (drag & drop 및 파일 선택)
- Claude Vision API 기반 구조화된 소견 자동 생성
  - Findings: 객관적 영상 소견
  - Impression: 판독 소견 및 의심 진단
  - Recommendation: 추가 검사 권고사항
  - Confidence Score: AI 신뢰도 (0~100%)
- 식약처 SaMD 가이드라인 준수 면책 문구 포함

### 2. Longitudinal 비교 분석

동일 환자의 시계열 영상 2개를 선택해 나란히 비교하고, 두 시점 소견의 변화를 Claude API가 자동 요약합니다.

- 호전 / 악화 / 유지 / 판단불가 상태 자동 분류
- 주요 변화 항목 구조화 출력
- 검증 케이스: Wilson's disease MRI (2013 vs 2016) — 병변 소실 및 호전 방향 정확 감지 (일치도 약 60-65%)

### 3. AI 임상 요약

환자 데이터 기반 구조화된 임상 요약을 자동 생성하며, 알레르기, 진단, 검진 이력 등 Key Concerns를 자동 태깅합니다.

### 4. 환자 관리

- 환자 등록 / 수정 / 삭제 / 검색
- 진료과, 담당의, 진단, 약물, 알레르기 정보 관리
- JWT 인증 기반 접근 제어

---

## 기술 스택

### Frontend
- React 18 + Vite
- React Router v6
- React Markdown
- CSS Variables 기반 다크 테마 디자인 시스템

### Backend
- Node.js + Express 5
- MongoDB Atlas + Mongoose
- Anthropic Claude SDK (claude-sonnet-4-20250514)
- multer (이미지 업로드)
- JWT + bcrypt (인증)

### Infrastructure
- Vercel (프론트엔드 배포)
- Render (백엔드 배포)
- MongoDB Atlas (클라우드 데이터베이스)

---

## 시스템 아키텍처

```
[React Frontend - Vercel]
        |
        | REST API (JWT Auth)
        v
[Express Backend - Render]
        |
        |-- [MongoDB Atlas]
        |     Patient 데이터, 영상 base64, AI 소견 저장
        |
        |-- [Anthropic Claude API]
              Vision: 영상 소견 생성 / Longitudinal 비교
              Text:   임상 요약 / 증상 체크
```

---

## AI 소견 생성 흐름

```
이미지 업로드 (JPG/PNG)
        |
        v
multer -> buffer -> base64 변환
        |
        v
Claude Vision API 호출
  system: 영상의학과 전문의 보조 AI
  user:   이미지 + 구조화 프롬프트
        |
        v
JSON 파싱 { findings, impression, recommendation, confidence }
        |
        v
MongoDB 저장 (Patient.images[].aiReport)
        |
        v
프론트엔드 소견 패널 렌더링
```

---

## Longitudinal 비교 검증 결과

테스트 케이스: Wilson's disease MRI (2013 vs 2016, DPA 킬레이션 치료 전후)

| 항목 | 실제 소견 | AI 분석 결과 | 일치 여부 |
|------|----------|-------------|----------|
| 변화 방향 | 호전 (병변 소실) | 호전 감지 | 일치 |
| T2 고신호강도 변화 | 소실 | 소실 감지 | 일치 |
| 병변 위치 (dentate nuclei) | 정확 | 부분 오류 | 부분 일치 |
| 전반적 상태 분류 | 호전 | 호전 | 일치 |

전체 일치도: 약 60-65%
범용 Vision LLM 기반임을 감안할 때, 병변 변화 방향 및 임상적 의미 파악 측면에서 유의미한 수준의 성능을 보였습니다.

---

## 로컬 실행 방법

### 사전 요구사항
- Node.js 20 이상
- MongoDB (로컬 또는 Atlas)
- Anthropic API Key

### Backend

```bash
git clone https://github.com/kmjsm2/vibe_pts_checkup_backend.git
cd vibe_pts_checkup_backend
npm install
```

.env 파일 생성:

```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm run dev
```

### Frontend

```bash
git clone https://github.com/kmjsm2/vibe_pts_checkup_frontend.git
cd vibe_pts_checkup_frontend
npm install
```

.env 파일 생성:

```
VITE_API_BASE=http://localhost:5000
```

```bash
npm run dev
```

---

## 프로젝트 구조

```
Frontend
└── src/
    ├── components/clinical/
    │   ├── ClinicalShell.jsx               # 레이아웃 및 환자 목록
    │   └── ClinicalPatientWorkspace.jsx    # 환자 상세 및 ImagingTab
    ├── api/
    │   ├── patients.js                     # 환자 CRUD API
    │   └── ai.js                           # AI 소견 및 비교 API
    └── pages/
        ├── DashboardPage.jsx
        └── LoginPage.jsx

Backend
└── routes/
    ├── patients.js    # 환자 CRUD 및 이미지 업로드
    ├── ai.js          # Vision 분석 및 Longitudinal 비교
    ├── auth.js        # JWT 인증
    └── stats.js       # 통계
    models/
    └── Patient.js     # 환자 스키마 (images 배열 포함)
    middleware/
    └── auth.js        # requireAuth
```

---

## 향후 개선 방향

- DICOM 파일 직접 지원
- 영상의학 특화 모델 연동
- 병변 좌표 시각화 (Bounding Box)
- FHIR 표준 EMR 연동

---

## 개발자

김명주
- GitHub: https://github.com/kmjsm2

---

면책 고지: 본 서비스의 AI 소견은 보조 도구로 생성된 것이며, 최종 판독 및 진단은 반드시 전문의가 확인해야 합니다. 식약처 SaMD 가이드라인 준수.
