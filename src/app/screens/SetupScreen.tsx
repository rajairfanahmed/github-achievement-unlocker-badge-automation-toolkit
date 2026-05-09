import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { Header, TextInput, Spinner, StatusMessage, Confirm } from '../components/index.js';
import { colors, symbols } from '../theme.js';
import { validateTokenFormat, quickValidateToken } from '../../github/auth.js';
import { initGitHubClient, getGitHubClient } from '../../github/client.js';
import { areDiscussionsEnabled } from '../../github/discussion.js';
import { createEnvFile } from '../../utils/config.js';
import type { AppConfig, UserInfo } from '../../types/index.js';

type SetupStep =
  | 'token'
  | 'validating-token'
  | 'repo'
  | 'validating-repo'
  | 'discussions-check'
  | 'helper-prompt'
  | 'helper-token'
  | 'validating-helper'
  | 'checking-collaborator'
  | 'invite-collaborator'
  | 'inviting-collaborator'
  | 'saving'
  | 'star-prompt'
  | 'starring'
  | 'complete';

interface SetupScreenProps {
  onComplete: (config: AppConfig) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const { exit } = useApp();

  const [step, setStep] = useState<SetupStep>('token');
  const [token, setToken] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const [repo, setRepo] = useState('');
  const [repoError, setRepoError] = useState('');
  const [hasDiscussions, setHasDiscussions] = useState(false);

  const [wantsHelper, setWantsHelper] = useState(false);
  const [helperToken, setHelperToken] = useState('');
  const [helperError, setHelperError] = useState('');
  const [helperUser, setHelperUser] = useState<UserInfo | null>(null);
  const [helperIsCollaborator, setHelperIsCollaborator] = useState(false);

  const [savedConfig, setSavedConfig] = useState<AppConfig | null>(null);

  // Handle token submission
  const handleTokenSubmit = async (value: string) => {
    if (!value.trim()) {
      setTokenError('Token is required');
      return;
    }

    if (!validateTokenFormat(value.trim())) {
      setTokenError('Invalid format. Token should start with "ghp_" or "github_pat_"');
      return;
    }

    setTokenError('');
    setStep('validating-token');

    try {
      const user = await quickValidateToken(value.trim());
      setUserInfo(user);
      setRepo(`${user.login}/GitHub-Achievements-Manager`);
      setStep('repo');
    } catch (error) {
      setTokenError('Token validation failed. Check your token and try again.');
      setStep('token');
    }
  };

  // Handle repo submission
  const handleRepoSubmit = async (value: string) => {
    if (!value.trim()) {
      setRepoError('Repository is required');
      return;
    }

    if (!value.includes('/')) {
      setRepoError('Format should be "owner/repo"');
      return;
    }

    setRepoError('');
    setStep('validating-repo');

    try {
      const [owner, repoName] = value.trim().split('/');

      // Initialize client temporarily for validation
      const tempConfig: AppConfig = {
        githubToken: token.trim(),
        githubUsername: userInfo!.login,
        targetRepo: value.trim(),
        coauthorName: 'n0',
        coauthorEmail: 'luke@u.software',
        branchPrefix: 'achievement',
        delayMs: 200,
        batchSize: 5,
        verbose: false,
        testMode: false,
        logLevel: 'info',
        concurrency: 3,
        maxRequestsPerMinute: 70,
      };

      initGitHubClient(tempConfig);

      // Check discussions
      setStep('discussions-check');
      const discussionsEnabled = await areDiscussionsEnabled(owner, repoName);
      setHasDiscussions(discussionsEnabled);

      if (discussionsEnabled) {
        setStep('helper-prompt');
      } else {
        // Skip helper setup if no discussions
        setStep('saving');
        await saveConfig(false, '');
      }
    } catch (error) {
      setRepoError('Could not access repository. Check the name and your permissions.');
      setStep('repo');
    }
  };

  // Handle helper prompt
  const handleHelperChoice = (wants: boolean) => {
    setWantsHelper(wants);
    if (wants) {
      setStep('helper-token');
    } else {
      setStep('saving');
      saveConfig(false, '');
    }
  };

