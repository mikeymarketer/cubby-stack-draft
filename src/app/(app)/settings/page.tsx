import { createClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/supabase/types";
import { User, Building2, Mail, Shield } from "lucide-react";

type MembershipData = {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces: { name: string } | null;
} | null;

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rawMembership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const membership = rawMembership as MembershipData;
  const workspaceName = membership?.workspaces?.name ?? "—";
  const displayName = user?.email?.split("@")[0] ?? "—";

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and workspace</p>
      </div>

      {/* Account section */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Account
        </h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Display name</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{displayName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground mt-0.5 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Workspace section */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Workspace
        </h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Workspace name</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{workspaceName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Your role</p>
              <p className="text-sm font-medium text-foreground mt-0.5 capitalize">
                {membership?.role ?? "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Danger zone placeholder */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Danger zone
        </h2>
        <div className="rounded-xl border border-red-500/20 bg-card px-5 py-4">
          <p className="text-sm font-medium text-foreground">Delete account</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permanently delete your account and all associated data.
          </p>
          <button
            disabled
            className="mt-3 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium opacity-40 cursor-not-allowed"
          >
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
