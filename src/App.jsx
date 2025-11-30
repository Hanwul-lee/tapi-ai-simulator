import { useEffect, useState } from 'react';
import './App.css';
import AdminDashboard from './AdminDashboard';

// 백엔드 주소 (로컬 기본값 + 배포 시 환경변수 사용)
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://tapi-ai-simulator-backend.onrender.com';

// (임시) 접근 토큰 – /access/verify 로 받은 값을 .env 에 넣어서 사용
const ACCESS_TOKEN = import.meta.env.VITE_ACCESS_TOKEN || '';

// -----------------------------
// 1. 시뮬레이션 기본 데이터
// -----------------------------

// 회사/테넌트 구분용 (나중에 백엔드에 같이 보낼 수 있음)
const COMPANY_ID = 'TAPIROUGE_DEMO';

// Step1: 시뮬레이션 주제
const TOPICS = [
  {
    id: 'role',
    label: '리더 역할 이해',
    description: '실무자에서 리더로 전환되며 역할, 기준, 기대를 정리하는 연습',
  },
  {
    id: 'communication',
    label: '리더의 커뮤니케이션',
    description: '중요 메시지 전달, 경청, 피드백 등 리더의 대화 방식을 점검하는 연습',
  },
  {
    id: 'performanceReview',
    label: '성과평가 면담',
    description: '연말/중간 성과평가 면담에서 어렵고 민감한 대화를 다루는 연습',
  },
];

// Step2: 팀원 페르소나 (백엔드 persona 키와 연결)
const PERSONAS = [
  {
    id: 'quiet',
    name: '조용한 성실형',
    displayName: '김서연',
    position: '재무팀 선임 · 3년 차',
    avatar: '🧑‍💼',
    tags: ['신중함', '표현 적음', '갈등 회피'],
    description:
      '묵묵히 일을 하지만 자신의 어려움은 잘 드러내지 않습니다. 비난에 민감하고, 관계가 틀어지는 상황을 부담스러워합니다.',
    tagline: '“괜찮다고 말하지만, 속으로는 계속 실수하지 않으려고 긴장하고 있어요.”',
  },
  {
    id: 'idea',
    name: '아이디어 폭주형',
    displayName: '박지훈',
    position: '서비스기획팀 선임 · 4년 차',
    avatar: '💡',
    tags: ['창의성', '즉흥적', '집중력 편차'],
    description:
      '새로운 시도를 좋아하고 아이디어가 넘치지만, 마감 관리와 반복 업무에는 쉽게 지루함을 느낍니다.',
    tagline: '“아이디어 내는 건 좋은데, 디테일과 마감에서 자꾸 혼나는 게 고민이에요.”',
  },
  {
    id: 'social',
    name: '관계지향 협력형',
    displayName: '이도윤',
    position: '고객경험(CX)팀 책임 · 10년 차',
    avatar: '🤝',
    tags: ['팀웍', '공감', '분위기 중시'],
    description:
      '팀 분위기와 관계를 중요하게 생각하며, 갈등과 실망을 주는 상황을 매우 부담스러워합니다.',
    tagline:
      '“누가 상처받는 상황이 제일 힘들어요. 분위기를 지키면서도 할 말은 해야 하는 게 어렵네요.”',
  },
];

