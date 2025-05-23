import React from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { useThemeStore } from '@/store/useThemeStore'; // To match theme with the app

interface JsonEditorProps {
  value: string;
  onChange: (newValue: string | undefined) => void;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({ value, onChange }) => {
  const theme = useThemeStore((state) => state.theme);

  function handleEditorWillMount(monaco: Monaco) {
    // You can configure monaco instance here if needed
    // For example, register a new language or theme
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [], // You could add JSON schemas for validation if desired
    });
  }

  return (
    <Editor
      height="100%" // Ensure it fills the container
      width="100%"
      language="json"
      theme={theme === 'dark' ? 'vs-dark' : 'light'}
      value={value}
      onChange={onChange}
      options={{
        minimap: { enabled: false },
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
        glyphMargin: false,
        folding: true,
        lineNumbers: 'on',
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 3,
        scrollBeyondLastLine: false,
        automaticLayout: true, // Ensures editor resizes on container resize
        wordWrap: 'on', // Optional: enable word wrapping
      }}
      beforeMount={handleEditorWillMount}
    />
  );
};
