"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { CONFIG_LABELS, type ConfigRow } from "@/lib/dashboard";

interface SettingsPanelProps {
  rows: ConfigRow[];
  /** Admins only; without it the values are shown read-only. */
  save?: (key: string, value: number) => void;
  isPending: (key: string) => boolean;
  errors: Readonly<Record<string, string>>;
}

function ReadOnlyRow({ row }: { row: ConfigRow }) {
  const meta = CONFIG_LABELS[row.key] ?? { label: row.key, unit: "" };
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 border-b border-line py-3 last:border-b-0">
      <span className="min-w-0 flex-1 font-semibold">{meta.label}</span>
      <span className="num">{Number(row.value)}</span>
      <span className="w-10 text-sm text-muted">{meta.unit}</span>
      {row.description ? <p className="w-full text-sm text-muted">{row.description}</p> : null}
    </li>
  );
}

function SettingRow({
  row,
  save,
  pending,
  error,
}: {
  row: ConfigRow;
  save: NonNullable<SettingsPanelProps["save"]>;
  pending: boolean;
  error?: string;
}) {
  const [draft, setDraft] = useState(String(row.value));
  const [savedValue, setSavedValue] = useState(row.value);
  // Follow live changes from other screens unless the user is mid-edit.
  if (row.value !== savedValue) {
    setSavedValue(row.value);
    setDraft(String(row.value));
  }

  const meta = CONFIG_LABELS[row.key] ?? { label: row.key, unit: "" };
  const parsed = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  const changed = valid && parsed !== Number(row.value);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (changed) save(row.key, parsed);
  };

  return (
    <li className="border-b border-line py-3 last:border-b-0">
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label htmlFor={`cfg-${row.key}`} className="min-w-0 flex-1 font-semibold">
          {meta.label}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`cfg-${row.key}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!valid}
            className="num h-11 w-24 rounded-card border border-line bg-paper px-3 text-right aria-invalid:border-danger"
          />
          <span className="w-10 text-sm text-muted">{meta.unit}</span>
          <Button type="submit" variant={changed ? "ink" : "secondary"} disabled={!changed} pending={pending}>
            Save
          </Button>
        </div>
        {row.description ? <p className="w-full text-sm text-muted">{row.description}</p> : null}
      </form>
      {error ? (
        <p role="alert" className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

const ORDER = Object.keys(CONFIG_LABELS);
const rank = (key: string) => (ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length);
const byLabelOrder = (a: ConfigRow, b: ConfigRow) => rank(a.key) - rank(b.key);

/** Inline editor for the dispatch rules in the config table. */
export function SettingsPanel({ rows, save, isPending, errors }: SettingsPanelProps) {
  return (
    <section className="rounded-card border border-line bg-surface p-5" aria-labelledby="settings-title">
      <h2 id="settings-title" className="text-lg">
        Settings
      </h2>
      <p className="text-sm text-muted">
        Dispatch rules. {save ? "Changes apply on the next run." : "Only an admin can change them."}
      </p>
      <ul className="mt-2">
        {[...rows].sort(byLabelOrder).map((row) =>
          save ? (
            <SettingRow
              key={row.key}
              row={row}
              save={save}
              pending={isPending(`config-${row.key}`)}
              error={errors[`config-${row.key}`]}
            />
          ) : (
            <ReadOnlyRow key={row.key} row={row} />
          ),
        )}
      </ul>
    </section>
  );
}
