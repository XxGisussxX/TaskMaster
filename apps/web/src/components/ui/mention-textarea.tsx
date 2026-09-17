import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from "react";
import getCaretCoordinates from "textarea-caret";
import { Avatar } from "@/components/ui/avatar";
import { useMentionSearch } from "@/features/tasks/hooks/useMentions";

interface MentionUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onMentionChange: (userIds: string[]) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}

const AT_RE = /@(\w*)$/;

export function MentionTextarea({
  value,
  onChange,
  onMentionChange,
  onKeyDown,
  placeholder,
  className,
  minRows = 2,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caretPos, setCaretPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const results = useMentionSearch(mentionQuery);

  const selectedUsers = useRef<Set<string>>(new Set());

  const detectMention = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const pos = ta.selectionStart;
    const textBefore = value.slice(0, pos);
    const match = AT_RE.exec(textBefore);

    if (match) {
      const query = match[1] ?? "";
      setMentionQuery(query);
      setShowDropdown(true);
      setSelectedIndex(0);

      const coords = getCaretCoordinates(ta, pos);
      setCaretPos({ top: coords.top + coords.height + 4, left: coords.left });
    } else {
      setShowDropdown(false);
      setMentionQuery("");
    }
  }, [value]);

  useEffect(() => {
    detectMention();
  }, [detectMention]);

  function insertMention(user: MentionUser) {
    const ta = textareaRef.current;
    if (!ta) return;

    const pos = ta.selectionStart;
    const textBefore = value.slice(0, pos);
    const match = AT_RE.exec(textBefore);
    if (!match) return;

    const matchStart = pos - match[0].length;
    const before = value.slice(0, matchStart);
    const after = value.slice(pos);
    const insertText = `@${user.name} `;

    const newValue = before + insertText + after;
    onChange(newValue);

    selectedUsers.current.add(user.id);
    onMentionChange(Array.from(selectedUsers.current));

    setShowDropdown(false);
    setMentionQuery("");

    requestAnimationFrame(() => {
      const newPos = matchStart + insertText.length;
      ta.selectionStart = newPos;
      ta.selectionEnd = newPos;
      ta.focus();
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (showDropdown && results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % results.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + results.length) % results.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(results[selectedIndex]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }
    onKeyDown?.(e);
  }

  function handleClickOutside(e: MouseEvent) {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(e.target as Node)
    ) {
      setShowDropdown(false);
    }
  }

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={minRows}
        className={
          className ??
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        }
      />
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-64 overflow-hidden rounded-md border bg-popover shadow-md"
          style={{ top: caretPos.top, left: 0 }}
        >
          {results.map((user: MentionUser, i: number) => (
            <button
              key={user.id}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                i === selectedIndex ? "bg-accent" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user);
              }}
            >
              <Avatar
                name={user.name}
                src={user.avatarUrl}
                className="h-5 w-5 text-[9px]"
              />
              <span className="truncate">{user.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
