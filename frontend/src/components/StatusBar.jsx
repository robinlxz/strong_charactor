import React from 'react';
import { Heart, Smile } from 'lucide-react';

const StatusBar = ({ emotion, intimacy }) => {
  // Emotion color mapping
  const getEmotionColor = (emotion) => {
    const map = {
      happy: 'text-green-500',
      sad: 'text-blue-500',
      angry: 'text-red-500',
      neutral: 'text-gray-500',
      excited: 'text-yellow-500',
    };
    return map[emotion?.toLowerCase()] || 'text-gray-500';
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-b p-4 shadow-sm z-10 flex justify-between items-center max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Smile className={`w-6 h-6 ${getEmotionColor(emotion)}`} />
        <span className="font-medium capitalize">{emotion || 'Neutral'}</span>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-500">Intimacy</span>
          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-pink-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, intimacy))}%` }}
            />
          </div>
        </div>
        <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
        <span className="font-bold text-pink-600">{intimacy}</span>
      </div>
    </div>
  );
};

export default StatusBar;
