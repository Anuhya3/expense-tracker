import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroups } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Group, GroupMember } from '../types';
import { Users, Plus, X, Check, ChevronRight } from 'lucide-react';
import CurrencySelector from '../components/CurrencySelector';

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getMemberUser(member: GroupMember): { _id: string; name: string; email: string } | null {
  if (typeof member.user === 'string') return null;
  return member.user as { _id: string; name: string; email: string };
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
  'bg-orange-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500'
];

function MemberAvatars({ members }: { members: GroupMember[] }) {
  const active = members.filter(m => m.status === 'active');
  const shown = active.slice(0, 4);
  const overflow = active.length - shown.length;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((m, i) => {
        const user = getMemberUser(m);
        const name = user?.name || '?';
        return (
          <div
            key={m._id || i}
            className={`w-7 h-7 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-gray-800`}
            title={name}
          >
            {getInitials(name)}
          </div>
        );
      })}
      {overflow > 0 && (
        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 border-2 border-white dark:border-gray-800">
          +{overflow}
        </div>
      )}
    </div>
  );
}

function InviteCard({ group, onAccepted }: { group: Group; onAccepted: () => void }) {
  const [accepting, setAccepting] = useState(false);
  const { user } = useAuth();

  const myMember = group.members.find(m => {
    const memberUser = getMemberUser(m);
    return memberUser && memberUser._id === user?.id;
  });

  const handleAccept = async () => {
    if (!myMember || !user) return;
    setAccepting(true);
    try {
      await api.put(`/groups/${group._id}/members/${user.id}/accept`, {});
      onAccepted();
    } catch (err) {
      console.error(err);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
          <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Invited to <span className="font-bold">{group.name}</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {group.members.filter(m => m.status === 'active').length} active members
          </p>
        </div>
      </div>
      <button
        onClick={handleAccept}
        disabled={accepting}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" />
        {accepting ? 'Accepting...' : 'Accept'}
      </button>
    </div>
  );
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', currency: 'GBP' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Group name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/groups', form);
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold dark:text-white">Create Group</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4 dark:text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Group Name</label>
            <input
              className="input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Flat Share, Weekend Trip"
              required
            />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input
              className="input"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What's this group for?"
            />
          </div>
          <div>
            <label className="label">Default Currency</label>
            <CurrencySelector
              value={form.currency}
              onChange={code => setForm(f => ({ ...f, currency: code }))}
              className="w-full"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, loading, refetch } = useGroups();
  const { user } = useAuth();
  const navigate = useNavigate();

  const allGroups = data?.groups || [];
  const pendingInvites = allGroups.filter(g =>
    g.members.some(m => {
      const memberUser = getMemberUser(m);
      return memberUser && memberUser._id === user?.id && m.status === 'invited';
    })
  );
  const activeGroups = allGroups.filter(g =>
    g.members.some(m => {
      const memberUser = getMemberUser(m);
      return memberUser && memberUser._id === user?.id && m.status === 'active';
    })
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold dark:text-white">Shared Expenses</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Group
        </button>
      </div>

      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Pending Invitations ({pendingInvites.length})
          </h3>
          <div className="space-y-2">
            {pendingInvites.map(group => (
              <InviteCard key={group._id} group={group} onAccepted={refetch} />
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeGroups.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="text-base font-medium mb-1 dark:text-gray-500">No groups yet</p>
          <p className="text-sm">Create a group to split expenses with friends</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeGroups.map(group => {
            const totalMembers = group.members.filter(m => m.status === 'active').length;
            return (
              <button
                key={group._id}
                onClick={() => navigate(`/groups/${group._id}`)}
                className="card p-4 text-left hover:shadow-md dark:bg-gray-800 dark:border-gray-700 transition-shadow group flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {group.name}
                    </h3>
                    {group.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{group.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 group-hover:text-blue-500 transition-colors" />
                </div>

                <div className="flex items-center justify-between">
                  <MemberAvatars members={group.members} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md">
                    {group.currency}
                  </span>
                  {group.isSettled && (
                    <span className="text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-md">
                      Settled
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
        />
      )}
    </div>
  );
}
