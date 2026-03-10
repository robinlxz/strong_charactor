import React from 'react';
import { clsx } from 'clsx';

const ChatBubble = ({ role, content }) => {
  const isUser = role === 'user';
  
  return (
    <div className={clsx(
      "flex w-full mb-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={clsx(
        "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
        isUser 
          ? "bg-blue-500 text-white rounded-br-none" 
          : "bg-white border border-gray-100 text-gray-800 rounded-bl-none"
      )}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  );
};

export default ChatBubble;
