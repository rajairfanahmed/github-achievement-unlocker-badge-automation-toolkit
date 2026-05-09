import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Header, ProgressBar } from '../components/index.js';
import { colors, symbols, achievements, tierNames } from '../theme.js';
import { createAchievement } from '../../achievements/index.js';
import { initDatabase, closeDatabase } from '../../db/database.js';
import type { AppConfig, ExecutionResult } from '../../types/index.js';
import type { SelectedAchievement } from './SelectScreen.js';

interface AchievementProgress {
  id: string;
  name: string;
  icon: string;
  tier: string;
  current: number;
  total: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentOp?: string;
  error?: string;
}

interface ExecuteScreenProps {
  config: AppConfig;
  selections: SelectedAchievement[];
  onComplete: (results: ExecutionResult[]) => void;
  onBack: () => void;
}

export const ExecuteScreen: React.FC<ExecuteScreenProps> = ({
  config,
  selections,
  onComplete,
  onBack,
}) => {
  const [progress, setProgress] = useState<Map<string, AchievementProgress>>(new Map());
  const [isRunning, setIsRunning] = useState(true);
  const [results, setResults] = useState<ExecutionResult[]>([]);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  // Initialize progress state
  useEffect(() => {
    const initial = new Map<string, AchievementProgress>();
    selections.forEach((selection) => {
      const achievement = achievements[selection.id];
      initial.set(selection.id, {
        id: selection.id,
        name: achievement.name,
        icon: achievement.icon,
        tier: tierNames[selection.tier],
        current: 0,
        total: selection.count,
        status: 'pending',
      });
    });
    setProgress(initial);
  }, [selections]);

  // Update elapsed time
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  // Run achievements in parallel
  useEffect(() => {
    const run = async () => {
      initDatabase();

      // Mark all achievements as running
      setProgress((prev) => {
        const next = new Map(prev);
        for (const selection of selections) {
          const item = next.get(selection.id)!;
          next.set(selection.id, { ...item, status: 'running' });
        }
        return next;
      });

      // Create promises for all achievements to run in parallel
      const achievementPromises = selections.map(async (selection) => {
        try {
          const achievement = createAchievement(
            config,
            selection.id,
            selection.tier,
            selection.count
          );

          // Set progress callback
          achievement.setProgressCallback((update) => {
            setProgress((prev) => {
              const next = new Map(prev);
              const item = next.get(selection.id)!;
              next.set(selection.id, {
                ...item,
                current: update.current,
                currentOp: update.currentOperation,
              });
              return next;
            });
          });

          const result = await achievement.execute();

          // Update status to completed or failed
          setProgress((prev) => {
            const next = new Map(prev);
            const item = next.get(selection.id)!;
            next.set(selection.id, {
              ...item,
              status: result.success ? 'completed' : 'failed',
              current: result.completedOperations,
              error: result.errors.length > 0 ? result.errors[0] : undefined,
            });
            return next;
          });

          return result;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);

          setProgress((prev) => {
            const next = new Map(prev);
            const item = next.get(selection.id)!;
            next.set(selection.id, {
              ...item,
              status: 'failed',
              error: errorMsg,
            });
            return next;
          });

          return {
            achievementId: selection.id,
            tier: selection.tier,
            success: false,
            completedOperations: 0,
            totalOperations: selection.count,
            errors: [errorMsg],
            duration: 0,
            prNumbers: [],
          } as ExecutionResult;
        }
      });

      // Wait for all achievements to complete
      const allResults = await Promise.all(achievementPromises);

      closeDatabase();
      setResults(allResults);
      setIsRunning(false);
    };

    run();
  }, [config, selections]);

  // Handle input when complete
  useInput((input, key) => {
    if (!isRunning && key.return) {
      onComplete(results);
    }
    if (key.escape && !isRunning) {
      onBack();
    }
  });

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const totalOps = selections.reduce((sum, s) => sum + s.count, 0);
  const completedOps = Array.from(progress.values()).reduce(
    (sum, p) => sum + Math.min(Math.max(p.current, 0), p.total),
    0
  );
  const successCount = Array.from(progress.values()).filter((p) => p.status === 'completed').length;
  const failedCount = Array.from(progress.values()).filter((p) => p.status === 'failed').length;

  return (
    <Box flexDirection="column">
      <Header title="Executing" subtitle={`${formatDuration(elapsed)} elapsed`} />

      <Box flexDirection="column" marginY={1}>
        {Array.from(progress.values()).map((item) => (
          <Box key={item.id} flexDirection="column" marginBottom={1}>
            <Box>
              {item.status === 'running' && (
                <Text color={colors.primary}>● </Text>
              )}
              {item.status === 'completed' && (
                <Text color={colors.success}>{symbols.success} </Text>
              )}
              {item.status === 'failed' && (
                <Text color={colors.error}>{symbols.error} </Text>
              )}
              {item.status === 'pending' && (
                <Text color={colors.muted}>{symbols.bullet} </Text>
              )}
              <Text bold={item.status === 'running'}>
                {item.icon} {item.name}
              </Text>
              <Text color={colors.muted}> ({item.tier})</Text>
            </Box>

            {(item.status === 'running' || item.status === 'completed' || item.status === 'failed') && (
              <Box marginLeft={2}>
                <ProgressBar
                  current={item.current}
                  total={item.total}
                  width={30}
                  color={
                    item.status === 'completed'
                      ? colors.success
                      : item.status === 'failed'
                      ? colors.error
                      : colors.primary
                  }
                />
              </Box>
            )}

            {item.status === 'running' && item.currentOp && (
              <Box marginLeft={2}>
                <Text color={colors.muted} dimColor>
                  {item.currentOp}
                </Text>
              </Box>
            )}

            {item.error && (
              <Box marginLeft={2}>
                <Text color={colors.error} dimColor>
                  {item.error}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={colors.muted}>{'─'.repeat(50)}</Text>
        <Box>
          <Text>
            Progress: <Text bold>{completedOps}/{totalOps}</Text> operations
          </Text>
        </Box>

        {!isRunning && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Results:</Text>
            <Box>
              <Text color={colors.success}>{symbols.success} {successCount} succeeded</Text>
              {failedCount > 0 && (
                <Text color={colors.error}>  {symbols.error} {failedCount} failed</Text>
              )}
            </Box>
            <Box marginTop={1}>
              <Text color={colors.muted}>Press Enter to continue, Esc to go back</Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ExecuteScreen;
