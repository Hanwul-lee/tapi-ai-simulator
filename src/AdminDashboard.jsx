// src/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import './admin.css'; // 없으면 나중에 만들어도 됨

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'https://tapi-ai-simulator-backend.onrender.com';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'dev-admin-key';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('companies'); // companies | diagnostics | personas | logs

  // 고객사 관리용 상태
  const [companies, setCompanies] = useState([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [newCompany, setNewCompany] = useState({
    id: '',
    name: '',
    description: '',
  });

  // -----------------------------
  // 고객사 목록 불러오기
  // -----------------------------
  const fetchCompanies = async () => {
    setCompanyLoading(true);
    setCompanyError('');
    try {
      const res = await fetch(`${BACKEND_URL}/admin/companies`, {
        headers: {
          'X-Admin-Key': ADMIN_KEY,
        },
      });
      if (!res.ok) {
        throw new Error('고객사 목록 조회 실패');
      }
      const data = await res.json();
      setCompanies(data);
    } catch (err) {
      console.error(err);
      setCompanyError(err.message || '알 수 없는 오류');
    } finally {
      setCompanyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'companies') {
      fetchCompanies();
    }
  }, [activeTab]);

  // -----------------------------
  // 고객사 생성
  // -----------------------------
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompany.id.trim() || !newCompany.name.trim()) {
      alert('회사 ID와 이름은 필수입니다.');
      return;
    }

    setCompanyLoading(true);
    setCompanyError('');
    try {
      const res = await fetch(`${BACKEND_URL}/admin/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY,
        },
        body: JSON.stringify(newCompany),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || '고객사 생성 실패');
      }

      setNewCompany({ id: '', name: '', description: '' });
      await fetchCompanies();
    } catch (err) {
      console.error(err);
      setCompanyError(err.message || '알 수 없는 오류');
    } finally {
      setCompanyLoading(false);
    }
  };

  // -----------------------------
  // 화면 렌더링
  // -----------------------------
  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <h2 className="admin-logo">TAPI Admin</h2>
        <nav className="admin-nav">
          <button
            type="button"
            className={activeTab === 'companies' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('companies')}
          >
            1. 고객사 관리
          </button>
          <button
            type="button"
            className={activeTab === 'diagnostics' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('diagnostics')}
          >
            2. 진단 관리
          </button>
          <button
            type="button"
            className={activeTab === 'personas' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('personas')}
          >
            3. 페르소나 관리
          </button>
          <button
            type="button"
            className={activeTab === 'logs' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('logs')}
          >
            4. 데이터 로그
          </button>
        </nav>
      </aside>

      <main className="admin-main">
        {activeTab === 'companies' && (
          <section>
            <h1>고객사 관리</h1>
            <p className="admin-desc">
              교육/시뮬레이션을 적용할 고객사를 등록하고, 이름/설명을 관리하는 화면입니다.
            </p>

            <div className="admin-grid">
              <div className="admin-card">
                <h2>고객사 목록</h2>
                {companyLoading && <p>불러오는 중…</p>}
                {companyError && <p className="admin-error">{companyError}</p>}

                {!companyLoading && !companyError && (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>이름</th>
                        <th>설명</th>
                        <th>사용 여부</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => (
                        <tr key={c.id}>
                          <td>{c.id}</td>
                          <td>{c.name}</td>
                          <td>{c.description}</td>
                          <td>{c.is_active ? '사용중' : '비활성'}</td>
                        </tr>
                      ))}
                      {companies.length === 0 && (
                        <tr>
                          <td colSpan={4}>등록된 고객사가 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="admin-card">
                <h2>새 고객사 등록</h2>
                <form onSubmit={handleCreateCompany} className="admin-form">
                  <label>
                    회사 ID
                    <input
                      type="text"
                      value={newCompany.id}
                      onChange={(e) =>
                        setNewCompany((prev) => ({ ...prev, id: e.target.value }))
                      }
                      placeholder="예) HDHYUNDAI"
                    />
                  </label>
                  <label>
                    회사 이름
                    <input
                      type="text"
                      value={newCompany.name}
                      onChange={(e) =>
                        setNewCompany((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="예) HD현대"
                    />
                  </label>
                  <label>
                    설명
                    <textarea
                      rows={3}
                      value={newCompany.description}
                      onChange={(e) =>
                        setNewCompany((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="간단한 메모(선택)"
                    />
                  </label>

                  <button type="submit" disabled={companyLoading} className="primary-btn">
                    {companyLoading ? '등록 중…' : '고객사 등록'}
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'diagnostics' && (
          <section>
            <h1>진단 관리</h1>
            <p>여기는 다음 단계에서 구현해 보자. (백엔드 /admin/diagnostics API에 연결)</p>
          </section>
        )}

        {activeTab === 'personas' && (
          <section>
            <h1>페르소나 관리</h1>
            <p>백엔드 /admin/personas API와 연결해서 on/off 관리 화면을 붙일 예정.</p>
          </section>
        )}

        {activeTab === 'logs' && (
          <section>
            <h1>데이터 로그</h1>
            <p>/admin/logs API에서 시뮬레이션 기록을 테이블로 보여줄 계획.</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;