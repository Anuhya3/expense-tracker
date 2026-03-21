import { useAIStatus } from '../context/AIStatusContext';

export default function AIBadge() {
  const { status, loading } = useAIStatus();

  if (loading || !status) return null;

  const isLive = status.mode === 'live';

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
      title={isLive ? 'AI features powered by Claude API' : 'AI running in demo mode — add ANTHROPIC_API_KEY for live mode'}
      style={{ backgroundColor: isLive ? '#dcfce7' : '#fef9c3', color: isLive ? '#166534' : '#854d0e' }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: isLive ? '#16a34a' : '#ca8a04' }}
      />
      AI {isLive ? 'Live' : 'Demo'}
    </div>
  );
}
