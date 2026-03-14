import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import {
  useGroup,
  useCreateInvite,
  useUpdateMemberRole,
  useRemoveMember,
} from '../lib/hooks';
import { useAuth } from '../lib/auth';

export function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useGroup(groupId!);
  const createInvite = useCreateInvite(groupId!);
  const updateRole = useUpdateMemberRole(groupId!);
  const removeMember = useRemoveMember(groupId!);

  const [copiedCode, setCopiedCode] = useState('');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="mt-6 h-64 animate-pulse rounded-lg bg-gray-200" />
        </main>
      </div>
    );
  }

  if (!data?.group) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-gray-500">Group not found.</p>
        </main>
      </div>
    );
  }

  const { group, userRole } = data;
  const isCoach = userRole === 'COACH';

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            {group.description && (
              <p className="mt-1 text-sm text-gray-500">{group.description}</p>
            )}
          </div>
          <button
            onClick={() => navigate(`/groups/${groupId}/training`)}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Training View
          </button>
        </div>

        {/* Invite section (coach only) */}
        {isCoach && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Invite Links</h3>
              <button
                onClick={() => createInvite.mutate({})}
                disabled={createInvite.isPending}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                Generate New Code
              </button>
            </div>
            {group.invites && group.invites.length > 0 ? (
              <div className="mt-3 space-y-2">
                {group.invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
                  >
                    <code className="font-mono text-sm font-semibold tracking-widest text-gray-800">
                      {invite.code}
                    </code>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        {invite.useCount}/{invite.maxUses} uses
                      </span>
                      <button
                        onClick={() => handleCopyCode(invite.code)}
                        className="rounded bg-brand-50 px-2 py-1 text-brand-600 hover:bg-brand-100"
                      >
                        {copiedCode === invite.code ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-400">
                No active invites. Generate one to share.
              </p>
            )}
          </div>
        )}

        {/* Members */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-medium text-gray-900">
            Members ({group.members.length})
          </h3>
          <div className="mt-3 divide-y divide-gray-100">
            {group.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                      {member.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900">{member.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      member.role === 'COACH'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {member.role === 'COACH' ? 'Coach' : 'Athlete'}
                  </span>
                </div>

                {isCoach && member.id !== user?.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        updateRole.mutate({
                          memberId: member.id,
                          role: member.role === 'COACH' ? 'ATHLETE' : 'COACH',
                        })
                      }
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {member.role === 'COACH' ? 'Demote' : 'Promote'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${member.name} from the group?`)) {
                          removeMember.mutate(member.id);
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Leave group */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to leave this group?')) {
                removeMember.mutate(user!.id, {
                  onSuccess: () => navigate('/groups'),
                });
              }
            }}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Leave Group
          </button>
        </div>
      </main>
    </div>
  );
}
