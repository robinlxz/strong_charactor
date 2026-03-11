import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import StatusBar from './components/StatusBar';
import ChatBubble from './components/ChatBubble';
import { Send, Loader2, Lock, RotateCcw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function App() {
  // --- Access Control ---
  const [accessCode, setAccessCode] = useState(() => localStorage.getItem('access_code') || '');
  const [isVerified, setIsVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // --- Chat State ---
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [emotion, setEmotion] = useState('neutral');
  const [intimacy, setIntimacy] = useState(50);
  const messagesEndRef = useRef(null);
  
  // Session ID
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem('session_id');
    if (saved) return saved;
    const newId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('session_id', newId);
    return newId;
  });

  // --- Initial Verification Check ---
  useEffect(() => {
    if (accessCode) {
      verifyCode(accessCode, true);
    }
  }, []);

  const verifyCode = async (code, silent = false) => {
    if (!silent) setVerifyLoading(true);
    setVerifyError('');
    try {
      await axios.post(`${API_BASE}/api/verify`, { access_code: code });
      setIsVerified(true);
      localStorage.setItem('access_code', code);
      setAccessCode(code);
    } catch (error) {
      if (!silent) setVerifyError('Invalid Access Code');
      setIsVerified(false);
    } finally {
      if (!silent) setVerifyLoading(false);
    }
  };

  // --- Load Data (Only if verified) ---
  useEffect(() => {
    if (!isVerified) return;

    const loadData = async () => {
      try {
        const [histRes, stateRes] = await Promise.all([
          axios.get(`${API_BASE}/api/history/${sessionId}`),
          axios.get(`${API_BASE}/api/state/${sessionId}`)
        ]);
        setMessages(histRes.data);
        setEmotion(stateRes.data.emotion);
        setIntimacy(stateRes.data.intimacy);
      } catch (error) {
        console.error("Failed to load data", error);
      }
    };
    loadData();
    scrollToBottom();
  }, [sessionId, isVerified]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleReset = async () => {
    if (!window.confirm("确定要清除所有对话记录并重置状态吗？此操作不可撤销。")) return;
    
    try {
      await axios.post(`${API_BASE}/api/reset`, { 
        session_id: sessionId,
        access_code: accessCode
      });
      setMessages([]);
      setEmotion('neutral');
      setIntimacy(50);
    } catch (error) {
      console.error("Reset failed", error);
      alert("重置失败，请检查网络或权限");
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setLoading(true);

    // Optimistic Update
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);

    try {
      // Create placeholder for AI response
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          session_id: sessionId, 
          message: userMsg,
          access_code: accessCode // Send access code with chat
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          setIsVerified(false);
          setVerifyError("Session expired or invalid code.");
          throw new Error("Unauthorized");
        }
        throw new Error("Network response was not ok");
      }
      
      if (!response.body) throw new Error("No response body");
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        aiContent += chunk;
        
        // Update last message (AI)
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: aiContent };
          return updated;
        });
      }
      
      // Refresh state
      setTimeout(async () => {
        try {
          const stateRes = await axios.get(`${API_BASE}/api/state/${sessionId}`);
          setEmotion(stateRes.data.emotion);
          setIntimacy(stateRes.data.intimacy);
        } catch (error) {
           console.error("Failed to update state", error);
        }
      }, 2000);

    } catch (error) {
      console.error("Chat error", error);
      setMessages(prev => {
         // Remove the empty placeholder if error occurred immediately
         if (prev.length > 0 && prev[prev.length-1].role === 'assistant' && prev[prev.length-1].content === '') {
             return prev.slice(0, -1);
         }
         return [...prev, { role: 'assistant', content: "Error: Failed to get response." }];
      });
    } finally {
      setLoading(false);
    }
  };

  // --- Login Screen ---
  if (!isVerified) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md text-center">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
          <p className="text-gray-500 mb-6">Please enter access code to continue</p>
          
          <form onSubmit={(e) => { e.preventDefault(); verifyCode(accessCode); }}>
            <input
              type="password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Access Code"
              className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none text-center text-lg tracking-widest"
            />
            {verifyError && <p className="text-red-500 text-sm mb-4">{verifyError}</p>}
            <button
              type="submit"
              disabled={verifyLoading || !accessCode}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifyLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Chat UI ---
  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Header / Status Bar */}
      <StatusBar emotion={emotion} intimacy={intimacy} />
      
      {/* Reset Button (Absolute positioned or integrated into header) */}
      <button 
        onClick={handleReset}
        className="fixed top-20 right-4 z-20 bg-white/80 backdrop-blur p-2 rounded-full shadow-sm text-gray-500 hover:text-red-500 transition-colors"
        title="Reset Chat"
      >
        <RotateCcw className="w-5 h-5" />
      </button>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto pt-24 pb-20 px-4 max-w-2xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <p>Chat history cleared.</p>
            <p>Say hello to start a new conversation.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <ChatBubble key={idx} role={msg.role} content={msg.content} />
        ))}
        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start mb-4">
             <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Thinking...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-2xl mx-auto w-full">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 border-0 rounded-full px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full disabled:opacity-50 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
