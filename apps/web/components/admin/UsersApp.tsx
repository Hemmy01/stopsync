"use client";

import Link from "next/link";
import { useState } from "react";
import { AccountBadge } from "@/components/auth/AccountBadge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Wordmark } from "@/components/Wordmark";
import { isRole, ROLE_LABEL, ROLES, type Role } from "@/lib/auth";
import type { Tables } from "@/lib/database.types";
import { setUserRole } from "@/lib/rpc";
import { getSupabase, type StopSyncClient } from "@/lib/supabase";
import { useAccount } from "@/lib/use-account";
import { useActions } from "@/lib/use-actions";
import { unwrap, useRealtimeData, type RealtimeTable } from "@/lib/use-realtime-data";

type Profile = Tables<"profiles">;

const TABLES: readonly RealtimeTable[] = ["profiles"];

async function loadUsers(supabase: StopSyncClient) {
  const [profiles, buses] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("buses").select("id").order("id"),
  ]);
  return { profiles: unwrap(profiles), busIds: unwrap(buses).map((b) => b.id) };
}

const SELECT = "h-11 rounded-card border border-line bg-paper px-3 font-semibold";

function UserRow({ profile, busIds, isMe }: { profile: Profile; busIds: string[]; isMe: boolean }) {
  const current: Role = isRole(profile.role) ? profile.role : "viewer";
  const [role, setRole] = useState<Role>(current);
  const [bus, setBus] = useState(profile.bus_id ?? "");
  const [saved, setSaved] = useState({ role: current, bus: profile.bus_id ?? "" });
  const { run, isPending, errors } = useActions();
  // Follow changes made elsewhere unless this row is being edited.
  if (saved.role !== current || saved.bus !== (profile.bus_id ?? "")) {
    setSaved({ role: current, bus: profile.bus_id ?? "" });
    setRole(current);
    setBus(profile.bus_id ?? "");
  }

  const changed = role !== current || (role === "driver" && bus !== (profile.bus_id ?? ""));
  const valid = role !== "driver" || bus !== "";
  const key = `role-${profile.id}`;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-4 last:border-b-0">
      <div className="min-w-[220px] flex-1">
        <p className="font-semibold">
          {profile.name ?? profile.email}
          {isMe ? <span className="ml-2 text-sm font-normal text-muted">(you)</span> : null}
        </p>
        <p className="text-sm text-muted">{profile.email}</p>
      </div>
      <label className="sr-only" htmlFor={`role-${profile.id}`}>
        Role for {profile.email}
      </label>
      <select
        id={`role-${profile.id}`}
        className={SELECT}
        value={role}
        disabled={isMe}
        onChange={(e) => setRole(e.target.value as Role)}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {role === "driver" ? (
        <>
          <label className="sr-only" htmlFor={`bus-${profile.id}`}>
            Bus for {profile.email}
          </label>
          <select id={`bus-${profile.id}`} className={SELECT} value={bus} onChange={(e) => setBus(e.target.value)}>
            <option value="">Choose a bus</option>
            {busIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {isMe ? (
        <span className="text-sm text-muted">You can&rsquo;t change your own role</span>
      ) : (
        <Button
          variant={changed && valid ? "ink" : "secondary"}
          disabled={!changed || !valid}
          pending={isPending(key)}
          onClick={() => void run(key, () => setUserRole(getSupabase(), profile.id, role, role === "driver" ? bus : null))}
        >
          Save
        </Button>
      )}
      {errors[key] ? (
        <p role="alert" className="w-full text-sm font-semibold text-danger">
          {errors[key]}
        </p>
      ) : null}
    </li>
  );
}

/** Admins give people roles; new sign-ups start as viewers. */
export function UsersApp() {
  const account = useAccount();
  const { data, loading, error } = useRealtimeData(TABLES, loadUsers);

  return (
    <div className="mx-auto min-h-dvh max-w-4xl px-4 pb-12 sm:px-8">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line py-4">
        <Link href="/" aria-label="Tap&Select home">
          <Wordmark />
        </Link>
        <h1 className="text-[28px]">Users</h1>
        <Link href="/dashboard" className="font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
          Dashboard
        </Link>
        <AccountBadge className="ml-auto" />
      </header>

      <main className="pt-6">
        <p className="max-w-2xl text-muted">
          Anyone can create an account at <span className="num text-ink">/login</span>; they start as a viewer. Give
          them a role here. A driver is linked to one bus and can only move that bus.
        </p>

        {error ? (
          <Banner tone="danger" title="Can't load users" className="mt-6">
            {error}
          </Banner>
        ) : null}
        {loading && !data ? <p className="mt-6 text-muted">Loading users…</p> : null}

        {data ? (
          <section aria-label="Users" className="mt-6 rounded-card border border-line bg-surface px-5">
            <ul>
              {data.profiles.map((p) => (
                <UserRow key={p.id} profile={p} busIds={data.busIds} isMe={p.id === account.userId} />
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
