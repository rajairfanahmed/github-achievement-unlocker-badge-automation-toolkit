'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  RunSelection,
  WebAchievement,
  WebHistory,
  WebJob,
  WebIssue,
  WebRateLimit,
  WebStatus,
} from '../lib/types';
import { ApiRequestError, parseJsonResponse } from '../lib/apiClient';
import { linksForOperation } from '../lib/historyLinks';
import type { TierLevel } from '../../src/types/index.js';

type Section = 'overview' | 'achievements' | 'history' | 'settings';

interface AchievementResponse {
  achievements: WebAchievement[];
  status: WebStatus;
}

const NAV_ITEMS: Array<{ id: Section; label: string; hint: string; icon: string }> = [
  { id: 'overview', label: 'Overview', hint: 'Checks & summary', icon: '◆' },
  { id: 'achievements', label: 'Achievements', hint: 'Run badge workflows', icon: '★' },
  { id: 'history', label: 'History', hint: 'Database & links', icon: '☰' },
  { id: 'settings', label: 'Settings', hint: 'Env & alerts', icon: '⚙' },
];

const PAGE_INTROS: Record<Section, { headline: string; sub: string }> = {
  overview: {
    headline: 'Workspace status',
    sub: 'Confirm your environment file, tokens, and repository access. Fix any issues here before running achievements.',
  },
  achievements: {
    headline: 'Achievements',
    sub: 'Each card is one profile badge. GitHub names progress levels Default, Bronze, Silver, and Gold (lowest to highest); each level needs more qualifying actions—the numbers on the card are from GitHub’s rules. The dashboard shows what is saved in your local database, not a live copy of GitHub. Only one job runs at a time.',
  },
  history: {
    headline: 'History',
    sub: 'Rows come from your local progress file. Operation links open GitHub using your configured TARGET_REPO.',
  },
  settings: {
    headline: 'Settings',
    sub: 'High-level configuration status (never displays secret token values). Optional browser notifications when a job finishes.',
  },
};

function pct(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}

function formatReset(seconds: number | null): string {
  if (seconds === null) return 'Unknown';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

type LocalOutcome = 'none' | 'done' | 'wip' | 'failed';

function tierMetaForLevel(
  tiers: WebAchievement['tiers'],
  level: TierLevel | undefined
): WebAchievement['tiers'][number] | null {
  if (!level) return null;
  return tiers.find((x) => x.level === level) ?? null;
}

function localTierOutcome(progress: WebAchievement['progress']): LocalOutcome {
  if (!progress) return 'none';
  if (progress.status === 'failed') return 'failed';
  const met = progress.targetCount > 0 && progress.completedCount >= progress.targetCount;
  if (met || progress.status === 'completed') return 'done';
  return 'wip';
}

function describeDbStatus(status: string): string {
  switch (status) {
    case 'completed':
      return 'Marked complete in your database';
    case 'in_progress':
      return 'Run not finished in your database';
    case 'failed':
      return 'Last run failed (see History)';
    default:
      return status.replace(/_/g, ' ');
  }
}

function isProgressTierComplete(progress: NonNullable<WebAchievement['progress']>): boolean {
  return (
    progress.status === 'completed' ||
    (progress.targetCount > 0 && progress.completedCount >= progress.targetCount)
  );
}

/** Finished tiers cannot be run again: superseded by a higher tier saved in the DB, or current tier goal met. */
function isTierFinished(
  tiers: WebAchievement['tiers'],
  progress: WebAchievement['progress'],
  tierLevel: TierLevel
): boolean {
  if (!progress) return false;
  const ti = tiers.findIndex((x) => x.level === tierLevel);
  const cur = tiers.findIndex((x) => x.level === progress.tier);
  if (ti === -1 || cur === -1) return false;
  if (ti < cur) return true;
  if (ti > cur) return false;
  return isProgressTierComplete(progress);
}

function nextRunnableTier(
  tiers: WebAchievement['tiers'],
  progress: WebAchievement['progress']
): TierLevel | null {
  if (!tiers.length) return null;
  for (const t of tiers) {
    if (!isTierFinished(tiers, progress, t.level)) return t.level;
  }
  return null;
}

function initialTierChoiceForAchievement(a: WebAchievement): TierLevel {
  const n = nextRunnableTier(a.tiers, a.progress);
  if (n) return n;
  return a.tiers[a.tiers.length - 1]?.level ?? 'default';
}

function allTiersFinished(a: WebAchievement): boolean {
  if (!a.tiers.length) return false;
  return a.tiers.every((t) => isTierFinished(a.tiers, a.progress, t.level));
}

function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'error' | 'muted'; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function ProgressBar({ current, total, ariaLabel }: { current: number; total: number; ariaLabel?: string }) {
  const percent = pct(current, total);
  return (
    <div className="progressWrap" aria-label={ariaLabel ?? `${percent}% complete`}>
      <div className="progressTrack">
        <div className="progressFill" style={{ width: `${percent}%` }} />
      </div>
      <span className="progressPct">{percent}%</span>
    </div>
  );
}

const HISTORY_PAGE_SIZE = 10;
const OPERATIONS_PAGE_SIZE = 15;

function getPageNumberWindow(currentPage: number, totalPages: number): Array<number | '...'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: Array<number | '...'> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push('...');
  }

  for (let p = start; p <= end; p++) {
    pages.push(p);
  }

  if (end < totalPages - 1) {
    pages.push('...');
  }

  pages.push(totalPages);
  return pages;
}

