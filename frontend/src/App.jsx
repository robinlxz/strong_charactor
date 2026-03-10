import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import StatusBar from './components/StatusBar';
import ChatBubble from './components/ChatBubble';
import { Send, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function App() {
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load Initial Data
  useEffect(() => {
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
  }, [sessionId]);

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
        body: JSON.stringify({ session_id: sessionId, message: userMsg })
      });

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
      
      // After chat, refresh state (since backend updates it in background)
      // Wait a bit or poll? Let's wait 1s.
      setTimeout(async () => {
        const stateRes = await axios.get(`${API_BASE}/api/state/${sessionId}`);
        setEmotion(stateRes.data.emotion);
        setIntimacy(stateRes.data.intimacy);
      }, 2000);

    } catch (error) {
      console.error("Chat error", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: Failed to get response." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Header / Status Bar */}
      <StatusBar emotion={emotion} intimacy={intimacy} />
      
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto pt-24 pb-20 px-4 max-w-2xl mx-auto w-full">
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
