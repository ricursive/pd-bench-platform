export function InputsTable({ inputs }: { inputs: { path: string; contents: string }[] }) {
  return (
    <div className="border border-line">
      {inputs.map((i, idx) => (
        <div
          key={i.path}
          className={`grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-4 px-3 py-2.5 ${
            idx ? "border-t border-line/60" : ""
          }`}
        >
          <code className="tnum text-[12.5px] text-cyan break-words">{i.path}</code>
          <span className="text-[13px] text-ink-dim">{i.contents}</span>
        </div>
      ))}
    </div>
  );
}
