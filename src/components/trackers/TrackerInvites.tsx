"use client";

import { useState } from "react";
import { InviteForm } from "@/components/trackers/InviteForm";
import { PendingInvites, type PendingInvite } from "@/components/trackers/PendingInvites";

interface RoleOption {
  id: string;
  name: string;
}

/**
 * Owns the single source of truth for the pending-invites list so a new or
 * resent invite shows up immediately — InviteForm and PendingInvites are
 * siblings with no DOM relationship, so this has to live above both rather
 * than relying on a server round trip (router.refresh() doesn't even
 * re-seed PendingInvites' state on its own, since useState only reads its
 * initial-value argument on mount).
 */
export function TrackerInvites({
  trackerId,
  roles,
  canManage,
  initialInvites,
}: {
  trackerId: string;
  roles: RoleOption[];
  canManage: boolean;
  initialInvites: PendingInvite[];
}) {
  const [invites, setInvites] = useState(initialInvites);

  function handleInvited(invite: PendingInvite) {
    // A resend replaces the old PENDING row for that address (the API
    // revokes-then-recreates) rather than appending a duplicate.
    setInvites((prev) => [invite, ...prev.filter((i) => i.email !== invite.email)]);
  }

  function handleRevoked(inviteId: string) {
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  return (
    <>
      {canManage && (
        <>
          <h3 style={{ marginBottom: 12 }}>Invite by email</h3>
          <div style={{ marginBottom: 32 }}>
            <InviteForm trackerId={trackerId} roles={roles} onInvited={handleInvited} />
          </div>
        </>
      )}

      <h3 style={{ marginBottom: 12 }}>Invited</h3>
      <PendingInvites trackerId={trackerId} invites={invites} canManage={canManage} onRevoked={handleRevoked} />
    </>
  );
}
