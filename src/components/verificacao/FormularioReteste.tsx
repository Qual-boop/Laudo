import { useState } from "react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import type { AchadoVerificavel, ResultadoReteste } from "@/lib/tipos";

type Props = {
  achado: AchadoVerificavel;
  onCancelar: () => void;
  onSalvo: (achado: AchadoVerificavel) => void;
};

const RESULTADOS: { valor: ResultadoReteste; rotulo: string }[] = [
  { valor: "corrigido", rotulo: "Corrigido" },
  { valor: "nao-corrigido", rotulo: "Não corrigido" },
  { valor: "parcial", rotulo: "Parcial" },
];

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FormularioReteste({ achado, onCancelar, onSalvo }: Props) {
  const [dataReteste, setDataReteste] = useState(
    achado.data_reteste_sugerida || hoje(),
  );
  const [resultado, setResultado] = useState<ResultadoReteste>("corrigido");
  const [evidencia, setEvidencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function registrar() {
    if (!evidencia.trim()) {
      setErro(
        "Registre a evidência do reteste — é ela que comprova a correção.",
      );
      return;
    }

    setErro(null);
    setEnviando(true);

    try {
      const res = await fetch("/api/verificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          achadoId: achado.id,
          dataReteste,
          resultado,
          evidencia,
        }),
      });
      const corpo = await res.json().catch(() => null);

      if (!res.ok) {
        setErro(corpo?.error ?? "Não foi possível registrar o reteste.");
        return;
      }

      onSalvo(corpo.achado as AchadoVerificavel);
    } catch {
      setErro("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="border-accent/40">
      <header className="border-b border-borda px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
          registrar reteste
        </p>
        <p className="mt-1 text-sm font-medium text-texto">{achado.titulo}</p>
        <p className="mt-0.5 font-mono text-[11px] text-texto-2">
          {achado.achado_ref}
        </p>
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        {erro && <Alert tom="erro">{erro}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Data do reteste" htmlFor={`data-${achado.id}`}>
            <Input
              id={`data-${achado.id}`}
              type="date"
              className="font-mono text-xs"
              value={dataReteste}
              onChange={(e) => setDataReteste(e.target.value)}
            />
          </Field>

          <Field label="Resultado" htmlFor={`resultado-${achado.id}`}>
            <Select
              id={`resultado-${achado.id}`}
              className="font-mono text-xs"
              value={resultado}
              onChange={(e) => setResultado(e.target.value as ResultadoReteste)}
            >
              {RESULTADOS.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.rotulo}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Evidência do reteste"
          htmlFor={`evidencia-${achado.id}`}
          dica="o que você fez para comprovar a correção"
        >
          <Textarea
            id={`evidencia-${achado.id}`}
            rows={3}
            className="font-mono text-xs leading-relaxed"
            placeholder="POST /login?user=admin' OR '1'='1  →  HTTP/1.1 400 Bad Request (payload bloqueado)"
            value={evidencia}
            onChange={(e) => setEvidencia(e.target.value)}
          />
        </Field>

        {resultado === "parcial" && (
          <Alert tom="erro">
            Um reteste parcial não marca o achado como verificado — ele continua
            em aberto.
          </Alert>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variante="primaria"
            onClick={registrar}
            disabled={enviando}
            className="sm:flex-1"
          >
            {enviando ? (
              <>
                <Spinner />
                registrando...
              </>
            ) : (
              "registrar reteste"
            )}
          </Button>
          <Button variante="secundaria" onClick={onCancelar} disabled={enviando}>
            cancelar
          </Button>
        </div>
      </div>
    </Card>
  );
}
