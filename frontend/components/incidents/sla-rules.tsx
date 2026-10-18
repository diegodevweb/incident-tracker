"use client";

import { useEffect, useState } from "react";
import { fetchSlaRules } from "@/lib/api";
import { getIncidentPriorityLabel } from "@/lib/labels";
import type { IncidentLevel, IncidentSource, SlaRule } from "@/lib/types";
import { businessHoursNote } from "./incident-sla";

// A tabela não muda durante a sessão: uma busca serve todas as telas.
let slaRulesRequest: Promise<SlaRule[]> | null = null;

/** Níveis de criticidade com o prazo de primeira resposta; null enquanto carrega. */
export function useSlaRules() {
  const [rules, setRules] = useState<SlaRule[] | null>(null);

  useEffect(() => {
    let active = true;

    slaRulesRequest ??= fetchSlaRules().catch((error: unknown) => {
      slaRulesRequest = null;
      throw error;
    });
    slaRulesRequest
      .then((data) => {
        if (active) setRules(data);
      })
      .catch(() => {
        if (active) setRules([]);
      });

    return () => {
      active = false;
    };
  }, []);

  return rules;
}

/** O que cada criticidade quer dizer, destacando a do chamado quando houver. */
export function SlaRuleList({
  rules,
  source = "DASHBOARD",
  current,
}: {
  rules: SlaRule[] | null;
  source?: IncidentSource;
  current?: IncidentLevel | "";
}) {
  if (!rules) {
    return <p className="text-sm text-base-content/60">Carregando níveis...</p>;
  }

  if (!rules.length) {
    return (
      <p className="text-sm text-base-content/60">
        Não foi possível carregar os níveis de criticidade.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {rules.map((rule) => (
          <li
            key={rule.priority}
            className={`rounded-2xl border p-3 text-sm ${
              rule.priority === current
                ? "border-primary/40 bg-primary/5"
                : "app-surface-muted"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {getIncidentPriorityLabel(rule.priority, source)}
              </span>
              <span className="text-base-content/60">
                Primeira resposta {rule.firstResponseTarget}
              </span>
            </div>
            <p className="mt-1">{rule.title}</p>
            <p className="mt-1 text-base-content/60">{rule.description}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-base-content/60">{businessHoursNote}</p>
    </div>
  );
}
