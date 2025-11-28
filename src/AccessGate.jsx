// src/AccessGate.jsx
// @ts-nocheck
import { useState, useEffect } from 'react';
import App from './App.jsx';
import AccessCodePage from './AccessCodePage.jsx';


function AccessGate() {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('tapi_access_token');
    if (token) setHasAccess(true);
  }, []);

  if (!hasAccess) {
    // 처음 들어온 사람은 코드 입력 페이지
    return <AccessCodePage onAccessGranted={() => setHasAccess(true)} />;
  }

  // 코드 통과한 사람만 실제 시뮬레이터(App) 사용
  return <App />;
}

export default AccessGate;