  // Handle helper token submission
  const handleHelperSubmit = async (value: string) => {
    if (!value.trim()) {
      setHelperError('Token is required for Galaxy Brain/YOLO');
      return;
    }

    if (!validateTokenFormat(value.trim())) {
      setHelperError('Invalid format. Token should start with "ghp_" or "github_pat_"');
      return;
    }

    setHelperError('');
    setStep('validating-helper');

    try {
      const helper = await quickValidateToken(value.trim());

      if (helper.login === userInfo!.login) {
        setHelperError('Helper account must be different from your main account');
        setStep('helper-token');
        return;
      }

      setHelperUser(helper);

      // Check if helper is already a collaborator
      setStep('checking-collaborator');
      const [owner, repoName] = repo.trim().split('/');
      const client = getGitHubClient();
      const isCollab = await client.isCollaborator(owner, repoName, helper.login);

      if (isCollab) {
        setHelperIsCollaborator(true);
        setStep('saving');
        await saveConfig(true, value.trim());
      } else {
        setHelperIsCollaborator(false);
        setStep('invite-collaborator');
      }
    } catch (error) {
      setHelperError('Token validation failed. Check your token and try again.');
      setStep('helper-token');
    }
  };

  // Handle collaborator invite choice
  const handleInviteChoice = async (invite: boolean) => {
    if (invite) {
      setStep('inviting-collaborator');
      const [owner, repoName] = repo.trim().split('/');
      const client = getGitHubClient();
      const success = await client.addCollaborator(owner, repoName, helperUser!.login);

      if (success) {
        setHelperIsCollaborator(true);
      }
    }

    setStep('saving');
    await saveConfig(true, helperToken.trim());
  };

  // Save configuration
  const saveConfig = async (withHelper: boolean, helperTokenValue: string) => {
    const config: AppConfig = {
      githubToken: token.trim(),
      githubUsername: userInfo!.login,
      targetRepo: repo.trim(),
      coauthorName: 'n0',
      coauthorEmail: 'luke@u.software',
      branchPrefix: 'achievement',
      delayMs: 200,
      batchSize: 5,
      verbose: false,
      testMode: false,
      logLevel: 'info',
      concurrency: 3,
      maxRequestsPerMinute: 70,
      helperToken: withHelper ? helperTokenValue : undefined,
    };

    createEnvFile({
      githubToken: token.trim(),
      targetRepo: repo.trim(),
      coauthorName: 'n0',
      coauthorEmail: 'luke@u.software',
      branchPrefix: 'achievement',
      delayMs: 1000,
      helperToken: withHelper ? helperTokenValue : undefined,
    }, userInfo!.login);

    setSavedConfig(config);
    setStep('star-prompt');
  };

  // Handle star repo choice
  const handleStarChoice = async (wantsStar: boolean) => {
    if (wantsStar) {
      setStep('starring');
      const client = getGitHubClient();

      // Star on main account
      await client.starRepo('n0', 'GitHub-Achievement-CLI');

      // Star on helper account if available
      if (helperToken.trim()) {
        const { Octokit } = await import('@octokit/rest');
        const helperOctokit = new Octokit({
          auth: helperToken.trim(),
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
        try {
          await helperOctokit.activity.starRepoForAuthenticatedUser({
            owner: 'n0',
            repo: 'GitHub-Achievement-CLI',
          });
        } catch {
          // Ignore errors for helper starring
        }
      }
    }

    setStep('complete');

    // Brief delay to show completion message
    setTimeout(() => {
      onComplete(savedConfig!);
    }, 1500);
  };

  return (
    <Box flexDirection="column">
      <Header title="Setup" subtitle="First-time configuration" />

      <Box flexDirection="column" marginY={1}>
        <Text color={colors.muted}>
          Welcome! Let's get you set up. You'll need a GitHub Personal Access Token.
        </Text>
        <Text color={colors.muted}>
          Generate one at: <Text color={colors.primary}>https://github.com/settings/tokens</Text>
        </Text>
        <Text color={colors.muted}>
          Required scope: <Text bold>repo</Text>
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {/* Token input */}
        {step === 'token' && (
          <TextInput
            label="GitHub Token"
            placeholder="ghp_..."
            mask="*"
            value={token}
            onChange={setToken}
            onSubmit={handleTokenSubmit}
            error={tokenError}
            hint="Paste your Personal Access Token"
          />
        )}

        {step === 'validating-token' && (
          <Spinner label="Validating token..." />
        )}

        {/* Repo input */}
        {step === 'repo' && (
          <Box flexDirection="column">
            <StatusMessage
              type="success"
              message={`Authenticated as ${userInfo!.login}`}
            />
            <Box marginTop={1}>
              <TextInput
                label="Target Repository"
                placeholder="owner/repo"
                value={repo}
                onChange={setRepo}
                onSubmit={handleRepoSubmit}
                error={repoError}
                hint="Repository where achievements will be created"
              />
            </Box>
          </Box>
        )}

        {step === 'validating-repo' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <Box marginTop={1}>
              <Spinner label="Checking repository access..." />
            </Box>
          </Box>
        )}

        {step === 'discussions-check' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            <Box marginTop={1}>
              <Spinner label="Checking Discussions status..." />
            </Box>
          </Box>
        )}

        {/* Helper account prompt */}
        {step === 'helper-prompt' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            <StatusMessage type="success" message="Discussions enabled" />
            <Box marginTop={1} flexDirection="column">
              <Text color={colors.muted}>
                Galaxy Brain and YOLO achievements require a second GitHub account.
              </Text>
              <Text color={colors.muted}>
                The helper account creates questions/reviews, your main account responds.
              </Text>
            </Box>
            <Box marginTop={1}>
              <Confirm
                message="Configure Galaxy Brain/YOLO? (requires 2nd account)"
                onConfirm={handleHelperChoice}
                defaultValue={true}
              />
            </Box>
          </Box>
        )}

