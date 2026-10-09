import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  dica?: string;
  obrigatorio?: boolean;
};

export function Field({
  label,
  htmlFor,
  children,
  dica,
  obrigatorio,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="font-mono text-[11px] font-medium uppercase tracking-wider text-texto-2"
      >
        {label}
        {obrigatorio && <span className="ml-1 text-accent">*</span>}
      </label>
      {children}
      {dica && <p className="font-mono text-[11px] text-texto-2/70">{dica}</p>}
    </div>
  );
}

const CONTROLE =
  "w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto " +
  "placeholder:text-texto-2/50 transition-colors duration-200 " +
  "hover:border-texto-2/40 " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROLE} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${CONTROLE} resize-y leading-relaxed ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${CONTROLE} cursor-pointer appearance-none bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      }}
      {...props}
    />
  );
}
