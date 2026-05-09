/**
 * Theme configuration for Ink CLI
 */

// Color palette
export const colors = {
  primary: 'yellow',
  secondary: 'cyan',
  success: 'green',
  error: 'red',
  warning: 'yellow',
  info: 'blue',
  muted: 'gray',

  // Tier colors
  tier: {
    default: 'white',
    bronze: 'yellow',
    silver: 'white',
    gold: 'yellow',
  },
} as const;

// Achievement icons
export const icons = {
  'pair-extraordinaire': '👥',
  'pull-shark': '🦈',
  'galaxy-brain': '🧠',
  'quickdraw': '🤠',
  'yolo': '🎲',
  'starstruck': '🌟',
  'public-sponsor': '💝',
  'heart-on-your-sleeve': '❤️',
  'open-sourcerer': '🧙',
  'arctic-code-vault-contributor': '🧊',
  'mars-2020-contributor': '🚀',
} as const;

// Status symbols
export const symbols = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  arrow: '→',
  arrowRight: '›',
  bullet: '•',
  checkbox: '☐',
  checkboxChecked: '☑',
  radioOn: '◉',
  radioOff: '○',
  star: '★',
  progress: {
    filled: '█',
    empty: '░',
  },
} as const;

// Tier display names
export const tierNames = {
  default: 'Default',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
} as const;

// Achievement tier requirements (target counts / operations)
export const tierCounts = {
  'pair-extraordinaire': { default: 1, bronze: 10, silver: 24, gold: 48 },
  'pull-shark': { default: 2, bronze: 16, silver: 128, gold: 1024 },
  'galaxy-brain': { default: 2, bronze: 8, silver: 16, gold: 32 },
  'quickdraw': { default: 1, bronze: 1, silver: 1, gold: 1 },
  'yolo': { default: 1, bronze: 1, silver: 1, gold: 1 },
  'starstruck': { default: 16, bronze: 128, silver: 512, gold: 4096 },
  'public-sponsor': { default: 1, bronze: 1, silver: 1, gold: 1 },
  'heart-on-your-sleeve': { default: 1, bronze: 1, silver: 1, gold: 1 },
  'open-sourcerer': { default: 1, bronze: 1, silver: 1, gold: 1 },
  'arctic-code-vault-contributor': { default: 1, bronze: 1, silver: 1, gold: 1 },
  'mars-2020-contributor': { default: 1, bronze: 1, silver: 1, gold: 1 },
} as const;

// Achievement metadata
export const achievements = {
  'pair-extraordinaire': {
    name: 'Pair Extraordinaire',
    description: 'Coauthored commits on merged pull requests',
    icon: '👥',
    tiers: ['default', 'bronze', 'silver', 'gold'] as const,
    requiresHelper: false,
    requiresDiscussions: false,
    automatable: true,
  },
  'pull-shark': {
    name: 'Pull Shark',
    description: 'Opened pull requests that have been merged',
    icon: '🦈',
    tiers: ['default', 'bronze', 'silver', 'gold'] as const,
    requiresHelper: false,
    requiresDiscussions: false,
    automatable: true,
  },
  'galaxy-brain': {
    name: 'Galaxy Brain',
    description: 'Answered discussions (requires helper account)',
    icon: '🧠',
    tiers: ['default', 'bronze', 'silver', 'gold'] as const,
    requiresHelper: true,
    requiresDiscussions: true,
    automatable: true,
  },
  'quickdraw': {
    name: 'Quickdraw',
    description: 'Closed an issue within 5 minutes of opening',
    icon: '🤠',
    tiers: ['default'] as const,
    requiresHelper: false,
    requiresDiscussions: false,
    automatable: true,
  },
  'yolo': {
    name: 'YOLO',
    description: 'Merged PR without code review (requires helper account)',
    icon: '🎲',
    tiers: ['default'] as const,
    requiresHelper: true,
    requiresDiscussions: false,
    automatable: true,
  },
  'starstruck': {
    name: 'Starstruck',
    description: 'Stars on target repo — polls GitHub stargazer count',
    icon: '🌟',
    tiers: ['default', 'bronze', 'silver', 'gold'] as const,
    requiresHelper: false,
    requiresDiscussions: false,
    automatable: true,
  },
  'public-sponsor': {
    name: 'Public Sponsor',
    description: 'Verify public sponsorship after subscribing on GitHub Sponsors',
    icon: '💝',
    tiers: ['default'] as const,
    requiresHelper: false,
    requiresDiscussions: false,
    automatable: true,
  },
  'heart-on-your-sleeve': {
    name: 'Heart On Your Sleeve',
    description: 'Planned — GitHub rules still in flux',
    icon: '❤️',
    tiers: ['default'] as const,
    requiresHelper: false,
    requiresDiscussions: false,
    automatable: false,
  },
  'open-sourcerer': {
    name: 'Open Sourcerer',
    description: 'Planned — GitHub rules still in flux',
    icon: '🧙',
    tiers: ['default'] as const,
    requiresHelper: false,
    requiresDiscussions: false,
    automatable: false,
  },
  'arctic-code-vault-contributor': {
    name: 'Arctic Code Vault Contributor',
    description: 'Historical — no longer earnable',
    icon: '🧊',
    tiers: ['default'] as const,
    requiresHelper: false,
    requiresDiscussions: false,
    automatable: false,
  },
  'mars-2020-contributor': {
    name: 'Mars 2020 Contributor',
    description: 'Historical — no longer earnable',
    icon: '🚀',
    tiers: ['default'] as const,
    requiresHelper: false,
    requiresDiscussions: false,
    automatable: false,
  },
} as const;

export type AchievementId = keyof typeof achievements;
export type TierLevel = 'default' | 'bronze' | 'silver' | 'gold';