// Step3: 주제별 상황 목록
const SITUATIONS_BY_TOPIC = {
  // 1) 리더 역할 이해
  role: [
    {
      id: 'role-1',
      title: '실무자에서 팀장으로 막 승진한 상황',
      detail:
        '이제 팀의 성과와 구성원 성장을 함께 책임져야 합니다. 여전히 주요 실무도 직접 챙기고 있어, 어디까지 맡기고 어디까지 개입해야 할지 애매합니다.',
    },
    {
      id: 'role-2',
      title: '예전 동료가 이제는 팀원이 된 상황',
      detail:
        '함께 수평적인 동료였던 사람이 이제는 내가 리딩해야 하는 팀원이 되었습니다. 거리 감, 피드백, 기대 수준을 어떻게 조절해야 할지 고민됩니다.',
    },
  ],

  // 2) 리더의 커뮤니케이션
  communication: [
    {
      id: 'comm-1',
      title: '중요 사안을 구성원들이 서로 다르게 이해하고 있는 상황',
      detail:
        '프로젝트 방향/우선순위와 관련해 팀원마다 이해가 달라 혼선이 발생하고 있습니다. 오해를 풀고, 모두가 같은 그림을 보도록 다시 커뮤니케이션해야 합니다.',
    },
    {
      id: 'comm-2',
      title: '구성원이 “솔직한 피드백”을 요청한 상황',
      detail:
        '한 구성원이 최근 자신의 일하는 방식과 성장 가능성에 대해 솔직한 피드백을 요청했습니다. 관계를 해치지 않으면서도 구체적으로 이야기해야 하는 부담이 있습니다.',
    },
  ],

  // 3) 성과평가 면담
  performanceReview: [
    {
      id: 'eval-1',
      title: '성과가 기대에 못 미친 구성원과의 평가 면담',
      detail:
        '연간 목표 대비 성과가 부족한 구성원입니다. 방어적으로 나오지 않도록 하면서도, 기대 수준과 개선이 필요한 지점을 분명히 전달해야 합니다.',
    },
    {
      id: 'eval-2',
      title: '성과는 좋지만 태도 이슈가 있는 구성원과의 평가 면담',
      detail:
        '성과 수치는 좋지만, 협업 과정에서 거친 말투나 냉소적인 반응으로 동료들의 피로감이 높아지고 있습니다. 보상/평가 대화를 하면서 태도에 대한 메시지도 함께 다뤄야 합니다.',
    },
  ],
};

// -----------------------------
// 2. 로컬 분석 (백엔드 실패 시 fallback)
// -----------------------------
const createLocalAnalysis = ({
  topic,
  persona,
  situation,
  agenda,
  lastUserMessage,
  lastCoachReply,
}) => {
  const length = (lastUserMessage || '').trim().length;

  const lengthComment =
    length > 600
      ? '충분한 분량으로 생각과 계획을 비교적 자세히 풀어낸 답변입니다.'
      : length > 250
      ? '적절한 분량으로 핵심을 잘 담고 있는 답변입니다.'
      : '분량이 다소 짧아, 리더의 의도와 실행 계획을 조금 더 구체화해도 좋겠습니다.';

  return {
    summary: `「${topic?.label}」 주제에서 「${situation?.title}」 상황을 선택하고, ${persona?.name} 팀원을 대상으로 대화를 준비한 시뮬레이션입니다. 전체적으로 보면 ${lengthComment}`,
    strengths: [
      '구성원의 입장과 감정을 고려하려는 태도가 드러납니다.',
      '리더로서 상황을 정리하고 방향을 제시하려는 시도가 보입니다.',
      '대화를 통해 함께 해법을 찾으려는 협력적인 접근이 엿보입니다.',
    ],
    improvements: [
      '실제 면담에서 사용할 수 있는 구체적인 질문(무엇을, 어떻게 물어볼지)을 2~3개 정도 더 정리해보면 좋습니다.',
      '리더가 가지고 있는 기준(성과/역할/일하는 방식 등)을 한 번 더 명료하게 언어로 풀어보면, 구성원이 더 분명하게 이해할 수 있습니다.',
      '면담 이후 follow-up(점검 미팅, 추가 피드백, 격려 등)에 대한 계획을 한두 줄 정도 추가하면 대화의 완성도가 높아집니다.',
    ],
    coachNote:
      lastCoachReply ||
      '이번 답변을 기반으로 실제 면담에서 사용할 대화 스크립트를 3~5문장 정도로 정리해보세요. 같은 상황이 반복될 때도 적용할 수 있는 나만의 리더십 원칙으로 발전시킬 수 있습니다.',
  };
};

