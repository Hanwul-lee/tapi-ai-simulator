
// @ts-nocheck
// src/AccessCodePage.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'https://tapi-ai-simulator-backend.onrender.com';

function AccessCodePage({ onAccessGranted }) {
  const [searchParams] = useSearchParams();
  const [companyId, setCompanyId] = useState('');
  const [campaignCode, setCampaignCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // URL 쿼리에서 cid, camp 읽어오기 (?cid=HDHYUNDAI&camp=MDP2025)
  useEffect(() => {
    const cid = searchParams.get('cid') || '';
    const camp = searchParams.get('camp') || '';
    setCompanyId(cid);
    setCampaignCode(camp);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!companyId || !campaignCode) {
      setError('URL에 회사 ID와 캠페인 코드가 없습니다. 담당자에게 다시 링크를 요청해 주세요.');
      return;
    }
    if (!code || code.length < 4) {
      setError('교육 코드를 입력해 주세요.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/access/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          campaign_code: campaignCode,
          access_code: code,
        }),
      });

      if (!res.ok) {
        const msg = (await res.json())?.detail || '교육 코드 검증에 실패했습니다.';
        throw new Error(msg);
      }

      const data = await res.json();
      // 토큰/회사 정보 로컬에 저장
      localStorage.setItem('tapi_access_token', data.access_token);
      localStorage.setItem('tapi_company_id', data.company_id);
      localStorage.setItem('tapi_campaign_code', data.campaign_code);

      if (onAccessGranted) onAccessGranted();
    } catch (err) {
      console.error(err);
      setError(err.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-root">
      <main className="app-main" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <section className="card" style={{ maxWidth: 480, width: '100%' }}>
          <h2>교육 코드 입력</h2>
          <p className="step-desc">
            리더십 시뮬레이션에 참여하기 위한 코드를 입력해 주세요.
          </p>

          <div style={{ fontSize: 14, marginBottom: 16, color: '#4b5563' }}>
            <div><strong>회사</strong> : {companyId || 'URL에 회사 ID가 없습니다.'}</div>
            <div><strong>과정/캠페인</strong> : {campaignCode || 'URL에 캠페인 코드가 없습니다.'}</div>
          </div>

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 8 }}>
              교육 코드(6자리)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              placeholder="예) 129374"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                marginBottom: 12,
              }}
            />

            {error && (
              <p style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="primary-btn"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? '확인 중…' : '시뮬레이션 시작하기'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default AccessCodePage;
