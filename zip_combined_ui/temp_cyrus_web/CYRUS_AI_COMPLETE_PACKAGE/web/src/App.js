import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8765';

function App() {
  const [status, setStatus] = useState('disconnected');
  const [healthData, setHealthData] = useState(null);

  useEffect(() => {
    // Check health on mount
    checkHealth();
    
    // Poll health every 5 seconds
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
        setStatus(data.status === 'healthy' || data.status === 'degraded' ? 'connected' : 'loading');
      } else {
        setStatus('disconnected');
      }
    } catch (error) {
      setStatus('disconnected');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚁 CYRUS AI</h1>
        <div className={`status status-${status}`}>
          {status === 'connected' ? '● Connected' : 
           status === 'loading' ? '● Loading...' : 
           '● Disconnected'}
        </div>
        {healthData && (
          <div className="health-info">
            <p>Model: {healthData.model_type || 'unknown'}</p>
            <p>Status: {healthData.status}</p>
          </div>
        )}
      </header>
      
      <main className="App-main">
        <iframe
          src="/avatar/index.html"
          title="CYRUS Avatar"
          className="avatar-iframe"
          allow="microphone"
        />
      </main>
      
      <nav className="App-nav">
        <a href="/avatar/index.html" target="_blank" rel="noopener noreferrer">
          Open Avatar in New Window
        </a>
        <a href={`${API_BASE_URL}/docs`} target="_blank" rel="noopener noreferrer">
          API Documentation
        </a>
      </nav>
    </div>
  );
}

export default App;
