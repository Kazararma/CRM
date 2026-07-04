import React from 'react';

const ImportModeToggle = ({ mode, onChange }) => {
  return (
    <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
      <button
        onClick={() => onChange('manual')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          mode === 'manual'
            ? 'bg-white text-gray-900 shadow'
            : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        Manual
      </button>
      <button
        onClick={() => onChange('automatic')}
        title="Valid leads will be committed instantly after AI filtering. Errors will still require review."
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          mode === 'automatic'
            ? 'bg-white text-gray-900 shadow'
            : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        Automatic
      </button>
    </div>
  );
};

export default ImportModeToggle;
