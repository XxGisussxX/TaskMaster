import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListChecks,
  Heading1,
  Heading2,
  Heading3,
  LinkIcon,
  Undo,
  Redo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCallback, useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escribe aquí…",
  className,
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
    ],
    content: value,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[120px] px-3 py-2 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL del enlace", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-md border border-border", className)}>
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1">
          <ToolbarButton
            icon={<Bold className="size-4" />}
            isActive={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            tooltip="Negrita"
          />
          <ToolbarButton
            icon={<Italic className="size-4" />}
            isActive={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            tooltip="Cursiva"
          />
          <ToolbarButton
            icon={<Strikethrough className="size-4" />}
            isActive={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            tooltip="Tachado"
          />
          <ToolbarButton
            icon={<Code className="size-4" />}
            isActive={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
            tooltip="Código"
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            icon={<Heading1 className="size-4" />}
            isActive={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            tooltip="Encabezado 1"
          />
          <ToolbarButton
            icon={<Heading2 className="size-4" />}
            isActive={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            tooltip="Encabezado 2"
          />
          <ToolbarButton
            icon={<Heading3 className="size-4" />}
            isActive={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            tooltip="Encabezado 3"
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            icon={<List className="size-4" />}
            isActive={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            tooltip="Lista"
          />
          <ToolbarButton
            icon={<ListOrdered className="size-4" />}
            isActive={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            tooltip="Lista numerada"
          />
          <ToolbarButton
            icon={<ListChecks className="size-4" />}
            isActive={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            tooltip="Lista de tareas"
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            icon={<LinkIcon className="size-4" />}
            isActive={editor.isActive("link")}
            onClick={setLink}
            tooltip="Enlace"
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            icon={<Undo className="size-4" />}
            isActive={false}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            tooltip="Deshacer"
          />
          <ToolbarButton
            icon={<Redo className="size-4" />}
            isActive={false}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            tooltip="Rehacer"
          />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  icon,
  isActive,
  onClick,
  disabled,
  tooltip,
}: {
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  tooltip: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-7", isActive && "bg-accent text-accent-foreground")}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
    >
      {icon}
    </Button>
  );
}
