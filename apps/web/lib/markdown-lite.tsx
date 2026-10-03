import { Fragment, type ReactNode } from 'react';

/** Renders the small markdown subset assistants produce: **bold**, `code`, bullets and line breaks. */
export function MarkdownLite({ text }: { text: string }) {
  const inline = (line: string): ReactNode[] =>
    line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="rounded bg-sunken px-1 text-[0.9em]">{part.slice(1, -1)}</code>;
      return <Fragment key={i}>{part}</Fragment>;
    });
  return (
    <div className="flex flex-col gap-1.5 leading-relaxed">
      {text.split('\n').map((line, i) => {
        const bullet = /^\s*([-*•]|\d+[.)])\s+(.*)$/.exec(line);
        if (bullet) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-lumi">•</span>
              <span>{inline(bullet[2])}</span>
            </div>
          );
        }
        if (/^#{1,3}\s/.test(line)) return <p key={i} className="font-semibold">{inline(line.replace(/^#+\s/, ''))}</p>;
        return line.trim() ? <p key={i}>{inline(line)}</p> : <span key={i} className="h-1" />;
      })}
    </div>
  );
}
