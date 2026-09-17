import { useMemo } from "react";
import type { Comment } from "@taskmaster/contracts";
import { Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import { formatRelativeTime } from "@/lib/date";

function parseMentionBody(body: string) {
  const parts: { type: "text" | "mention"; value: string }[] = [];
  const re = /@(\S+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: body.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mention", value: match[1]! });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) {
    parts.push({ type: "text", value: body.slice(lastIndex) });
  }

  return parts;
}

export function CommentItem({
  comment,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  comment: Comment;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
  readOnly?: boolean;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const isOwner = currentUser?.id === comment.userId && !readOnly;

  const parts = useMemo(() => parseMentionBody(comment.body), [comment.body]);

  return (
    <div className="group flex gap-3">
      <Avatar
        name={comment.user?.name ?? "U"}
        src={comment.user?.avatarUrl}
        className="mt-0.5 h-7 w-7 text-[10px]"
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {comment.user?.name ?? "Usuario"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {isOwner && (
            <div className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEdit(comment)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {parts.map((part, i) =>
            part.type === "mention" ? (
              <span
                key={i}
                className="inline-block rounded bg-blue-100 px-1 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              >
                @{part.value}
              </span>
            ) : (
              <span key={i}>{part.value}</span>
            ),
          )}
        </p>
      </div>
    </div>
  );
}
