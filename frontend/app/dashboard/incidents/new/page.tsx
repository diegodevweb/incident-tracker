import { Topbar } from "@/components/dashboard/topbar";
import { NewIncidentForm } from "@/components/incidents/new-incident-form";

export default function NewIncidentPage() {
  return (
    <div>
      <Topbar
        title="Novo ticket"
        subtitle="Abertura manual de incidente com contexto, ambiente afetado e evidências."
      />

      <div className="p-6">
        <NewIncidentForm />
      </div>
    </div>
  );
}
