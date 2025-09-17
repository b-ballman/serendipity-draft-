import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({ label, helperText, ...props }) => (
  <div>
    <label className="block mb-2 text-sm font-medium text-gray-300">{label}</label>
    <input
      {...props}
      className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 placeholder-gray-400"
    />
    {helperText && <p className="mt-1 text-xs text-gray-400">{helperText}</p>}
  </div>
);

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, ...props }) => (
  <div>
    <label className="block mb-2 text-sm font-medium text-gray-300">{label}</label>
    <textarea
      {...props}
      rows={4}
      className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 placeholder-gray-400"
    />
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, children, ...props }) => (
  <div>
    <label className="block mb-2 text-sm font-medium text-gray-300">{label}</label>
    <select
      {...props}
      className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
    >
      {children}
    </select>
  </div>
);


interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ children, isLoading = false, ...props }) => (
  <button
    {...props}
    disabled={isLoading || props.disabled}
    className="w-full text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-500 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
  >
    {isLoading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    )}
    {isLoading ? 'Processing...' : children}
  </button>
);
