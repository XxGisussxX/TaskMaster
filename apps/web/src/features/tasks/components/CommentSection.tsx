import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from "../hooks/useComments";
import { CommentItem } from "./CommentItem";
import type { Comment } from "@taskmaster/contracts";

export function CommentSection({
  taskId,
  readOnly = false,
}: {
  taskId: string;
  readOnly?: boolean;
}) {
  const { data: comments = [], isLoading } = useComments(taskId);
  const createComment = useCreateComment(taskId);
  const updateComment = useUpdateComment(taskId);
  const deleteComment = useDeleteComment(taskId);

  const [newBody, setNewBody] = useState("");
  const [newMentions, setNewMentions] = useState<string[]>([]);
  const [editing, setEditing] = useState<Comment | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editMentions, setEditMentions] = useState<string[]>([]);

  function handleCreate() {
    const body = newBody.trim();
    if (!body) return;
    createComment.mutate(
      { body, mentionedUserIds: newMentions },
      {
        onSuccess: () => {
          setNewBody("");
          setNewMentions([]);
        },
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreate();
    }
  }

  function startEdit(comment: Comment) {
    setEditing(comment);
    setEditBody(comment.body);
    setEditMentions(comment.mentionedUserIds ?? []);
  }

  function handleUpdate() {
    if (!editing) return;
    const body = editBody.trim();
    if (!body) return;
    updateComment.mutate(
      { commentId: editing.id, body, mentionedUserIds: editMentions },
      {
        onSuccess: () => {
          setEditing(null);
          setEditBody("");
          setEditMentions([]);
        },
      },
    );
  }

  function handleDelete(commentId: string) {
    if (window.confirm("¿Eliminar este comentario?")) {
      deleteComment.mutate(commentId);
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-muted-foreground">
        Comentarios ({comments.length})
      </h4>

      {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}

      {!isLoading && comments.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {readOnly
            ? "Sin comentarios."
            : "Sin comentarios. Sé el primero en comentar."}
        </p>
      )}

      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id}>
            {editing?.id === comment.id ? (
              <div className="space-y-2">
                <MentionTextarea
                  value={editBody}
                  onChange={setEditBody}
                  onMentionChange={setEditMentions}
                  className="min-h-[60px] text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    disabled={updateComment.isPending || !editBody.trim()}
                  >
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(null);
                      setEditBody("");
                      setEditMentions([]);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <CommentItem
                comment={comment}
                onEdit={startEdit}
                onDelete={handleDelete}
                readOnly={readOnly}
              />
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="space-y-2">
          <MentionTextarea
            value={newBody}
            onChange={setNewBody}
            onMentionChange={setNewMentions}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comentario… (Ctrl+Enter para enviar)"
            className="min-h-[60px] text-sm"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createComment.isPending || !newBody.trim()}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Comentar
          </Button>
        </div>
      )}
    </div>
  );
}
