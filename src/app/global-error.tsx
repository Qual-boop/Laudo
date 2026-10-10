"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <head>
        <title>Erro crítico — Laudo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{
          __html: `
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f0f0f; color: #e5e5e5; padding: 1rem; }
            .container { text-align: center; max-width: 400px; }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
            p { font-size: 0.875rem; color: #a3a3a3; margin-bottom: 1.5rem; }
            button { background: #22c55e; color: #0f0f0f; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; }
            button:hover { background: #16a34a; }
            .digest { font-family: monospace; font-size: 0.75rem; color: #ef4444; margin-top: 0.5rem; }
          `
        }} />
      </head>
      <body>
        <div className="container">
          <div className="icon" aria-hidden="true">💥</div>
          <h1>Erro crítico na aplicação</h1>
          <p>Algo deu muito errado. A aplicação não pode continuar.</p>
          <button onClick={reset}>Recarregar aplicação</button>
          {error.digest && <p className="digest">{error.digest}</p>}
        </div>
      </body>
    </html>
  );
}