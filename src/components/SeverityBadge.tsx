import { Badge } from "@/components/Badge";

const ESTILOS: Record<string, { classe: string; ponto: string }> = {
  critica: { classe: "border-critica/30 bg-critica/10 text-critica", ponto: "bg-critica" },
  alta: { classe: "border-alta/30 bg-alta/10 text-alta", ponto: "bg-alta" },
  media: { classe: "border-media/30 bg-media/10 text-media", ponto: "bg-media" },
  baixa: { classe: "border-baixa/30 bg-baixa/10 text-baixa", ponto: "bg-baixa" },
};

const PADRAO = { classe: "border-borda bg-borda/40 text-texto-2", ponto: "bg-texto-2" };

export function SeverityBadge({ severidade }: { severidade: string }) {
  const estilo = ESTILOS[severidade.toLowerCase()] ?? PADRAO;

  return (
    <Badge className={estilo.classe}>
      <span className={`h-1.5 w-1.5 ${estilo.ponto}`} />
      {severidade}
    </Badge>
  );
}