        {/* Helper token input */}
        {step === 'helper-token' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            <StatusMessage type="success" message="Discussions enabled" />
            <Box marginTop={1}>
              <TextInput
                label="Helper Account Token"
                placeholder="ghp_..."
                mask="*"
                value={helperToken}
                onChange={setHelperToken}
                onSubmit={handleHelperSubmit}
                error={helperError}
                hint="Token from your second GitHub account"
              />
            </Box>
          </Box>
        )}

        {step === 'validating-helper' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            <StatusMessage type="success" message="Discussions enabled" />
            <Box marginTop={1}>
              <Spinner label="Validating helper account..." />
            </Box>
          </Box>
        )}

        {step === 'checking-collaborator' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            <StatusMessage type="success" message="Discussions enabled" />
            <StatusMessage type="success" message={`Helper account: ${helperUser?.login}`} />
            <Box marginTop={1}>
              <Spinner label="Checking collaborator access..." />
            </Box>
          </Box>
        )}

        {step === 'invite-collaborator' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            <StatusMessage type="success" message="Discussions enabled" />
            <StatusMessage type="success" message={`Helper account: ${helperUser?.login}`} />
            <Box marginTop={1} flexDirection="column">
              <Text color={colors.warning}>
                Helper account needs collaborator access on {repo}
              </Text>
              <Text color={colors.muted}>
                This allows them to create discussions and submit PR reviews.
              </Text>
            </Box>
            <Box marginTop={1}>
              <Confirm
                message={`Invite ${helperUser?.login} as collaborator?`}
                onConfirm={handleInviteChoice}
                defaultValue={true}
              />
            </Box>
          </Box>
        )}

        {step === 'inviting-collaborator' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            <StatusMessage type="success" message="Discussions enabled" />
            <StatusMessage type="success" message={`Helper account: ${helperUser?.login}`} />
            <Box marginTop={1}>
              <Spinner label={`Inviting ${helperUser?.login} as collaborator...`} />
            </Box>
          </Box>
        )}

        {/* Saving */}
        {step === 'saving' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            {hasDiscussions && <StatusMessage type="success" message="Discussions enabled" />}
            {helperUser && <StatusMessage type="success" message={`Helper account: ${helperUser.login}`} />}
            <Box marginTop={1}>
              <Spinner label="Saving configuration..." />
            </Box>
          </Box>
        )}

        {/* Star prompt */}
        {step === 'star-prompt' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            {hasDiscussions && <StatusMessage type="success" message="Discussions enabled" />}
            {helperUser && <StatusMessage type="success" message={`Helper account: ${helperUser.login}`} />}
            <StatusMessage type="success" message="Configuration saved!" />
            <Box marginTop={1}>
              <Confirm
                message="Star n0/GitHub-Achievement-CLI on GitHub?"
                onConfirm={handleStarChoice}
                defaultValue={true}
              />
            </Box>
          </Box>
        )}

        {/* Starring */}
        {step === 'starring' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            {hasDiscussions && <StatusMessage type="success" message="Discussions enabled" />}
            {helperUser && <StatusMessage type="success" message={`Helper account: ${helperUser.login}`} />}
            <StatusMessage type="success" message="Configuration saved!" />
            <Box marginTop={1}>
              <Spinner label="Starring repository..." />
            </Box>
          </Box>
        )}

        {/* Complete */}
        {step === 'complete' && (
          <Box flexDirection="column">
            <StatusMessage type="success" message={`Authenticated as ${userInfo!.login}`} />
            <StatusMessage type="success" message={`Repository: ${repo}`} />
            {hasDiscussions && <StatusMessage type="success" message="Discussions enabled" />}
            {helperUser && <StatusMessage type="success" message={`Helper account: ${helperUser.login}`} />}
            <Box marginTop={1}>
              <StatusMessage type="success" message="Configuration saved!" />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SetupScreen;
