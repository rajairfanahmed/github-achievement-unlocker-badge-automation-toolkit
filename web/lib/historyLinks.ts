import type { WebHistory } from './types';

export interface HistoryLink {
  label: string;
  href: string;
}

/**
 * Build GitHub URLs for a stored operation when `TARGET_REPO` is known.
 */
export function linksForOperation(
  repoFullName: string | null | undefined,
  op: WebHistory['operations'][0]
): HistoryLink[] {
  if (!repoFullName?.includes('/')) {
    return [];
  }
  const [owner, repo] = repoFullName.split('/');
  const base = `https://github.com/${owner}/${repo}`;
  const out: HistoryLink[] = [];

  if (op.prNumber != null && op.prNumber > 0) {
    out.push({ label: `PR #${op.prNumber}`, href: `${base}/pull/${op.prNumber}` });
  }
  if (op.issueNumber != null && op.issueNumber > 0) {
    out.push({ label: `Issue #${op.issueNumber}`, href: `${base}/issues/${op.issueNumber}` });
  }
  if (op.discussionId != null && /^\d+$/.test(String(op.discussionId).trim())) {
    out.push({ label: `Discussion #${op.discussionId}`, href: `${base}/discussions/${op.discussionId}` });
  }
  if (op.branchName) {
    out.push({ label: op.branchName, href: `${base}/tree/${encodeURIComponent(op.branchName)}` });
  }

  return out;
}
