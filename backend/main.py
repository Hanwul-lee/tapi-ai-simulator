# backend/main.py
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import secrets  # 6자리 코드 생성용
from dotenv import load_dotenv

load_dotenv()

# -----------------------------
# 0. 설정
# -----------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "\n🚨 GEMINI_API_KEY가 없습니다.\n"
        "Render 대시보드 > Environment 탭에서 GEMINI_API_KEY를 등록해 주세요."
    )

genai.configure(api_key=GEMINI_API_KEY)

# 관리자 전용 API 키 (로컬은 기본값, Render 에서는 ENV 로 덮어씀)
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "dev-admin-key")

# 사용할 모델 이름
MODEL_NAME = "gemini-1.5-pro"

app = FastAPI()

# CORS – 프론트(Netlify)에서 호출 가능하도록
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 필요 시 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# 1. 페르소나 프롬프트 정의
# -----------------------------
PERSONA_PROMPTS: Dict[str, str] = {
    "quiet": """
너는 가상의 팀원 "김서연"이다. (조용한 성실형)

- 직무: 재무팀 선임, 3년차
- 성향: 신중하고 표현이 적으며 갈등을 피하고 싶어한다.
- 특징: 혼자 끙끙대다가 번아웃 나기 쉬움. 비난과 실수에 민감하다.

규칙:
1) 항상 자연스러운 한국어 존댓말로 2~4문장만 말한다.
2) AI, 프롬프트, 시뮬레이션 같은 단어는 절대 언급하지 않는다.
3) 팀장의 말을 들었을 때 느끼는 감정, 걱정, 고민을 솔직히 드러낸다.
4) 가능한 한 구체적인 사례나 상황을 한두 개 정도 언급한다.
""",
    "idea": """
너는 가상의 팀원 "박지훈"이다. (아이디어 폭주형)

- 직무: 서비스기획팀 선임, 4년차
- 성향: 즉흥적이고 창의적이다. 아이디어는 넘치지만 반복 업무와 마감 관리에 약하다.
- 특징: 새로운 시도를 좋아하지만, 디테일에서 자주 실수한다. 피드백에 예민하지만 성장 욕구가 크다.

규칙:
1) 항상 자연스러운 한국어 존댓말로 2~4문장만 말한다.
2) AI, 프롬프트, 시뮬레이션 같은 단어는 절대 언급하지 않는다.
3) 팀장의 말에 대해 본인의 생각과 감정을 솔직하게 표현한다.
4) 하고 싶은 아이디어, 요구, 불만, 기대를 한두 가지씩 드러낸다.
""",
    "social": """
너는 가상의 팀원 "이도윤"이다. (관계지향 협력형)

- 직무: 고객경험(CX)팀 책임, 10년차
- 성향: 팀워크와 분위기를 매우 중시한다. 갈등과 누군가 상처받는 상황을 극도로 부담스러워한다.
- 특징: 본인보다 팀/동료를 우선하지만, 속으로는 서운함과 피로감이 쌓여 있다.

규칙:
1) 항상 자연스러운 한국어 존댓말로 2~4문장만 말한다.
2) AI, 프롬프트, 시뮬레이션 같은 단어는 절대 언급하지 않는다.
3) 팀장의 말에 대한 감정(안심/불안/서운함/고마움 등)을 표현한다.
4) 관계와 팀 분위기에 대한 우려, 바라는 점을 함께 말한다.
""",
}

# ============================================================
# 1-B. 링크 + 6자리 교육 코드 (참여자 액세스 제어)
# ============================================================

# 교육 코드 정보
class AccessCode(BaseModel):
    id: str
    company_id: str
    campaign_code: str
    access_code: str  # 참여자에게 공유되는 6자리 코드
    active: bool = True


# 관리자 생성용 요청/응답 모델
class AdminCreateAccessRequest(BaseModel):
    company_id: str
    campaign_code: str
    access_code: Optional[str] = None  # 비워두면 서버가 6자리 자동 생성


# /access/verify 요청/응답 모델
class AccessVerifyRequest(BaseModel):
    company_id: str
    campaign_code: str
    access_code: str


class AccessVerifyResponse(BaseModel):
    access_token: str
    company_id: str
    campaign_code: str


class AccessContext(BaseModel):
    company_id: str
    campaign_code: str
    access_token: str


