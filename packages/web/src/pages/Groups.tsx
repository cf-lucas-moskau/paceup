import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useGroups, useCreateGroup, useJoinGroup } from '../lib/hooks';

export function Groups() {
  const navigate = useNavigate();
  const { data, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createGroup.mutate(
      { name: newGroupName, description: newGroupDesc || undefined },
      {
        onSuccess: () => {
          setShowCreate(false);
          setNewGroupName('');
          setNewGroupDesc('');
        },
      }
    );
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError('');
    joinGroup.mutate(joinCode.trim(), {
      onSuccess: () => {
        setShowJoin(false);
        setJoinCode('');
      },
      onError: (err) => {
        setJoinError(err.message);
      },
    });
  }

  const groups = data?.groups ?? [];

  return (
    <div className="min-h-screen bg-neo-white pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowJoin(true)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
            >
              Join Group
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Create Group
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200" />
            ))
          ) : groups.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500">No groups yet.</p>
              <p className="mt-1 text-sm text-gray-400">
                Create or join a group to train with friends.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <button
                key={group.id}
                onClick={() => navigate(`/groups/${group.id}`)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow"
              >
                <div>
                  <p className="font-medium text-gray-900">{group.name}</p>
                  {group.description && (
                    <p className="mt-0.5 text-sm text-gray-500">{group.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      group.role === 'COACH'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {group.role === 'COACH' ? 'Coach' : 'Athlete'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Create Group Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900">Create Group</h2>
              <form onSubmit={handleCreate} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="e.g. Marathon Training Crew"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="What's this group about?"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createGroup.isPending}
                    className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {createGroup.isPending ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Join Group Modal */}
        {showJoin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900">Join Group</h2>
              <form onSubmit={handleJoin} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Invite Code</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    required
                    maxLength={6}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg font-mono tracking-widest focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="XKFM7R"
                  />
                </div>
                {joinError && (
                  <p className="text-sm text-red-600">{joinError}</p>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowJoin(false); setJoinError(''); }}
                    className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={joinGroup.isPending}
                    className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {joinGroup.isPending ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