// -----------------------------
// 3. 메인 컴포넌트
// -----------------------------
function App() {
  // 테마
  const [theme, setTheme] = useState('light');

  // 시뮬레이터 / 관리자 모드
  const [mode, setMode] = useState('sim'); // 'sim' | 'admin'

  // 시뮬레이션 ID (백엔드 챗 세션용)
  const [simulationId, setSimulationId] = useState(null);

  // 스텝: 0=시작화면, 1~6
  const [step, setStep] = useState(0);

  // 선택 값들
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState(null);
  const [selectedSituationId, setSelectedSituationId] = useState(null);

  // Step4: 아젠다 메모
  const [agenda, setAgenda] = useState('');

  // Step5: 채팅
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]); // {from:'leader'|'member', text}
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Step6: 분석 결과
  const [analysis, setAnalysis] = useState(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  // 테마 변경 시 html data-theme 변경
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const selectedTopic = TOPICS.find((t) => t.id === selectedTopicId) || null;
  const selectedPersona =
    PERSONAS.find((p) => p.id === selectedPersonaId) || null;
  const situations = selectedTopic
    ? SITUATIONS_BY_TOPIC[selectedTopic.id] || []
    : [];
  const selectedSituation =
    situations.find((s) => s.id === selectedSituationId) || null;

  // -----------------------------
  // 3-1. 네비게이션 제어
  // -----------------------------
  const canGoNextFromStep = (currentStep) => {
    if (currentStep === 1) return !!selectedTopic;
    if (currentStep === 2) return !!selectedPersona;
    if (currentStep === 3) return !!selectedSituation;
    if (currentStep === 4) return true; // 아젠다는 선택사항
    if (currentStep === 5) return chatHistory.length > 0; // 최소 한 번은 시뮬레이션
    return true;
  };

  const handleNext = () => {
    if (step === 0) {
      setStep(1);
      return;
    }
    if (!canGoNextFromStep(step)) {
      alert('현재 단계의 선택을 먼저 완료해 주세요.');
      return;
    }
    setStep((prev) => Math.min(prev + 1, 6));
  };

  const handlePrev = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleRestart = () => {
    setStep(0);
    setSelectedTopicId(null);
    setSelectedPersonaId(null);
    setSelectedSituationId(null);
    setAgenda('');
    setChatInput('');
    setChatHistory([]);
    setAnalysis(null);
    setAnalysisError(null);
    setSimulationId(null);
  };

  // -----------------------------
  // 3-2. 시뮬레이션 채팅 (Step5)
  // -----------------------------
  const handleSendChat = async (e) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    if (!selectedTopic || !selectedPersona || !selectedSituation) {
      alert('주제, 팀원 페르소나, 상황을 먼저 선택해 주세요.');
      return;
    }

    // 1) 리더 메시지 추가
    const newHistory = [
      ...chatHistory,
      { from: 'leader', text: trimmed, time: new Date().toISOString() },
    ];
    setChatHistory(newHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ACCESS_TOKEN && { 'X-Access-Token': ACCESS_TOKEN }),
        },
        body: JSON.stringify({
          message: trimmed,
          persona: selectedPersona?.id ?? 'quiet',
          simulation_id: simulationId, // 첫 턴엔 null, 이후엔 유지
        }),
      });

      if (!res.ok) {
        throw new Error('백엔드 응답 오류');
      }

      const data = await res.json(); // { simulation_id, reply }

      if (!simulationId && data.simulation_id) {
        setSimulationId(data.simulation_id);
      }

      const memberReply = data?.reply || '응답을 불러오지 못했습니다.';

      setChatHistory((prev) => [
        ...prev,
        {
          from: 'member',
          text: memberReply,
          time: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error(error);
      setChatHistory((prev) => [
        ...prev,
        {
          from: 'member',
          text: '서버와 연결이 원활하지 않아, 임시로 응답을 가져오지 못했습니다.',
          time: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // -----------------------------
  // 3-3. 분석 생성 (Step6 진입 시, Gemini 리포트 호출)
  // -----------------------------
  useEffect(() => {
    const shouldGenerateReport =
      step === 6 &&
      selectedTopic &&
      selectedPersona &&
      selectedSituation &&
      chatHistory.length > 0;

    if (!shouldGenerateReport) {
      if (step === 6) {
        setAnalysis(null);
        setAnalysisError(null);
      }
      return;
    }

    const fetchReport = async () => {
      setIsAnalysisLoading(true);
      setAnalysisError(null);

      try {
        const lastUser = [...chatHistory]
          .reverse()
          .find((m) => m.from === 'leader');
        const lastMember = [...chatHistory]
          .reverse()
          .find((m) => m.from === 'member');

        const payload = {
          company_id: COMPANY_ID,
          topic: {
            id: selectedTopic.id,
            label: selectedTopic.label,
          },
          persona: {
            id: selectedPersona.id,
            name: selectedPersona.name,
            displayName: selectedPersona.displayName,
          },
          situation: {
            id: selectedSituation.id,
            title: selectedSituation.title,
          },
          agenda,
          chatHistory: chatHistory.map((m) => ({
            role: m.from === 'leader' ? 'leader' : 'member',
            text: m.text,
            time: m.time,
          })),
          lastUserMessage: lastUser?.text || '',
          lastCoachReply: lastMember?.text || '',
        };

        const res = await fetch(`${BACKEND_URL}/report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(ACCESS_TOKEN && { 'X-Access-Token': ACCESS_TOKEN }),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error('리포트 백엔드 응답 오류');
        }

        const data = await res.json();

        const newAnalysis = {
          summary:
            data.summary ||
            `「${selectedTopic.label}」 주제에서 「${selectedSituation.title}」 상황을 선택한 시뮬레이션입니다.`,
          strengths: Array.isArray(data.strengths)
            ? data.strengths
            : ['구성원의 입장과 감정을 이해하려는 노력이 보였습니다.'],
          improvements: Array.isArray(data.improvements)
            ? data.improvements
            : ['다음 대화를 위해 구체적인 질문을 2~3개 더 정리해보면 좋겠습니다.'],
          coachNote:
            data.coachNote ||
            data.comment ||
            '이번 대화를 돌아보며, 실제 면담에서 바로 써볼 수 있는 문장을 3~5개 정도 적어보세요.',
        };

        setAnalysis(newAnalysis);
      } catch (error) {
        console.error('Report 생성 중 오류:', error);
        setAnalysisError('리포트를 생성하는 중 오류가 발생했습니다. 기본 코멘트로 대체합니다.');

        const lastUser = [...chatHistory]
          .reverse()
          .find((m) => m.from === 'leader');
        const lastMember = [...chatHistory]
          .reverse()
          .find((m) => m.from === 'member');

        const fallback = createLocalAnalysis({
          topic: selectedTopic,
          persona: selectedPersona,
          situation: selectedSituation,
          agenda,
          lastUserMessage: lastUser?.text || '',
          lastCoachReply: lastMember?.text || '',
        });
        setAnalysis(fallback);
      } finally {
        setIsAnalysisLoading(false);
      }
    };

    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedTopic, selectedPersona, selectedSituation, agenda, chatHistory]);

  // -----------------------------
  // 4. 렌더링
  // -----------------------------
  return (
    <div className="app-root">
      {/* 헤더 */}
      <header className="app-header">
        <div className="app-title-block">
          <h1 className="app-title">TAPI AI 리더 시뮬레이터</h1>
          <p className="app-subtitle">
            실제 팀 리더의 Critical Moment를 기반으로 한
            <span className="highlight"> 대화 연습 & 피드백 코칭</span> 도구입니다.
          </p>
        </div>

        <div className="header-right">
          {mode === 'sim' && (
            <span className="step-badge">
              Step {step === 0 ? '0' : `${step}/6`}
            </span>
          )}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? '🌙 다크 모드' : '☀️ 라이트 모드'}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setMode((prev) => (prev === 'sim' ? 'admin' : 'sim'))}
          >
            {mode === 'sim' ? '관리자 모드' : '시뮬레이터로 돌아가기'}
          </button>
        </div>
      </header>

      {/* 메인 레이아웃: 모드에 따라 분기 */}
      {mode === 'admin' ? (
        <AdminDashboard />
      ) : (
        <main className="app-main">
          {/* 왼쪽: 스텝 내용 */}
          <section className="step-section">
            {/* Intro */}
            {step === 0 && (
              <div className="card intro-card">
                <h2>AI 시뮬레이션 시작</h2>
                <p className="intro-text">
                  6단계 흐름을 따라가며{' '}
                  <strong>“리더로서 직면한 상황에서 나는 어떻게 말하고 행동할 것인가?”</strong>
                  를 연습해 보세요.
                </p>
                <ol className="intro-steps">
                  <li>주제를 선택합니다. (리더 역할 이해 / 리더의 커뮤니케이션 / 성과평가 면담 )</li>
                  <li>시뮬레이션 할 팀원의 페르소나를 선택합니다.</li>
                  <li>구체적인 상황을 고릅니다.</li>
                  <li>면담 아젠다를 간단히 메모합니다.</li>
                  <li>시뮬레이션 채팅으로 대화를 시도합니다.</li>
                  <li>마지막으로 코치 관점에서 정리하고, 나만의 원칙을 남깁니다.</li>
                </ol>
                <button type="button" className="primary-btn" onClick={handleNext}>
                  시뮬레이션 시작하기
                </button>
              </div>
            )}

            {/* Step 1: 주제 선택 */}
            {step === 1 && (
              <div className="card">
                <h2>STEP 1. 주제 선택</h2>
                <p className="step-desc">
                  오늘 연습하고 싶은 리더십 주제를 선택하세요. 이후 모든 상황과 피드백이 이
                  선택에 맞춰집니다.
                </p>
                <div className="topic-grid">
                  {TOPICS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={
                        t.id === selectedTopicId ? 'topic-card active' : 'topic-card'
                      }
                      onClick={() => setSelectedTopicId(t.id)}
                    >
                      <div className="topic-label">{t.label}</div>
                      <p className="topic-desc">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: 페르소나 선택 */}
            {step === 2 && (
              <div className="card">
                <h2>STEP 2. 팀원 페르소나 선택</h2>
                <p className="step-desc">
                  실제로 떠오르는 팀원을 하나 떠올리고, 가장 비슷한 유형의{' '}
                  <strong>가상 인물 프로필</strong>을 선택해 보세요.
                </p>
                <div className="persona-grid">
                  {PERSONAS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={
                        p.id === selectedPersonaId
                          ? 'persona-card active'
                          : 'persona-card'
                      }
                      onClick={() => setSelectedPersonaId(p.id)}
                    >
                      <div className="persona-header">
                        <div className="persona-avatar" aria-hidden="true">
                          {p.avatar}
                        </div>
                        <div className="persona-header-text">
                          <div className="persona-name">
                            {p.displayName}{' '}
                            <span className="persona-type">({p.name})</span>
                          </div>
                          <div className="persona-position">{p.position}</div>
                        </div>
                      </div>

                      <div className="persona-tags">
                        {p.tags.map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <p className="persona-desc">{p.description}</p>
                      <p className="persona-tagline">{p.tagline}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: 상황 선택 */}
            {step === 3 && (
              <div className="card">
                <h2>STEP 3. 상황 선택</h2>
                {!selectedTopic && (
                  <p className="warning-text">
                    먼저 1단계에서 주제를 선택해 주세요. (상단 &quot;이전&quot; 버튼)
                  </p>
                )}
                {selectedTopic && (
                  <>
                    <p className="step-desc">
                      {selectedTopic.label} 관점에서 연습해 보고 싶은 구체적인 상황을 선택하세요.
                    </p>
                    <div className="situation-list">
                      {situations.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={
                            s.id === selectedSituationId
                              ? 'situation-item active'
                              : 'situation-item'
                          }
                          onClick={() => setSelectedSituationId(s.id)}
                        >
                          <div className="situation-title">{s.title}</div>
                          <p className="situation-detail">{s.detail}</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 4: 면담 아젠다 메모 */}
            {step === 4 && (
              <div className="card">
                <h2>STEP 4. 면담 아젠다 메모</h2>
                <p className="step-desc">
                  실제 면담을 한다고 가정했을 때, 꼭 다루고 싶은 핵심 아젠다를 적어 보세요.
                  완벽할 필요 없이, 키워드 수준으로만 남겨도 충분합니다.
                </p>
                <div className="agenda-layout">
                  <div className="agenda-main">
                    <textarea
                      value={agenda}
                      onChange={(e) => setAgenda(e.target.value)}
                      placeholder={`예)
1) 상황 정리: 현재 반복되고 있는 이슈를 사실 중심으로 정리
2) 감정 공감: 팀원이 느끼는 부담/답답함 인정
3) 기준 제시: 리더로서 꼭 지키고 싶은 기준 1~2개
4) 실행 합의: 다음 스프린트에서 함께 시도해볼 행동 합의`}
                    />
                  </div>
                  <div className="agenda-checklist">
                    <h3>대화 체크리스트</h3>
                    <ul>
                      <li>이 상황에서 리더로서 내 역할은 무엇인가?</li>
                      <li>팀과 조직의 기준/원칙은 무엇인지 정리했는가?</li>
                      <li>구성원의 감정과 관점을 먼저 이해하려는 질문이 있는가?</li>
                      <li>대화 이후 follow-up 계획을 가지고 있는가?</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: 시뮬레이션 채팅 */}
            {step === 5 && (
              <div className="card">
                <h2>STEP 5. 시뮬레이션 채팅</h2>
                <p className="step-desc">
                  선택한 팀원 페르소나와 실제로 대화한다고 생각하고, 첫 문장을 보내보세요.
                  이후에는 상황에 따라 여러 번 주고받으며 연습할 수 있습니다.
                </p>

                {/* 현재 설정 요약 (Step 5 전용) */}
                <div className="chat-context-summary">
                  <div>
                    <strong>주제</strong> : {selectedTopic ? selectedTopic.label : '미선택'}
                  </div>
                  <div>
                    <strong>상황</strong> :{' '}
                    {selectedSituation ? selectedSituation.title : '미선택'}
                  </div>
                  <div>
                    <strong>팀원</strong> :{' '}
                    {selectedPersona
                      ? `${selectedPersona.displayName} (${selectedPersona.name})`
                      : '미선택'}
                  </div>
                </div>

                <div className="chat-box">
                  <div className="chat-history">
                    {chatHistory.length === 0 && (
                      <p className="chat-placeholder">
                        아직 대화가 없습니다. 아래 입력창에 첫 문장을 적어보세요.
                        <br />
                        예) &quot;요즘 업무 어떻게 느끼고 있어? 솔직하게 이야기해줘도
                        괜찮아.&quot;
                      </p>
                    )}

                    {chatHistory.map((m, idx) => (
                      <div
                        key={idx}
                        className={
                          m.from === 'leader' ? 'chat-bubble me' : 'chat-bubble you'
                        }
                      >
                        <div className="chat-label">
                          {m.from === 'leader' ? '리더(나)' : '팀원 페르소나'}
                        </div>
                        <div className="chat-text">{m.text}</div>
                      </div>
                    ))}

                    {isChatLoading && (
                      <div className="chat-bubble you typing">
                        <div className="chat-label">팀원 페르소나</div>
                        <div className="typing-dots">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    )}
                  </div>

                  <form className="chat-input-area" onSubmit={handleSendChat}>
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="여기에 리더로서의 말을 적고 Enter(또는 보내기 버튼)를 눌러보세요."
                    />
                    <button type="submit" className="primary-btn" disabled={isChatLoading}>
                      {isChatLoading ? '응답 기다리는 중…' : '보내기'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Step 6: 피드백 리포트 (Gemini 결과 사용) */}
            {step === 6 && (
              <div className="card">
                <h2>STEP 6. 피드백 리포트</h2>

                {(!selectedTopic ||
                  !selectedPersona ||
                  !selectedSituation ||
                  chatHistory.length === 0) && (
                  <p className="step-desc">
                    리포트를 생성하려면 1~5단계를 먼저 완료하고, 최소 한 번 이상 시뮬레이션
                    채팅을 진행해 주세요.
                  </p>
                )}

                {selectedTopic &&
                  selectedPersona &&
                  selectedSituation &&
                  chatHistory.length > 0 &&
                  isAnalysisLoading && (
                    <p className="step-desc">
                      리더십 코치 관점에서 피드백 리포트를 생성하는 중입니다…
                      <br />
                      (대화 내용과 아젠다를 기반으로 Tapi AI가 요약과 코멘트를 정리합니다.)
                    </p>
                  )}

                {analysisError && !isAnalysisLoading && (
                  <div className="report-block warning">
                    <strong>{analysisError}</strong>
                  </div>
                )}

                {analysis && !isAnalysisLoading && (
                  <>
                    <p className="step-desc">
                      이번 시뮬레이션을 코치 관점에서 요약한 내용입니다. 아래 질문에 답을
                      적어보면 학습 효과가 더 커집니다.
                    </p>

                    <div className="report-block">
                      <h3>1) 요약</h3>
                      <p>{analysis.summary}</p>
                    </div>

                    <div className="report-columns">
                      <div className="report-block">
                        <h3>2) 이번 대화에서 잘한 점</h3>
                        <ul>
                          {analysis.strengths.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="report-block">
                        <h3>3) 다음에 보완해 보고 싶은 점</h3>
                        <ul>
                          {analysis.improvements.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="report-block">
                      <h3>4) 코치 코멘트</h3>
                      <p>{analysis.coachNote}</p>
                    </div>

                    <div className="report-block">
                      <h3>5) 나만의 한 줄 리더십 원칙으로 정리해본다면?</h3>
                      <p className="hint">
                        예) &quot;갈등 상황일수록 먼저 상대의 감정을 요약해주고, 그 다음에
                        기준을 설명한다.&quot;
                      </p>
                      <textarea
                        placeholder="여기에 오늘 시뮬레이션을 통해 얻은 나만의 한 줄 원칙을 적어보세요."
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 하단 네비게이션 */}
            <div className="step-nav">
              <button type="button" className="ghost-btn" onClick={handleRestart}>
                초기화
              </button>
              <div className="step-nav-right">
                {step > 0 && (
                  <button type="button" className="ghost-btn" onClick={handlePrev}>
                    이전
                  </button>
                )}
                {step < 6 && (
                  <button type="button" className="primary-btn" onClick={handleNext}>
                    다음
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 오른쪽: 선택 요약 패널 */}
          <aside className="summary-section">
            <div className="card summary-card">
              <h3>현재 설정 요약</h3>
              <dl>
                <dt>주제</dt>
                <dd>{selectedTopic ? selectedTopic.label : '아직 선택되지 않음'}</dd>

                <dt>팀원 페르소나</dt>
                <dd>
                  {selectedPersona
                    ? `${selectedPersona.displayName} (${selectedPersona.name})`
                    : '아직 선택되지 않음'}
                </dd>

                <dt>상황</dt>
                <dd>{selectedSituation ? selectedSituation.title : '아직 선택되지 않음'}</dd>
              </dl>

              <h4 className="mt16">오늘 연습 목표</h4>
              <p className="small-text">
                이 시뮬레이션을 통해{' '}
                <strong>리더로서 직면하는 상황에서 나만의 대화 방법</strong>을
                하나씩 발견해 나가는 것이 목표입니다.
              </p>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}

export default App;
