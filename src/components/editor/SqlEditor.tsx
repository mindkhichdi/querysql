import { autocompletion } from "@codemirror/autocomplete";
import { keymap, type ViewUpdate } from "@codemirror/view";
import { sql, SQLite } from "@codemirror/lang-sql";
import { Prec } from "@codemirror/state";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo, useRef } from "react";
import { createSqlCompletionSource } from "../../lib/sqlAutocomplete";
import { useConnectionStore } from "../../store/connectionStore";
import { useThemeStore } from "../../store/themeStore";

interface SqlEditorProps {
  connectionId: string;
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onCursorChange?: (pos: number) => void;
}

export function SqlEditor({ connectionId, value, onChange, onRun, onCursorChange }: SqlEditorProps) {
  const theme = useThemeStore((s) => s.theme);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  const extensions = useMemo(() => {
    const getSchema = () => useConnectionStore.getState().schemas[connectionId];
    return [
      sql({ dialect: SQLite }),
      autocompletion({ override: [createSqlCompletionSource(getSchema)] }),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRunRef.current();
              return true;
            },
          },
        ]),
      ),
    ];
  }, [connectionId]);

  function handleUpdate(update: ViewUpdate) {
    if (update.selectionSet && onCursorChange) {
      onCursorChange(update.state.selection.main.head);
    }
  }

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onUpdate={handleUpdate}
      extensions={extensions}
      theme={theme}
      height="100%"
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        autocompletion: true,
      }}
      className="h-full"
    />
  );
}