# 메모리 상의 교육 코드 저장소 (MVP)
ACCESS_CODES: List[AccessCode] = [
    # 예시 코드 1개(원하면 삭제해도 됨)
    AccessCode(
        id=str(uuid.uuid4()),
        company_id="HDHYUNDAI",
        campaign_code="MDP2025",
        access_code="129374",
        active=True,
    )
]

# 발급된 access_token 저장소 (MVP에서는 메모리)
ACCESS_SESSIONS: Dict[str, Dict] = {}


def validate_access_code(company_id: str, campaign_code: str, access_code: str) -> bool:
    """ACCESS_CODES에서 유효한 코드인지 확인"""
    for item in ACCESS_CODES:
        if (
            item.company_id == company_id
            and item.campaign_code == campaign_code
            and item.access_code == access_code
            and item.active
        ):
            return True
    return False


async def get_current_access(
    x_access_token: str = Header(..., alias="X-Access-Token"),
) -> AccessContext:
    """
    /chat, /report 같은 공개 API에서 사용하는 접근 토큰 검증.
    """
    session = ACCESS_SESSIONS.get(x_access_token)
    if not session:
        raise HTTPException(status_code=401, detail="유효하지 않은 접근 토큰입니다.")

    return AccessContext(
        company_id=session["company_id"],
        campaign_code=session["campaign_code"],
        access_token=x_access_token,
    )


async def verify_admin(
    x_admin_key: str = Header(..., alias="X-Admin-Key"),
):
    """관리자 전용 엔드포인트 보호용"""
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="관리자 키가 올바르지 않습니다.")
    return True


# --- 참여자용: 교육 코드 검증 후 access_token 발급 ---
@app.post("/access/verify", response_model=AccessVerifyResponse)
async def access_verify(req: AccessVerifyRequest):
    """
    회사 ID + 캠페인 코드 + 6자리 교육 코드를 검증하고
    유효하면 access_token을 발급한다.
    """
    ok = validate_access_code(req.company_id, req.campaign_code, req.access_code)
    if not ok:
        raise HTTPException(status_code=401, detail="교육 코드가 올바르지 않습니다.")

    token = str(uuid.uuid4())

    ACCESS_SESSIONS[token] = {
        "company_id": req.company_id,
        "campaign_code": req.campaign_code,
        "created_at": datetime.utcnow().isoformat(),
    }

    return AccessVerifyResponse(
        access_token=token,
        company_id=req.company_id,
        campaign_code=req.campaign_code,
    )


# --- 관리자용: 교육 코드 생성 ---
@app.post("/admin/access/create", response_model=AccessCode)
async def admin_create_access(
    req: AdminCreateAccessRequest,
    _: bool = Depends(verify_admin),
):
    """
    회사별/캠페인별 6자리 교육 코드를 생성한다.
    access_code 를 비워두면 서버가 6자리 랜덤 코드 생성.
    """
    code = req.access_code or f"{secrets.randbelow(10**6):06d}"

    access = AccessCode(
        id=str(uuid.uuid4()),
        company_id=req.company_id,
        campaign_code=req.campaign_code,
        access_code=code,
        active=True,
    )
    ACCESS_CODES.append(access)
    return access


# --- 관리자용: 교육 코드 목록 조회 ---
@app.get("/admin/access/list", response_model=List[AccessCode])
async def admin_list_access(_: bool = Depends(verify_admin)):
    return ACCESS_CODES


# --- 관리자용: 특정 코드 비활성화 ---
@app.post("/admin/access/deactivate/{access_id}")
async def admin_deactivate_access(
    access_id: str,
    _: bool = Depends(verify_admin),
):
    for item in ACCESS_CODES:
        if item.id == access_id:
            item.active = False
            return {"status": "ok", "message": "비활성화되었습니다."}
    raise HTTPException(status_code=404, detail="해당 ID의 교육 코드를 찾을 수 없습니다.")


# ============================================================
# 2. 관리자용 도메인: 고객사 / 진단 / 페르소나 / 데이터 로그
# ============================================================

