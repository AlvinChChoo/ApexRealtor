import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PerformanceGaugeProps {
  current: number;
  target: number;
  title: string;
}

const PerformanceGauge: React.FC<PerformanceGaugeProps> = ({ current, target, title }) => {
  const percentage = Math.min((current / target) * 100, 100);
  const isAboveTarget = current > target;
  const circumference = 2 * Math.PI * 45;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">{title}</h3>
      
      <div className="relative flex items-center justify-center">
        <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-gray-200"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-1000 ease-out ${
              percentage >= 80 ? 'text-green-500' : 
              percentage >= 60 ? 'text-yellow-500' : 
              'text-red-500'
            }`}
          />
        </svg>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-800">
            {percentage.toFixed(0)}%
          </span>
          <span className="text-sm text-gray-500">Complete</span>
        </div>
      </div>
      
      <div className="mt-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Current:</span>
          <span className="font-semibold text-gray-800">
            
            
            ${current.toLocaleString()}
            
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Target:</span>
          <span className="font-semibold text-gray-800">
            ${target.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-600">Status:</span>
          <div className="flex items-center space-x-1">
            {isAboveTarget ? (
              <>
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-600">Above Target</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-600">Below Target</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceGauge;