import React from 'react';

interface CommandEditorProps {
  value: string;
  onChange: (newValue: string) => void;
}

export const CommandEditor: React.FC<CommandEditorProps> = ({ value, onChange }) => {
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      className="w-full h-full p-2 border rounded font-mono text-sm bg-gray-800 text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Enter Redis commands (e.g., GET mykey, SET mykey value)"
      spellCheck="false"
    />
  );
};
