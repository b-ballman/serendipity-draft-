
import React from 'react';

interface StepWrapperProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

const StepWrapper: React.FC<StepWrapperProps> = ({ title, description, children }) => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-indigo-400">{title}</h2>
        <p className="text-gray-400 mt-2">{description}</p>
      </div>
      <div className="bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-700">
        {children}
      </div>
    </div>
  );
};

export default StepWrapper;
