import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import styled from 'styled-components';

const Wrap = styled.div`
  border: 1px solid #d1d5db;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  &:focus-within {
    border-color: var(--link-text);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
`;

const Sep = styled.div`
  width: 1px;
  height: 16px;
  background: #d1d5db;
  margin: 0 3px;
  flex-shrink: 0;
`;

const ToolBtn = styled.button`
  padding: 0.18rem 0.45rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background: ${p => p.$active ? '#dbeafe' : 'transparent'};
  color: ${p => p.$active ? '#1d4ed8' : '#374151'};
  font-size: 0.78rem;
  font-weight: ${p => p.$bold ? 700 : 500};
  font-style: ${p => p.$italic ? 'italic' : 'normal'};
  cursor: pointer;
  line-height: 1.5;
  white-space: nowrap;
  &:hover:not(:disabled) { background: #f3f4f6; border-color: #d1d5db; }
`;

const Content = styled.div`
  padding: 0.6rem 0.875rem;
  min-height: 120px;
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--text-primary, #111);

  .ProseMirror { outline: none; min-height: 100px; }
  .ProseMirror > * + * { margin-top: 0.6em; }
  .ProseMirror p { margin: 0; }
  .ProseMirror h2 { font-size: 1.15em; font-weight: 700; line-height: 1.3; }
  .ProseMirror h3 { font-size: 1em; font-weight: 600; line-height: 1.3; }
  .ProseMirror ul, .ProseMirror ol { padding-left: 1.4em; }
  .ProseMirror li + li { margin-top: 0.15em; }
  .ProseMirror strong { font-weight: 700; }
  .ProseMirror em { font-style: italic; }
  .ProseMirror s { text-decoration: line-through; }
  .ProseMirror hr { border: none; border-top: 1px solid #e5e7eb; margin: 0.75em 0; }
  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
    float: left;
    height: 0;
  }
`;

function Btn({ editor, label, title, active, cmd, $bold, $italic }) {
  return (
    <ToolBtn
      type="button"
      title={title}
      $active={active}
      $bold={$bold}
      $italic={$italic}
      onMouseDown={e => { e.preventDefault(); cmd(); }}
    >
      {label}
    </ToolBtn>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value changes (e.g. when event data loads after mount)
  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  const run = (cmd) => editor.chain().focus()[cmd]().run();

  return (
    <Wrap>
      <Toolbar>
        <Btn editor={editor} label="B" title="Bold" $bold active={editor.isActive('bold')} cmd={() => run('toggleBold')} />
        <Btn editor={editor} label="I" title="Italic" $italic active={editor.isActive('italic')} cmd={() => run('toggleItalic')} />
        <Btn editor={editor} label="S̶" title="Strikethrough" active={editor.isActive('strike')} cmd={() => run('toggleStrike')} />
        <Sep />
        <Btn editor={editor} label="H2" title="Heading 2" active={editor.isActive('heading', { level: 2 })} cmd={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Btn editor={editor} label="H3" title="Heading 3" active={editor.isActive('heading', { level: 3 })} cmd={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <Sep />
        <Btn editor={editor} label="• List" title="Bullet list" active={editor.isActive('bulletList')} cmd={() => run('toggleBulletList')} />
        <Btn editor={editor} label="1. List" title="Numbered list" active={editor.isActive('orderedList')} cmd={() => run('toggleOrderedList')} />
        <Sep />
        <Btn editor={editor} label="—" title="Horizontal rule" active={false} cmd={() => run('setHorizontalRule')} />
      </Toolbar>
      <Content>
        <EditorContent editor={editor} />
      </Content>
    </Wrap>
  );
}
