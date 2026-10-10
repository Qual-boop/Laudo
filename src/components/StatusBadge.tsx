import { Badge } from "@/components/Badge";
import { ESTILO_STATUS, ROTULO_STATUS } from "@/lib/verificacao";
import type { StatusVerificacao } from "@/lib/tipos";

export function StatusBadge({ status }: { status: StatusVerificacao }) {
  return <Badge className={ESTILO_STATUS[status]}>{ROTULO_STATUS[status]}</Badge>;
}