# --- 2-1) 고객사 관리 ---
class Company(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    is_active: bool = True


COMPANIES: List[Company] = [
    Company(
        id="HDHYUNDAI",
        name="HD현대",
        description="HD현대 리더십/핵심가치 교육",
        is_active=True,
    ),
    Company(
        id="LOTTEGL",
        name="롯데글로벌로지스",
        description="영업/조직장 리더십 과정",
        is_active=True,
    ),
]


class CompanyCreateRequest(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""


class CompanyUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


@app.get("/admin/companies", response_model=List[Company])
async def admin_list_companies(_: bool = Depends(verify_admin)):
    return COMPANIES


@app.post("/admin/companies", response_model=Company)
async def admin_create_company(
    req: CompanyCreateRequest,
    _: bool = Depends(verify_admin),
):
    if any(c.id == req.id for c in COMPANIES):
        raise HTTPException(status_code=400, detail="이미 존재하는 회사 ID 입니다.")
    company = Company(
        id=req.id,
        name=req.name,
        description=req.description or "",
        is_active=True,
    )
    COMPANIES.append(company)
    return company


@app.put("/admin/companies/{company_id}", response_model=Company)
async def admin_update_company(
    company_id: str,
    req: CompanyUpdateRequest,
    _: bool = Depends(verify_admin),
):
    for c in COMPANIES:
        if c.id == company_id:
            if req.name is not None:
                c.name = req.name
            if req.description is not None:
                c.description = req.description
            if req.is_active is not None:
                c.is_active = req.is_active
            return c
    raise HTTPException(status_code=404, detail="해당 회사 ID를 찾을 수 없습니다.")


# --- 2-2) 진단(시뮬레이션/캠페인) 관리 ---
class Diagnostic(BaseModel):
    id: str
    company_id: str
    name: str
    description: Optional[str] = ""
    created_at: str
    is_active: bool = True


DIAGNOSTICS: List[Diagnostic] = []


class DiagnosticCreateRequest(BaseModel):
    company_id: str
    name: str
    description: Optional[str] = ""


class DiagnosticUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


@app.get("/admin/diagnostics", response_model=List[Diagnostic])
async def admin_list_diagnostics(_: bool = Depends(verify_admin)):
    return DIAGNOSTICS


@app.post("/admin/diagnostics", response_model=Diagnostic)
async def admin_create_diagnostic(
    req: DiagnosticCreateRequest,
    _: bool = Depends(verify_admin),
):
    diag = Diagnostic(
        id=str(uuid.uuid4()),
        company_id=req.company_id,
        name=req.name,
        description=req.description or "",
        created_at=datetime.utcnow().isoformat(),
        is_active=True,
    )
    DIAGNOSTICS.append(diag)
    return diag


@app.put("/admin/diagnostics/{diag_id}", response_model=Diagnostic)
async def admin_update_diagnostic(
    diag_id: str,
    req: DiagnosticUpdateRequest,
    _: bool = Depends(verify_admin),
):
    for d in DIAGNOSTICS:
        if d.id == diag_id:
            if req.name is not None:
                d.name = req.name
            if req.description is not None:
                d.description = req.description
            if req.is_active is not None:
                d.is_active = req.is_active
            return d
    raise HTTPException(status_code=404, detail="해당 진단 ID를 찾을 수 없습니다.")


# --- 2-3) 페르소나 관리 (지금은 read-only + 활성/비활성만) ---
class PersonaAdmin(BaseModel):
    key: str          # quiet / idea / social ...
    name: str         # 화면에 보이는 이름
    description: str
    is_active: bool = True


PERSONA_ADMIN: List[PersonaAdmin] = [
    PersonaAdmin(
        key="quiet",
        name="조용한 성실형(김서연)",
        description="신중하고 표현이 적으며 갈등을 피하고 싶어하는 유형",
        is_active=True,
    ),
    PersonaAdmin(
        key="idea",
        name="아이디어 폭주형(박지훈)",
        description="창의적이고 아이디어가 많지만 마감/디테일에 약한 유형",
        is_active=True,
    ),
    PersonaAdmin(
        key="social",
        name="관계지향 협력형(이도윤)",
        description="팀 분위기와 관계를 가장 중요하게 여기는 유형",
        is_active=True,
    ),
]


class PersonaUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    description: Optional[str] = None


@app.get("/admin/personas", response_model=List[PersonaAdmin])
async def admin_list_personas(_: bool = Depends(verify_admin)):
    return PERSONA_ADMIN


@app.put("/admin/personas/{persona_key}", response_model=PersonaAdmin)
async def admin_update_persona(
    persona_key: str,
    req: PersonaUpdateRequest,
    _: bool = Depends(verify_admin),
):
    for p in PERSONA_ADMIN:
        if p.key == persona_key:
            if req.is_active is not None:
                p.is_active = req.is_active
            if req.description is not None:
                p.description = req.description
            return p
    raise HTTPException(status_code=404, detail="해당 페르소나 key를 찾을 수 없습니다.")


# --- 2-4) 데이터 축적: 사용자 히스토리(리포트 로그) ---
class ConversationLog(BaseModel):
    id: str
    company_id: str
    campaign_code: str
    simulation_id: Optional[str]
    persona: str
    created_at: str
    topic: Optional[str] = None
    situation: Optional[str] = None
    last_user_message: Optional[str] = None
    last_coach_reply: Optional[str] = None


CONVERSATION_LOGS: List[ConversationLog] = []


@app.get("/admin/logs", response_model=List[ConversationLog])
async def admin_list_logs(_: bool = Depends(verify_admin)):
    """
    단순 조회용: 나중에 pagination / 필터 추가 가능
    """
    return CONVERSATION_LOGS


# ============================================================
# 3. Gemini 챗 세션 관리
# ============================================================
SESSIONS: Dict[str, "genai.ChatSession"] = {}


def get_or_create_session(simulation_id: Optional[str], persona: str):
    """simulation_id로 Gemini chat 세션을 찾아오거나 새로 만든다."""
    persona_key = persona if persona in PERSONA_PROMPTS else "quiet"
    system_prompt = PERSONA_PROMPTS[persona_key]

    # 새 세션이 필요한 경우
    if not simulation_id or simulation_id not in SESSIONS:
        simulation_id = simulation_id or str(uuid.uuid4())
        model = genai.GenerativeModel(MODEL_NAME)

        # system prompt를 history의 첫 user 메시지로 넣어둔다
        chat = model.start_chat(
            history=[
                {
                    "role": "user",
                    "parts": [
                        system_prompt
                        + "\n\n지금부터 너는 위 설명에 나온 팀원으로만 행동한다."
                        " 이후 대화에서는 팀장(리더)의 말을 듣고 그때그때 자연스럽게 대답해라."
                    ],
                }
            ]
        )
        SESSIONS[simulation_id] = chat

    return simulation_id, SESSIONS[simulation_id]


# ============================================================
# 4. Request / Response 모델 (시뮬레이션 & 리포트)
# ============================================================
class ChatRequest(BaseModel):
    message: str
    persona: str
    simulation_id: Optional[str] = None


class ChatResponse(BaseModel):
    simulation_id: str
    reply: str


class ReportChatMessage(BaseModel):
    role: str  # "leader" | "member"
    text: str
    time: Optional[str] = None


class ReportRequest(BaseModel):
    company_id: str
    topic: Dict[str, str]
    persona: Dict[str, str]
    situation: Dict[str, str]
    agenda: Optional[str] = ""
    chatHistory: List[ReportChatMessage]
    lastUserMessage: Optional[str] = ""
    lastCoachReply: Optional[str] = ""


# ============================================================
# 5. 헬스 체크
# ============================================================
@app.get("/health")
async def health():
    return {"status": "ok"}


# ============================================================
# 6. 시뮬레이션 채팅 엔드포인트
# ============================================================
@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, access: AccessContext = Depends(get_current_access)):
    """
    리더의 발화를 받아서, 선택된 팀원 페르소나 관점에서 답변을 생성한다.
    access 에서 company_id / campaign_code 를 나중에 로그/DB에 활용 가능.
    """
    msg = req.message.strip()
    if not msg:
        raise HTTPException(status_code=400, detail="message is empty")

    sim_id, chat_session = get_or_create_session(req.simulation_id, req.persona)

    # 리더의 발화를 짧은 프롬프트로 감싸서 보낸다
    prompt = (
        f"리더: {msg}\n\n"
        "위 문장을 방금 들은 팀원 입장에서 대답해라.\n"
        "- 자연스러운 한국어 존댓말\n"
        "- 2~4문장\n"
        "- AI, 프롬프트, 시뮬레이션 같은 단어는 절대 언급하지 말 것\n"
        "- 지금 느끼는 감정, 걱정, 기대를 솔직하게 표현할 것"
    )

    try:
        response = chat_session.send_message(prompt)
        reply_text = (response.text or "").strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini 오류: {e}")

    if not reply_text:
        reply_text = "말문이 막히네요… 한 번만 더 물어봐 주시겠어요?"

    return ChatResponse(simulation_id=sim_id, reply=reply_text)


# ============================================================
# 7. 리포트 생성 엔드포인트 (+ 데이터 로그 저장)
# ============================================================
@app.post("/report")
async def report(req: ReportRequest, access: AccessContext = Depends(get_current_access)):
    """
    대화 로그 기반으로 리더십 피드백 리포트 생성
    기대 응답 형식:
    {
      "summary": "...",
      "strengths": ["...", "..."],
      "improvements": ["...", "..."],
      "coachNote": "..."
    }
    """
    model = genai.GenerativeModel(MODEL_NAME)

    # 대화 로그를 사람이 읽기 좋은 형태로 정리
    history_lines = []
    for m in req.chatHistory:
        speaker = "리더" if m.role == "leader" else "팀원"
        history_lines.append(f"{speaker}: {m.text}")
    history_text = "\n".join(history_lines)

    prompt = f"""
당신은 조직개발·리더십 코치입니다.

[회사 정보]
- Company ID(프론트에서 보낸 값): {req.company_id}
- Access Company(토큰 기준): {access.company_id}
- Campaign Code: {access.campaign_code}

[리더십 주제]
- {req.topic.get("label")}

[상황]
- {req.situation.get("title")}

[선택한 팀원 페르소나]
- 이름: {req.persona.get("displayName")}
- 유형: {req.persona.get("name")}

[리더가 미리 정리한 면담 아젠다]
{req.agenda or "(입력 없음)"}

[리더와 팀원 사이의 실제 대화 로그]
{history_text}

위 정보를 바탕으로,
리더에게 제공할 피드백 리포트를 다음 구조로 작성해 주세요.

1) 현상 진단 (2~3문단)
- 이번 대화에서 드러난 상황, 관계, 감정, 이슈를 코치 관점에서 요약.

2) 잘한 점 (3~5개 bullet)
- 리더가 이번 대화에서 잘했던 구체적인 행동·질문·태도를 정리.

3) 개선할 점 (3~5개 bullet)
- 다음 대화에서 보완하면 좋을 행동·질문·태도를 구체적으로 제안.

4) 코치 코멘트 (1문단)
- 리더가 기억하면 좋을 한 문단 코멘트.

형식:
- bullet 항목은 "• "로 시작한다.
- 한국어 존댓말로 작성한다.
"""

    try:
        response = model.generate_content(prompt)
        full_text = (response.text or "").strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini 오류: {e}")

    # 간단 파서: 큰 섹션 나누기 (실제 서비스에서는 더 정교하게 해도 됨)
    def extract_section(label: str, default: str = "") -> str:
        marker = f"{label}"
        idx = full_text.find(marker)
        if idx == -1:
            return default
        # marker 기준으로 이후 텍스트만
        return full_text[idx + len(marker) :].strip()

    summary = extract_section("1)", full_text)
    strengths = extract_section("2)")
    improvements = extract_section("3)")
    coach_note = extract_section("4)")

    # bullet 텍스트를 리스트로 변환
    def bullets_to_list(text: str):
        lines = [l.strip("-• ").strip() for l in text.splitlines() if "•" in l]
        return [l for l in lines if l]

    strengths_list = bullets_to_list(strengths) or [
        "구성원의 입장과 감정을 이해하려는 노력이 보였습니다."
    ]
    improvements_list = bullets_to_list(improvements) or [
        "다음 대화를 위해 2~3개의 구체적인 질문을 미리 준비해보면 좋겠습니다."
    ]

    # 🔴 데이터 축적: 간단 로그 남기기
    log = ConversationLog(
        id=str(uuid.uuid4()),
        company_id=access.company_id,
        campaign_code=access.campaign_code,
        simulation_id=None,  # 필요하면 프론트에서 simulation_id도 같이 보내도록 확장
        persona=req.persona.get("name", ""),
        created_at=datetime.utcnow().isoformat(),
        topic=req.topic.get("label"),
        situation=req.situation.get("title"),
        last_user_message=req.lastUserMessage or "",
        last_coach_reply=req.lastCoachReply or "",
    )
    CONVERSATION_LOGS.append(log)

    return {
        "summary": summary,
        "strengths": strengths_list,
        "improvements": improvements_list,
        "coachNote": coach_note,
    }
