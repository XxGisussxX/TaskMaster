import type { Comment } from "@taskmaster/contracts";
import { Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import { formatRelativeTime } from "@/lib/date";

export function CommentItem({
  comment,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const isOwner = currentUser?.id === comment.userId;

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
          {comment.body}
        </p>
      </div>
    </div>
  );
}
