"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markdown styled for the instrument theme: tables, code, headings. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md text-[14px] leading-relaxed text-ink-dim">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="font-display font-bold text-xl text-ink mt-6 mb-3 first:mt-0" {...p} />,
          h2: (p) => <h2 className="font-display font-semibold text-lg text-ink mt-6 mb-2" {...p} />,
          h3: (p) => <h3 className="font-display font-semibold text-base text-ink mt-5 mb-2" {...p} />,
          p: (p) => <p className="my-3" {...p} />,
          ul: (p) => <ul className="my-3 ml-5 list-disc space-y-1.5 marker:text-ink-faint" {...p} />,
          ol: (p) => <ol className="my-3 ml-5 list-decimal space-y-1.5 marker:text-ink-faint" {...p} />,
          a: (p) => <a className="text-amber underline-offset-2 hover:underline" {...p} />,
          strong: (p) => <strong className="text-ink font-semibold" {...p} />,
          code: (p) => <code className="tnum text-[12.5px] bg-panel-2 text-cyan px-1 py-0.5" {...p} />,
          pre: (p) => (
            <pre className="tnum text-[12.5px] bg-base border border-line p-3 my-3 overflow-x-auto" {...p} />
          ),
          table: (p) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full text-[13px] border border-line" {...p} />
            </div>
          ),
          thead: (p) => <thead className="bg-panel-2" {...p} />,
          th: (p) => <th className="text-left label px-3 py-2 border-b border-line" {...p} />,
          td: (p) => <td className="tnum px-3 py-1.5 border-b border-line/60 text-ink-dim" {...p} />,
          blockquote: (p) => <blockquote className="border-l-2 border-amber/50 pl-4 my-3 text-ink-faint" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
