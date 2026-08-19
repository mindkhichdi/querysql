import { Database, History, Moon, Sun } from "lucide-react";
import { useThemeStore } from "../../store/themeStore";

interface TitleBarProps {
  onToggleHistory: () => void;
  historyOpen: boolean;
}

export function TitleBar({ onToggleHistory, historyOpen }: TitleBarProps) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <div
      data-tauri-drag-region
      className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-[var(--qd-border)] bg-[var(--qd-bg-elevated)]"
    >
      <div data-tauri-drag-region className="flex items-center gap-1.5 pl-16">
        <Database size={14} className="text-[var(--qd-accent)]" />
        <span className="text-[12.5px] font-medium">QueryDeck</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleHistory}
          className={`w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:bg-[var(--qd-bg-inset)] ${
            historyOpen ? "text-[var(--qd-accent)]" : "text-[var(--qd-text-muted)]"
          }`}
          title="Query history"
        >
          <History size={14} />
        </button>
        <button
          onClick={toggle}
          className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:bg-[var(--qd-bg-inset)] text-[var(--qd-text-muted)]"
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </div>
  );
}
