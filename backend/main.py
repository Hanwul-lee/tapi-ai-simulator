# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv
from pathlib import Path
import os


# ===========================
# 1) ENV LOAD
# ===========================
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise RuntimeError(
        "\n🚨 OPENAI_API_KEY가 없습니다.\n"
        "backend/.env 파일을 만들고 아래처럼 입력하세요.\n\n"
        "OPENAI_API_KEY=sk-xxxx\n"
    )

client = OpenAI(api_key=OPENAI_API_KEY)


# ===========================
# 2) FASTAPI CONFIG
# ===========================
app = FastAPI(
    title="TAPI-AI Simulator API",
    description="리더십 시뮬레이션 AI",
    version="1.1.0",
)

FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "https://네트리파이도메인.netlify.app",
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
"""
}


# ===========================
# 3-1) MOCK 응답 생성기
# ===========================
def generate_mock_reply(message: str, persona: str) -> str:
    """OpenAI 실패 시 페르소나별 규칙 기반 응답"""
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
# 6) CHAT API
# ===========================
@app.post("/chat")
def chat(req: ChatRequest):
    persona_prompt = PERSONA_PROMPTS.get(req.persona, PERSONA_PROMPTS["quiet"])

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": persona_prompt},
                {"role": "user", "content": req.message},
            ],
            max_tokens=250,
            temperature=0.7,
        )
        reply = response.choices[0].message.content.strip()
        is_mock = False

    except Exception as e:
        # quota / network / key missing 등
        err = str(e)
        if "insufficient_quota" in err or "billing" in err:
            reply = generate_mock_reply(req.message, req.persona)
            is_mock = True
        else:
            raise HTTPException(
                status_code=500,
                detail=f"❗ OpenAI 호출 실패: {err}"
            )

    return {
        "reply": reply,
        "persona": req.persona,
        "simulation_id": req.simulation_id,
        "mock": is_mock,
    }
