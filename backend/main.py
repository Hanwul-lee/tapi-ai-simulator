# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from pathlib import Path
import os

import google.generativeai as genai


# ===========================
# 1) ENV LOAD (Gemini)
# ===========================
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "\n🚨 GEMINI_API_KEY가 없습니다.\n"
        "Render 콘솔 Environment 또는 backend/.env 파일에 아래처럼 입력하세요.\n\n"
        "GEMINI_API_KEY=your-gemini-api-key\n"
    )

genai.configure(api_key=GEMINI_API_KEY)
GEMINI_MODEL_NAME = "gemini-1.5-pro"


# ===========================
# 2) FASTAPI CONFIG
# ===========================
app = FastAPI(
    title="TAPI-AI Simulator API",
    description="리더십 시뮬레이션 AI (Gemini)",
    version="1.2.0",
)

FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "https://tapiaisimulator.netlify.app",  # Netlify 주소로 수정
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================
# 3) PERSONA PROFILES
# ===========================
PERSONA_PROMPTS = {
    "quiet": """
너는 '조용한 성실형 팀원'이다.
- 감정 표현을 과하게 하지 않는다.
- 짧은 문장, 공손한 말투.
- 갈등 상황에서 먼저 양보한다.
AI / 프롬프트 / 모델 같은 단어를 절대 말하지 않는다.
""",
    "idea": """
너는 '자유추구형 아이디어 팀원'이다.
- 생각을 바로바로 얘기한다.
- 창의적 시도, 확장된 사고를 선호한다.
- 감정 표현이 풍부하다.
AI / 프롬프트 / 모델 같은 단어를 절대 말하지 않는다.
""",
    "social": """
너는 '관계지향 협력형 팀원'이다.
- 팀 분위기에 민감하다.
- 부드러운 표현을 선호한다.
- 상대의 감정을 먼저 고려한다.
AI / 프롬프트 / 모델 같은 단어를 절대 말하지 않는다.
""",
}


# ===========================
# 3-1) MOCK 응답 생성기
# ===========================
def generate_mock_reply(message: str, persona: str) -> str:
    """Gemini 호출 실패 시 페르소나별 규칙 기반 응답"""
    m = message.strip()

    if persona == "idea":
        return (
            f"오, \"{m}\" 이 부분 진짜 흥미로운데요! "
            "만약 시간을 조금 더 받는다면 완전히 다른 방식으로 실행해볼 수도 있어요. "
            "지금 떠오른 아이디어가 몇 가지 있는데, 이야기해봐도 될까요?"
        )

    if persona == "social":
        return (
            f"\"{m}\"라고 말씀해주셔서 감사해요. "
            "혹시 제가 너무 부담을 드린 부분이 있었다면 알려주세요. "
            "같이 맞춰가면 좋겠어요."
        )

    # quiet 기본
    return (
        f"알겠습니다. \"{m}\" 말씀 주신 내용은 잘 이해했습니다. "
        "제가 부족했던 부분이 있다면 천천히 개선하겠습니다."
    )


# ===========================
# 4) Request Body
# ===========================
class ChatRequest(BaseModel):
    message: str
    persona: str = "quiet"
    simulation_id: Optional[int] = None


# ===========================
# 5) Health
# ===========================
@app.get("/health")
def health():
    return {"status": "ok"}


# ===========================
# 6) CHAT API (Gemini)
# ===========================
@app.post("/chat")
def chat(req: ChatRequest):
    persona_prompt = PERSONA_PROMPTS.get(req.persona, PERSONA_PROMPTS["quiet"])

    # Gemini에 보낼 프롬프트 구성
    full_prompt = f"""
다음은 팀장과 팀원 사이의 1:1 면담이다.

[팀원 설정]
{persona_prompt}

[리더의 발화]
{req.message}

위 상황에서, 팀원의 입장에서만 대답하라.
- 자연스러운 한국어 구어체로 3~5문장 정도로 말한다.
- 코치나 설명자가 아니라, 실제 팀원이 메신저에 답하듯이 말한다.
- AI, 프롬프트, 모델, Gemini 같은 단어는 절대 언급하지 않는다.
"""

    try:
        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        response = model.generate_content(full_prompt)
        reply = (response.text or "").strip()
        is_mock = False

        if not reply:
            # 혹시 빈 응답이면 mock 사용
            reply = generate_mock_reply(req.message, req.persona)
            is_mock = True

    except Exception as e:
        # 쿼터/네트워크 등 오류 → mock 응답
        err = str(e)
        print("Gemini error:", err)
        reply = generate_mock_reply(req.message, req.persona)
        is_mock = True

    return {
        "reply": reply,
        "persona": req.persona,
        "simulation_id": req.simulation_id,
        "mock": is_mock,
    }