function getBadgeImageUrl(id: WebAchievement['id'], tier: TierLevel | undefined): string {
  const providedDefaultIcons: Partial<Record<WebAchievement['id'], string>> = {
    'galaxy-brain': 'https://github.githubassets.com/assets/galaxy-brain-default-847262c21056.png',
    'pull-shark': 'https://github.githubassets.com/assets/pull-shark-default-498c279a747d.png',
    'pair-extraordinaire': 'https://github.githubassets.com/assets/pair-extraordinaire-default-579438a20e01.png',
    yolo: 'https://github.githubassets.com/assets/yolo-default-be0bbff04951.png',
    quickdraw: 'https://github.githubassets.com/assets/quickdraw-default-39c6aec8ff89.png',
    starstruck: 'https://github.githubassets.com/assets/starstruck-default--light-a594e2a027e0.png',
  };

  if (tier === 'default' && providedDefaultIcons[id]) {
    return providedDefaultIcons[id];
  }

  const suffixByTier: Record<TierLevel, string> = {
    default: '-default',
    bronze: '-bronze',
    silver: '-silver',
    gold: '-gold',
  };

  return `https://github.githubassets.com/images/modules/profile/achievements/${id}${suffixByTier[tier ?? 'default']}-64.png`;
}

export default function Dashboard() {
  const [section, setSection] = useState<Section>('overview');
  const [status, setStatus] = useState<WebStatus | null>(null);
  const [rateLimit, setRateLimit] = useState<WebRateLimit | null>(null);
  const [achievements, setAchievements] = useState<WebAchievement[]>([]);
  const [history, setHistory] = useState<WebHistory | null>(null);
  const [tierChoice, setTierChoice] = useState<Record<string, TierLevel>>({});
  const [job, setJob] = useState<WebJob | null>(null);
  const [jobDrawerDismissed, setJobDrawerDismissed] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ tone: 'error' | 'warn'; message: string; action?: string } | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [notifyPrefs, setNotifyPrefs] = useState<{
    permission: NotificationPermission | 'unsupported' | 'default';
  }>({ permission: 'default' });
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [operationsPage, setOperationsPage] = useState(1);

  useEffect(() => {
    const syncNotificationState = () => {
      if (typeof Notification !== 'undefined') {
        setNotifyPrefs({ permission: Notification.permission });
      } else {
        setNotifyPrefs({ permission: 'unsupported' });
      }

      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        setNotifyEnabled(localStorage.getItem('achievementNotifyJobs') === '1');
      } else {
        setNotifyEnabled(false);
      }
    };

    syncNotificationState();
    const interval = window.setInterval(syncNotificationState, 1200);
    window.addEventListener('focus', syncNotificationState);
    document.addEventListener('visibilitychange', syncNotificationState);
    window.addEventListener('storage', syncNotificationState);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncNotificationState);
      document.removeEventListener('visibilitychange', syncNotificationState);
      window.removeEventListener('storage', syncNotificationState);
    };
  }, []);
  const ratePollBackoff = useRef(1);
  const jobStatusRef = useRef<{ id: string; status: WebJob['status'] } | null>(null);

  const loadCore = useCallback(async () => {
    try {
      const [statusData, achievementsData, historyData] = await Promise.all([
        parseJsonResponse<WebStatus>(await fetch('/api/status', { cache: 'no-store', headers: { Accept: 'application/json' } })),
        parseJsonResponse<AchievementResponse>(
          await fetch('/api/achievements', { cache: 'no-store', headers: { Accept: 'application/json' } })
        ),
        parseJsonResponse<WebHistory>(await fetch('/api/history', { cache: 'no-store', headers: { Accept: 'application/json' } })),
      ]);
      setStatus(statusData);
      setAchievements(achievementsData.achievements);
      setHistory(historyData);
      setTierChoice((prev) => {
        const next = { ...prev };
        for (const a of achievementsData.achievements) {
          const suggested = initialTierChoiceForAchievement(a);
          if (!next[a.id]) {
            next[a.id] = suggested;
          } else if (isTierFinished(a.tiers, a.progress, next[a.id])) {
            next[a.id] = suggested;
          }
        }
        return next;
      });
      setLastRefresh(new Date());
      setBanner(null);
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.body.error || e.message : e instanceof Error ? e.message : String(e);
      const action = e instanceof ApiRequestError ? e.body.action : undefined;
      setBanner({ tone: 'error', message: msg, action });
    }
  }, []);

  const loadRateLimitOnly = useCallback(async () => {
    try {
      const res = await fetch('/api/rate-limit', { cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = (await res.json()) as WebRateLimit;
      if (res.ok) {
        setRateLimit(data);
        ratePollBackoff.current = 1;
      }
    } catch {
      /* keep previous rate limit snapshot */
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadCore();
      await loadRateLimitOnly();
    } finally {
      setLoading(false);
    }
  }, [loadCore, loadRateLimitOnly]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    let cancelled = false;
    async function bootJob() {
      try {
        const res = await fetch('/api/jobs/active', { cache: 'no-store' });
        const data = (await res.json()) as { active: WebJob | null };
        if (!cancelled && data.active) {
          setJob(data.active);
        }
      } catch {
        /* ignore */
      }
    }
    void bootJob();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setJobDrawerDismissed(false);
  }, [job?.id]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const schedule = () => {
      const fast = job && (job.status === 'queued' || job.status === 'running');
      const baseMs = fast ? 5_000 : document.visibilityState === 'hidden' ? 60_000 : 20_000;
      const delay = Math.min(baseMs * ratePollBackoff.current, 300_000);

      timeoutId = window.setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === 'hidden') {
          ratePollBackoff.current = Math.min(ratePollBackoff.current * 1.15, 12);
          schedule();
          return;
        }
        try {
          const res = await fetch('/api/rate-limit', { cache: 'no-store', headers: { Accept: 'application/json' } });
          const data = (await res.json()) as WebRateLimit;
          if (res.status === 429) {
            ratePollBackoff.current = Math.min(ratePollBackoff.current * 1.75, 24);
          } else if (res.ok) {
            ratePollBackoff.current = 1;
            setRateLimit(data);
          } else {
            ratePollBackoff.current = Math.min(ratePollBackoff.current * 1.35, 18);
          }
        } catch {
          ratePollBackoff.current = Math.min(ratePollBackoff.current * 1.45, 18);
        }
        schedule();
      }, delay);
    };

    ratePollBackoff.current = 1;
    schedule();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [job]);

  useEffect(() => {
    if (!job) {
      jobStatusRef.current = null;
      return;
    }
    const prev = jobStatusRef.current;
    jobStatusRef.current = { id: job.id, status: job.status };

    if (
      prev &&
      prev.id === job.id &&
      (prev.status === 'running' || prev.status === 'queued') &&
      (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')
    ) {
      if (
        typeof window !== 'undefined' &&
        localStorage.getItem('achievementNotifyJobs') === '1' &&
        Notification.permission === 'granted'
      ) {
        const title =
          job.status === 'completed'
            ? 'Achievement run completed'
            : job.status === 'cancelled'
              ? 'Achievement run stopped'
              : 'Achievement run failed';
        const body =
          job.status === 'failed' && job.errors[0]
            ? job.errors[0].slice(0, 180)
            : job.status === 'cancelled'
              ? 'Remaining steps were skipped after you stopped the run.'
              : `Job ${job.id.split('-').pop()} is ${job.status}.`;
        try {
          new Notification(title, { body });
        } catch {
          /* ignore */
        }
      }
    }
  }, [job]);

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await parseJsonResponse<WebJob>(
          await fetch(`/api/jobs/${job.id}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
        );
        setJob(next);
        if (next.status === 'completed' || next.status === 'failed' || next.status === 'cancelled') {
          void loadAll();
        }
      } catch (error) {
        setBanner({
          tone: 'warn',
          message: error instanceof Error ? error.message : String(error),
          action: 'Refresh the page if the job finished outside this tab.',
        });
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [job, loadAll]);

  const totals = useMemo(() => {
    const achievementRows = history?.achievements || [];
    return {
      completed: achievementRows.filter((item) => item.status === 'completed').length,
      inProgress: achievementRows.filter((item) => item.status === 'in_progress').length,
      failed: achievementRows.filter((item) => item.status === 'failed').length,
    };
  }, [history]);

  const historyRows = history?.achievements ?? [];
  const operationRows = history?.operations ?? [];
  const historyTotalPages = Math.max(1, Math.ceil(historyRows.length / HISTORY_PAGE_SIZE));
  const operationsTotalPages = Math.max(1, Math.ceil(operationRows.length / OPERATIONS_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const safeOperationsPage = Math.min(operationsPage, operationsTotalPages);

  const pagedHistoryRows = useMemo(() => {
    const start = (safeHistoryPage - 1) * HISTORY_PAGE_SIZE;
    return historyRows.slice(start, start + HISTORY_PAGE_SIZE);
  }, [historyRows, safeHistoryPage]);

  const pagedOperationRows = useMemo(() => {
    const start = (safeOperationsPage - 1) * OPERATIONS_PAGE_SIZE;
    return operationRows.slice(start, start + OPERATIONS_PAGE_SIZE);
  }, [operationRows, safeOperationsPage]);

  useEffect(() => {
    setHistoryPage(1);
    setOperationsPage(1);
  }, [history?.databasePath, historyRows.length, operationRows.length]);

  const jobBlocking = Boolean(job && (job.status === 'queued' || job.status === 'running'));

  const cancelActiveJob = useCallback(async () => {
    if (!job) return;
    setCancelBusy(true);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(job.id)}/cancel`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as { ok?: boolean; job?: WebJob; error?: string };
      if (!res.ok || !data.job) {
        setBanner({ tone: 'warn', message: data.error || 'Could not stop this run.' });
        return;
      }
      setJob(data.job);
    } catch (e) {
      setBanner({
        tone: 'warn',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCancelBusy(false);
    }
  }, [job]);

  const runAchievement = async (achievement: WebAchievement) => {
    const tier = tierChoice[achievement.id] ?? initialTierChoiceForAchievement(achievement);
    if (!tier) return;

    setCardErrors((prev) => {
      const next = { ...prev };
      delete next[achievement.id];
      return next;
    });

    const tierMeta = achievement.tiers.find((t) => t.level === tier);
    const feasibility = achievement.tierFeasibility.find((t) => t.level === tier);

    if (!achievement.available || !achievement.automatable) {
      setCardErrors((prev) => ({
        ...prev,
        [achievement.id]: achievement.unavailableReasons[0] || 'This achievement cannot run yet.',
      }));
      return;
    }

    if (isTierFinished(achievement.tiers, achievement.progress, tier)) {
      const next = nextRunnableTier(achievement.tiers, achievement.progress);
      const hint = next ? ` Choose ${tierMetaForLevel(achievement.tiers, next)?.displayName ?? next} instead.` : '';
      setCardErrors((prev) => ({
        ...prev,
        [achievement.id]: `This tier is already completed (or superseded by a higher tier in your database).${hint}`,
      }));
      return;
    }

    if (feasibility && !feasibility.canLikelyCompleteRun) {
      setCardErrors((prev) => ({
        ...prev,
        [achievement.id]:
          `Not enough GitHub REST quota: this tier needs ~${feasibility.estimatedCallsForRemaining} calls but only ~${rateLimit?.remaining ?? '?'} remain. Wait until reset (${formatReset(rateLimit?.resetInSeconds ?? null)}) or pick a lower tier.`,
      }));
      return;
    }

    const dbTier = achievement.progress?.tier;
    if (dbTier && dbTier !== tier) {
      const ok = window.confirm(
        `Saved progress is for the "${dbTier}" tier, but you selected "${tier}". The run will target the selected tier’s counts and may not match prior resume bookkeeping. Continue?`
      );
      if (!ok) return;
    }

    const estCalls = feasibility?.estimatedCallsForRemaining ?? 0;
    if (estCalls > 400) {
      const ok = window.confirm(
        `This run may use roughly ${estCalls} REST requests toward your GitHub core quota. Continue?`
      );
      if (!ok) return;
    }

    try {
      const selections: RunSelection[] = [
        {
          id: achievement.id,
          tier,
          targetCount: tierMeta?.targetCount ?? 0,
        },
      ];
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ selections }),
      });
      const nextJob = await parseJsonResponse<WebJob>(response);
      setJob(nextJob);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        const msg = e.body.error || e.message;
        setCardErrors((prev) => ({ ...prev, [achievement.id]: msg }));
        const issues = e.body.issues as WebIssue[] | undefined;
        if (issues?.length) {
          setBanner({
            tone: 'error',
            message: msg,
            action: e.body.action || issues[0]?.action,
          });
        }
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setCardErrors((prev) => ({ ...prev, [achievement.id]: msg }));
      }
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const rateTone: 'ok' | 'warn' | 'error' =
    rateLimit?.state === 'ok' ? 'ok' : rateLimit?.state === 'warning' ? 'warn' : 'error';

  const intro = PAGE_INTROS[section];
  const visibleAchievements = achievements.filter((achievement) => achievement.automatable);

  return (
    <div className="appRoot">
      <header className="productBar">
        <div className="productBarInner">
          <div className="productIdentity">
            <span className="productLogo" aria-hidden>
              GH
            </span>
            <div>
              <span className="productName">Achievement Manager</span>
              <span className="productTagline">Local dashboard · your tokens stay on this machine</span>
            </div>
          </div>
          <div className="productBarActions">
            <span className="metaPill" title="Last full data refresh">
              Updated {lastRefresh ? lastRefresh.toLocaleTimeString() : '—'}
            </span>
            <button type="button" className="secondaryBtn btnCompact" onClick={() => void loadAll()} disabled={loading}>
              Refresh data
            </button>
          </div>
        </div>
      </header>

      <header className="contextStrip" aria-label="GitHub context">
        <div className="contextStripInner">
          <div className="contextGroup">
            <span className="contextLabel">Target repository</span>
            {status?.repo ? (
              <a href={`https://github.com/${status.repo.fullName}`} target="_blank" rel="noreferrer" className="contextLink">
                {status.repo.fullName}
              </a>
            ) : (
              <span className="contextMuted">{status?.targetRepo || 'Not configured'}</span>
            )}
          </div>
          <div className="contextGroup">
            <span className="contextLabel">Main account</span>
            {status?.username ? (
              <a href={`https://github.com/${status.username}`} target="_blank" rel="noreferrer" className="contextLink">
                @{status.username}
              </a>
            ) : (
              <span className="contextMuted">—</span>
            )}
          </div>
          <div className="contextGroup">
            <span className="contextLabel">Helper account</span>
            {status?.helperUsername ? (
              <a href={`https://github.com/${status.helperUsername}`} target="_blank" rel="noreferrer" className="contextLink">
                @{status.helperUsername}
              </a>
            ) : (
              <span className="contextMuted">{status?.helperConfigured ? '—' : 'Not configured'}</span>
            )}
          </div>
          <div className="contextGroup rateChip" title={rateLimit?.message}>
            <span className="contextLabel">GitHub REST (core)</span>
            <Badge tone={rateTone}>
              {rateLimit?.remaining === null || rateLimit?.remaining === undefined
                ? 'Unknown'
                : `${rateLimit.remaining}/${rateLimit.limit ?? '?'}`}
            </Badge>
            <span className="resetEta">Reset {formatReset(rateLimit?.resetInSeconds ?? null)}</span>
          </div>
        </div>
      </header>

      {banner && (
        <div className={`banner banner-${banner.tone}`} role="alert">
          <div>
            <strong>{banner.message}</strong>
            {banner.action && <p className="bannerAction">{banner.action}</p>}
          </div>
          <button type="button" className="bannerDismiss" onClick={() => setBanner(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <div className="layoutShell">
        <nav className="sidebarNav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'navItem isActive' : 'navItem'}
              onClick={() => setSection(item.id)}
            >
              <span className="navItemIcon" aria-hidden>
                {item.icon}
              </span>
              <span className="navItemText">
                <span className="navItemLabel">{item.label}</span>
                <span className="navItemHint">{item.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <main className="mainColumn">
          <header className="pageIntro">
            <div className="pageIntroText">
              <h1 className="pageIntroHeadline">{intro.headline}</h1>
              <p className="pageIntroSub">{intro.sub}</p>
            </div>
            <div className="pageIntroAside">
              {status?.username ? (
                <span className="connectionBadge">
                  <span className="connectionDot" aria-hidden />
                  Signed in as <strong>@{status.username}</strong>
                </span>
              ) : (
                <span className="mutedText">Not connected to GitHub</span>
              )}
            </div>
          </header>

          {loading && (
            <div className="loadingPanel" role="status" aria-live="polite">
              <div className="loadingSpinner" aria-hidden />
              <p>Loading workspace status and achievements…</p>
            </div>
          )}

          {!loading && section === 'overview' && (
            <div className="stack">
              <section className="panel">
                <div className="panelHead">
                  <div>
                    <h2 className="panelTitle">Preflight checks</h2>
                    <p className="panelLead">Required for most automated workflows (repo access, discussions where needed, helper for some badges).</p>
                  </div>
                  <Badge tone={status?.ok ? 'ok' : 'warn'}>{status?.ok ? 'Ready' : 'Needs attention'}</Badge>
                </div>
                <div className="statusGrid">
                  <StatusLine label=".env file" ok={Boolean(status?.envExists)} />
                  <StatusLine label="Config valid" ok={Boolean(status?.configValid)} />
                  <StatusLine label="Write access" ok={Boolean(status?.repo?.hasWriteAccess)} />
                  <StatusLine label="Discussions" ok={Boolean(status?.repo?.hasDiscussions)} />
                  <StatusLine label="Helper collaborator" ok={status?.helperCollaborator !== false} muted={status?.helperCollaborator === null} />
                  <StatusLine label="Main/helper separated" ok={!status?.helperSameAsMain} />
                </div>
                {status?.issues.length ? (
                  <ul className="issueList">
                    {status.issues.map((issue) => (
                      <li key={`${issue.code}-${issue.title}`} className={`issue issue-${issue.severity}`}>
                        <strong>{issue.title}</strong>
                        <p>{issue.message}</p>
                        <span className="issueAction">{issue.action}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mutedText">All preflight checks passed.</p>
                )}
              </section>

              <section className="panel">
                <div className="panelHead">
                  <div>
                    <h2 className="panelTitle">Achievement records</h2>
                    <p className="panelLead">
                      Summary rows come from your local JSON database (not GitHub’s servers).{' '}
                      <strong>Completed</strong> means that badge row reached its tier target here; confirm badges on your GitHub profile.
                      <strong> In progress</strong> means automation toward the tier goal has not been marked complete yet.
                    </p>
                  </div>
                  <Badge tone="muted">Local database</Badge>
                </div>
                <div className="metrics compact">
                  <Metric label="Completed" value={String(totals.completed)} tone="ok" />
                  <Metric label="In progress" value={String(totals.inProgress)} tone="warn" />
                  <Metric label="Failed" value={String(totals.failed)} tone="error" />
                </div>
              </section>
            </div>
          )}

          {!loading && section === 'achievements' && (
            <div className="achievementGrid">
              {visibleAchievements.map((achievement) => {
                const tier = tierChoice[achievement.id] ?? initialTierChoiceForAchievement(achievement);
                const feasibility = achievement.tierFeasibility.find((t) => t.level === tier);
                const canFeas = feasibility?.canLikelyCompleteRun !== false;
                const progress = achievement.progress;
                const iconTier = progress?.tier ?? 'default';
                const tierMismatch = Boolean(progress?.tier && tier && progress.tier !== tier);
                const savedTierMeta = progress ? tierMetaForLevel(achievement.tiers, progress.tier) : null;
                const localOutcome = localTierOutcome(progress);
                const nextTierLevel = nextRunnableTier(achievement.tiers, achievement.progress);
                const nextTierMeta = nextTierLevel ? tierMetaForLevel(achievement.tiers, nextTierLevel) : null;
                const everyTierDone = allTiersFinished(achievement);
                const tierFinishedSelection = isTierFinished(achievement.tiers, achievement.progress, tier);

                return (
                  <article key={achievement.id} className="panel achievementCard">
                    <header className="achievementCardHeader">
                      <div className="achievementCardHeaderMain">
                        <div className="achievementCardTitleRow">
                          <span className="cardIconWrap">
                            <img
                              className="cardBadgeImg"
                              src={getBadgeImageUrl(achievement.id, iconTier)}
                              alt={`${achievement.name} badge icon`}
                              loading="lazy"
                            />
                          </span>
                          <div>
                            <h2 className="cardTitle">{achievement.name}</h2>
                            <p className="cardDesc">{achievement.description}</p>
                          </div>
                        </div>
                        <p className={`achievementLocalState achievementLocalState--${localOutcome}`} role="status">
                          {localOutcome === 'none' && 'No saved progress for this badge yet—pick a tier and run.'}
                          {localOutcome === 'done' && 'Tier goal met in your database (confirm the badge on GitHub).'}
                          {localOutcome === 'wip' &&
                            progress &&
                            `${progress.completedCount.toLocaleString()} / ${progress.targetCount.toLocaleString()} actions recorded toward ${savedTierMeta?.displayName ?? progress.tier} tier.`}
                          {localOutcome === 'failed' && 'Last automation run failed—check History for details.'}
                        </p>
                      </div>
                      <Badge tone={achievement.available ? 'ok' : 'warn'}>
                        {achievement.automatable ? (achievement.available ? 'Runnable' : 'Blocked') : 'Catalog only'}
                      </Badge>
                    </header>

                    <section className="cardSection" aria-labelledby={`tier-label-${achievement.id}`}>
                      <h3 id={`tier-label-${achievement.id}`} className="cardSectionTitle">
                        Tier targets (GitHub naming)
                      </h3>
                      <p className="cardSectionHelp">
                        GitHub orders tiers from lowest to highest: <strong>Default</strong>, then <strong>Bronze</strong>,{' '}
                        <strong>Silver</strong>, <strong>Gold</strong>. Each name is a higher milestone for this badge—the number on
                        the pill is how many qualifying actions GitHub requires for that level. The <strong>teal highlight</strong>{' '}
                        is the next tier you can automate; <strong>muted dashed</strong> pills are finished and cannot be run again.
                      </p>
                      <div className="tierRow">
                        {achievement.tiers.map((t) => {
                          const finished = isTierFinished(achievement.tiers, achievement.progress, t.level);
                          const isNext = Boolean(nextTierLevel === t.level && !finished);
                          const pillClass = finished
                            ? 'tierPill tierPillDone'
                            : isNext
                              ? 'tierPill tierPillNext'
                              : progress?.tier === t.level
                                ? 'tierPill tierPillSaved'
                                : 'tierPill';
                          const pillTitle = finished
                            ? 'Completed — choose a higher tier to continue'
                            : isNext
                              ? 'Next tier to run automation toward'
                              : progress?.tier === t.level
                                ? 'Your database progress row is for this tier'
                                : undefined;
                          return (
                            <span key={t.level} className={pillClass} title={pillTitle}>
                              <span className="tierPillName">{t.displayName}</span>
                              <span className="tierPillNum">{t.targetCount.toLocaleString()}</span>
                            </span>
                          );
                        })}
                      </div>
                    </section>

                    {progress && (
                      <section className="cardSection" aria-labelledby={`progress-head-${achievement.id}`}>
                        <h3 id={`progress-head-${achievement.id}`} className="cardSectionTitle">
                          Saved progress — {savedTierMeta?.displayName ?? progress.tier} tier
                        </h3>
                        <p className="cardSectionHelp">
                          The fraction <strong>{progress.completedCount.toLocaleString()} / {progress.targetCount.toLocaleString()}</strong>{' '}
                          counts toward the <strong>{savedTierMeta?.displayName ?? progress.tier}</strong> goal only (target{' '}
                          {progress.targetCount.toLocaleString()} for this level). Other tiers use different totals—see Tier targets.
                        </p>
                        <div className={`progressOutcomeBanner progressOutcomeBanner--${localOutcome}`}>
                          {localOutcome === 'done' && (
                            <p className="progressOutcomeText">
                              <strong>Numeric goal reached in this database.</strong> GitHub awards the profile badge when their
                              systems confirm you met the rule—use your profile as the source of truth for the graphic.
                            </p>
                          )}
                          {localOutcome === 'wip' && (
                            <p className="progressOutcomeText">
                              <strong>Still working toward this tier’s goal.</strong> You need{' '}
                              {Math.max(0, progress.targetCount - progress.completedCount).toLocaleString()} more qualifying actions
                              recorded here (this counter tracks runs from this app toward the same numbers GitHub publishes).
                            </p>
                          )}
                          {localOutcome === 'failed' && (
                            <p className="progressOutcomeText">
                              <strong>Last run did not finish successfully.</strong> Open the History tab for per-operation status
                              and errors.
                            </p>
                          )}
                        </div>
                        <div className="progressBlock">
                          <ProgressBar
                            current={progress.completedCount}
                            total={progress.targetCount}
                            ariaLabel={`${savedTierMeta?.displayName ?? progress.tier} tier: ${progress.completedCount} of ${progress.targetCount} actions (${pct(progress.completedCount, progress.targetCount)}%)`}
                          />
                          <p className="progressMeta">
                            <span className="progressCounts">
                              {progress.completedCount.toLocaleString()} / {progress.targetCount.toLocaleString()}
                            </span>
                            <span className="progressSep">·</span>
                            <span className="progressDbStatus">{describeDbStatus(progress.status)}</span>
                          </p>
                        </div>
                        <p className="progressFootnote">
                          “Complete” here means your saved row reached this tier’s target count—it does not guarantee GitHub has
                          already refreshed every badge on your profile.
                        </p>
                      </section>
                    )}

                    {tierMismatch && (
                      <div className="tierMismatchCallout" role="status">
                        <h4 className="tierMismatchTitle">Your dropdown does not match saved tier</h4>
                        <div className="tierMismatchCompare">
                          <div className="tierMismatchBox">
                            <p className="tierMismatchLabel">Saved in local database</p>
                            <p className="tierMismatchValue">
                              <code>{progress?.tier}</code>
                            </p>
                          </div>
                          <div className="tierMismatchBox">
                            <p className="tierMismatchLabel">Selected for next run</p>
                            <p className="tierMismatchValue">
                              <code>{tier}</code>
                            </p>
                          </div>
                        </div>
                        <p className="tierMismatchBody">
                          The next run will use the <strong>selected</strong> tier and its targets (not the saved tier).
                          When you press Run, we ask for confirmation so this is intentional.
                        </p>
                      </div>
                    )}

                    <section className="cardSection cardSectionActions">
                      <h3 className="cardSectionTitle">Run settings</h3>
                      <div className="cardControls">
                      <label className="tierSelectLabel" htmlFor={`tier-${achievement.id}`}>
                        Tier for next run
                      </label>
                      {nextTierMeta && !everyTierDone && (
                        <p className="tierNextHint">
                          Suggested next tier: <strong>{nextTierMeta.displayName}</strong> ({nextTierMeta.targetCount.toLocaleString()}{' '}
                          actions).
                        </p>
                      )}
                      <select
                        id={`tier-${achievement.id}`}
                        className="tierSelect"
                        value={tier ?? ''}
                        disabled={!achievement.automatable || everyTierDone}
                        onChange={(e) =>
                          setTierChoice((prev) => ({
                            ...prev,
                            [achievement.id]: e.target.value as TierLevel,
                          }))
                        }
                      >
                        {achievement.tiers.map((t) => {
                          const optDone = isTierFinished(achievement.tiers, achievement.progress, t.level);
                          return (
                            <option key={t.level} value={t.level} disabled={optDone}>
                              {optDone ? '✓ ' : ''}
                              {t.displayName} ({t.targetCount.toLocaleString()})
                              {optDone ? ' — completed' : ''}
                            </option>
                          );
                        })}
                      </select>

                      {achievement.docsUrl && (
                        <a className="docsLink" href={achievement.docsUrl} target="_blank" rel="noreferrer">
                          GitHub docs
                        </a>
                      )}
                      </div>
                    </section>

                    {feasibility && canFeas && (
                      <p className="feasibility feasibilityOk">
                        ~{feasibility.estimatedCallsForRemaining} REST calls estimated for remaining work (within current
                        quota margin).
                      </p>
                    )}

                    {feasibility && !canFeas && (
                      <div className="quotaAlert" role="alert">
                        <strong>Cannot complete this run with current API quota</strong>
                        <p>
                          This tier needs roughly <strong>{feasibility.estimatedCallsForRemaining}</strong> REST calls for what’s
                          left to do. GitHub reports <strong>{rateLimit?.remaining ?? '—'}</strong> core requests remaining
                          {rateLimit?.resetInSeconds != null && (
                            <>
                              {' '}
                              (resets in <strong>{formatReset(rateLimit.resetInSeconds)}</strong>)
                            </>
                          )}
                          . Wait for reset or switch to a lower tier—the Run button stays disabled until the estimate fits.
                        </p>
                      </div>
                    )}

                    {achievement.unavailableReasons.length > 0 && (
                      <ul className="reasonList">
                        {achievement.unavailableReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}

                    {cardErrors[achievement.id] && <div className="notice errorNotice">{cardErrors[achievement.id]}</div>}

                    <div className="cardActions cardActionsFooter">
                      <button
                        type="button"
                        className="primaryBtn"
                        disabled={
                          jobBlocking ||
                          !achievement.available ||
                          !achievement.automatable ||
                          !status?.ok ||
                          rateLimit?.state === 'error' ||
                          !canFeas ||
                          everyTierDone ||
                          tierFinishedSelection
                        }
                        onClick={() => void runAchievement(achievement)}
                      >
                        {progress?.status === 'in_progress' ? 'Resume run' : 'Run'}
                      </button>
                      {jobBlocking && <span className="mutedText">Wait for the active job to finish.</span>}
                      {everyTierDone && achievement.automatable && (
                        <span className="mutedText">All published tiers are marked complete in your database.</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && section === 'history' && (
            <section className="panel historyPanel">
              <div className="panelHead">
                <div>
                  <h2 className="panelTitle">Achievement snapshots</h2>
                  <p className="panelLead monoMuted">{history?.databasePath}</p>
                </div>
                <Badge tone={history?.ok ? 'ok' : 'error'}>{history?.ok ? 'Readable' : 'Needs repair'}</Badge>
              </div>
              {history?.error && <div className="notice errorNotice">{history.error}</div>}
              <div className="tableWrap">
                <table>
                  <caption className="srOnly">Achievement history records</caption>
                  <thead>
                    <tr>
                      <th scope="col">Achievement</th>
                      <th scope="col">Tier</th>
                      <th scope="col">Status</th>
                      <th scope="col">Progress</th>
                      <th scope="col">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedHistoryRows.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.tier}</td>
                        <td>{item.status}</td>
                        <td>
                          {Math.min(item.completedCount, item.targetCount)}/{item.targetCount}
                        </td>
                        <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {historyRows.length > HISTORY_PAGE_SIZE && (
                <div className="paginationBar" aria-label="Achievement history pagination">
                  <button
                    type="button"
                    className="paginationBtn"
                    disabled={safeHistoryPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <div className="paginationNumbers">
                    {getPageNumberWindow(safeHistoryPage, historyTotalPages).map((entry, idx) =>
                      entry === '...' ? (
                        <span key={`h-gap-${idx}`} className="paginationGap" aria-hidden>
                          …
                        </span>
                      ) : (
                        <button
                          key={`h-page-${entry}`}
                          type="button"
                          className={entry === safeHistoryPage ? 'paginationNum isActive' : 'paginationNum'}
                          onClick={() => setHistoryPage(entry)}
                          aria-current={entry === safeHistoryPage ? 'page' : undefined}
                        >
                          {entry}
                        </button>
                      )
                    )}
                  </div>
                  <button
                    type="button"
                    className="paginationBtn"
                    disabled={safeHistoryPage >= historyTotalPages}
                    onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}

              {operationRows.length > 0 && (
                <>
                  <h3 className="subsectionTitle">Recent operations</h3>
                  <p className="mutedText maxReadable">
                    Links open on GitHub using your <strong>TARGET_REPO</strong>:{' '}
                    {status?.repo?.fullName || status?.targetRepo || 'not configured'}.
                  </p>
                  <div className="tableWrap">
                    <table>
                      <caption className="srOnly">Stored workflow operations</caption>
                      <thead>
                        <tr>
                          <th scope="col">Achievement</th>
                          <th scope="col">Op #</th>
                          <th scope="col">Status</th>
                          <th scope="col">Links</th>
                          <th scope="col">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedOperationRows.map((op, idx) => {
                          const repoName = status?.repo?.fullName ?? status?.targetRepo ?? undefined;
                          const links = linksForOperation(repoName, op);
                          return (
                            <tr key={`${op.achievementId}-${op.operationNumber}-${idx}`}>
                              <td>{op.achievementId}</td>
                              <td>{op.operationNumber}</td>
                              <td>{op.status}</td>
                              <td>
                                {links.length === 0 ? (
                                  <span className="mutedText">—</span>
                                ) : (
                                  <ul className="linkCellList">
                                    {links.map((l) => (
                                      <li key={l.href}>
                                        <a href={l.href} target="_blank" rel="noreferrer">
                                          {l.label}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                              <td>{op.updatedAt ? new Date(op.updatedAt).toLocaleString() : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {operationRows.length > OPERATIONS_PAGE_SIZE && (
                    <div className="paginationBar" aria-label="Operations pagination">
                      <button
                        type="button"
                        className="paginationBtn"
                        disabled={safeOperationsPage <= 1}
                        onClick={() => setOperationsPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </button>
                      <div className="paginationNumbers">
                        {getPageNumberWindow(safeOperationsPage, operationsTotalPages).map((entry, pIdx) =>
                          entry === '...' ? (
                            <span key={`o-gap-${pIdx}`} className="paginationGap" aria-hidden>
                              …
                            </span>
                          ) : (
                            <button
                              key={`o-page-${entry}`}
                              type="button"
                              className={entry === safeOperationsPage ? 'paginationNum isActive' : 'paginationNum'}
                              onClick={() => setOperationsPage(entry)}
                              aria-current={entry === safeOperationsPage ? 'page' : undefined}
                            >
                              {entry}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        className="paginationBtn"
                        disabled={safeOperationsPage >= operationsTotalPages}
                        onClick={() => setOperationsPage((p) => Math.min(operationsTotalPages, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {!loading && section === 'settings' && (
            <div className="stack">
              <section className="panel">
                <div className="panelHead">
                  <div>
                    <h2 className="panelTitle">Environment</h2>
                    <p className="panelLead">Variable names only — token values are never shown.</p>
                  </div>
                  <Badge tone={status?.configValid ? 'ok' : 'error'}>{status?.configValid ? 'Valid' : 'Invalid'}</Badge>
                </div>
                <div className="codeBlock">
                  <p>TARGET_REPO={status?.targetRepo || 'owner/repo'}</p>
                  <p>GITHUB_TOKEN={status?.tokens.githubToken === 'present' ? 'present' : 'missing'}</p>
                  <p>HELPER_TOKEN={status?.tokens.helperToken === 'present' ? 'present' : 'missing'}</p>
                </div>
              </section>
              <section className="panel">
                <h2 className="panelTitle">Token rules</h2>
                <ul className="helpList">
                  <li>GITHUB_TOKEN must belong to the account that should receive badges.</li>
                  <li>HELPER_TOKEN must belong to a different helper account when running Galaxy Brain or YOLO.</li>
                  <li>The main account needs write access to the target repository for most workflows.</li>
                  <li>Never paste real tokens in chat, screenshots, commits, or issues.</li>
                </ul>
              </section>
              <section className="panel">
                <div className="panelHead">
                  <div>
                    <h2 className="panelTitle">Desktop notifications</h2>
                    <p className="panelLead">Browser permission — optional.</p>
                  </div>
                  <Badge tone="muted">Optional</Badge>
                </div>
                <p className="mutedText">
                  Browser notifications when a job finishes—useful if you switch tabs while a long run is active.
                </p>
                <p className="mutedText">
                  Permission:{' '}
                  <strong>{notifyPrefs.permission === 'unsupported' ? 'Not supported in this browser' : notifyPrefs.permission}</strong>
                  {notifyEnabled && (
                    <span> · Enabled for completed/failed jobs</span>
                  )}
                </p>
                <div className="cardActions">
                  <button
                    type="button"
                    className="secondaryBtn"
                    disabled={typeof Notification === 'undefined'}
                    onClick={async () => {
                      if (typeof Notification === 'undefined') return;
                      const perm = await Notification.requestPermission();
                      setNotifyPrefs({ permission: perm });
                      if (perm === 'granted') {
                        localStorage.setItem('achievementNotifyJobs', '1');
                        setNotifyEnabled(true);
                      }
                    }}
                  >
                    Request notification permission
                  </button>
                  <button
                    type="button"
                    className="linkBtn"
                    onClick={() => {
                      localStorage.removeItem('achievementNotifyJobs');
                      setNotifyEnabled(false);
                      if (typeof Notification !== 'undefined') {
                        setNotifyPrefs({ permission: Notification.permission });
                      }
                    }}
                  >
                    Stop using notifications
                  </button>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {jobBlocking && job && (
        <div className="stopRunFab" role="region" aria-label="Stop active run">
          <button
            type="button"
            className="stopRunFabBtn"
            disabled={cancelBusy || job.cancelRequested}
            onClick={() => void cancelActiveJob()}
          >
            {job.cancelRequested ? 'Stopping…' : cancelBusy ? 'Please wait…' : 'Stop run'}
          </button>
          <p className="stopRunFabHint">
            Finishes the current badge step, then skips the rest. Does not abort mid-request to GitHub.
          </p>
        </div>
      )}

      {job && !jobDrawerDismissed && (
        <aside className="jobDrawer" aria-label="Current job">
          <div className="jobDrawerHead">
            <div className="jobDrawerHeadText">
              <p className="jobDrawerKicker">Background task</p>
              <h2 className="jobDrawerTitle">Active job</h2>
            </div>
            <div className="jobDrawerHeadActions">
              <Badge
                tone={
                  job.status === 'completed'
                    ? 'ok'
                    : job.status === 'failed'
                      ? 'error'
                      : job.status === 'cancelled'
                        ? 'muted'
                        : 'warn'
                }
              >
                {job.status}
              </Badge>
              <button
                type="button"
                className="jobDrawerClose"
                onClick={() => setJobDrawerDismissed(true)}
                aria-label="Close job panel"
              >
                ×
              </button>
            </div>
          </div>
          <div className="jobGrid">
            {Object.entries(job.progress).map(([id, prog]) => (
              <div key={id} className="jobItem">
                <div>
                  <strong>{id}</strong>
                  <p>{prog.operation}</p>
                </div>
                <ProgressBar current={prog.current} total={prog.total} />
              </div>
            ))}
          </div>
          {job.errors.length > 0 && (
            <div className="jobErrors">
              {job.errors.map((error) => (
                <div key={error} className="issue issue-error">
                  {error}
                </div>
              ))}
              <button type="button" className="linkBtn" onClick={() => void copyText(job.errors.join('\n'))}>
                Copy errors
              </button>
            </div>
          )}
          <details className="jobLogs">
            <summary>Logs ({job.logs.length})</summary>
            <div className="logBox">
              {job.logs.length === 0 ? <p>No logs yet.</p> : job.logs.map((log) => <p key={log}>{log}</p>)}
            </div>
          </details>
          <p className="jobHint mutedText">
            Use <strong>Stop run</strong> (floating button) to skip remaining achievements after the current workflow step.
            Individual GitHub API calls are not interrupted mid-flight.
          </p>
        </aside>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'error' }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusLine({ label, ok, muted = false }: { label: string; ok: boolean; muted?: boolean }) {
  return (
    <div className="statusLine">
      <span>{label}</span>
      <Badge tone={muted ? 'muted' : ok ? 'ok' : 'error'}>{muted ? 'Not checked' : ok ? 'OK' : 'Issue'}</Badge>
    </div>
  );
}
