import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { api } from "../lib/api";
import { createId } from "../lib/utils";
import type { EnvironmentVariable } from "../types";
import { useWorkspace } from "../workspace-context";
import { Button } from "../components/ui";
import { useI18n } from "../i18n";

export function EnvironmentPage() {
  const { snapshot, refresh } = useWorkspace();
  const { t } = useI18n();
  const form = useForm<{ variables: EnvironmentVariable[] }>({
    defaultValues: { variables: snapshot.environmentVariables },
  });
  const { reset } = form;
  const fields = useFieldArray({ control: form.control, name: "variables" });

  useEffect(() => {
    reset({ variables: snapshot.environmentVariables });
  }, [reset, snapshot.environmentVariables, snapshot.selectedWorkspaceId]);

  const save = form.handleSubmit(async ({ variables }) => {
    const normalized = variables.map((variable, position) => ({
      ...variable,
      workspaceId: snapshot.selectedWorkspaceId,
      position,
    }));
    await api.saveEnvironments(snapshot.selectedWorkspaceId, normalized);
    form.reset({ variables: normalized });
    await refresh();
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t("environment")}</h1>
          <p>{t("environmentDescription")}</p>
        </div>
        <Button variant="primary" disabled={!form.formState.isDirty} onClick={() => void save()}>
          <Save size={15} />{t("saveChanges")}
        </Button>
      </header>
      <div className="page-content">
        <table className="environment-table">
          <thead><tr><th style={{ width: 46 }}>{t("use")}</th><th>{t("variable")}</th><th>{t("initialValue")}</th><th>{t("currentValue")}</th><th style={{ width: 48 }} /></tr></thead>
          <tbody>
            {fields.fields.map((field, index) => (
              <tr key={field.id}>
                <td style={{ textAlign: "center" }}><input type="checkbox" {...form.register(`variables.${index}.active`)} /></td>
                <td><input className="input mono" placeholder="API_BASE_URL" {...form.register(`variables.${index}.key`)} /></td>
                <td><input className="input mono" {...form.register(`variables.${index}.initialValue`)} /></td>
                <td><input className="input mono" {...form.register(`variables.${index}.currentValue`)} /></td>
                <td><Button size="icon" variant="ghost" onClick={() => fields.remove(index)} aria-label={t("removeVariable")}><Trash2 size={14} /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button
          size="compact"
          variant="ghost"
          style={{ marginTop: 10 }}
          onClick={() =>
            fields.append({
              id: createId("environment"),
              workspaceId: snapshot.selectedWorkspaceId,
              active: true,
              key: "",
              initialValue: "",
              currentValue: "",
              position: fields.fields.length,
            })
          }
        >
          <Plus size={14} />{t("addVariable")}
        </Button>
      </div>
    </div>
  );
}
