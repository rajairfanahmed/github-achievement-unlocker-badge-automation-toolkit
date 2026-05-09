import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Header, Select, type SelectItem, Confirm } from '../components/index.js';
import { colors, symbols, achievements, tierCounts, tierNames, type AchievementId, type TierLevel } from '../theme.js';

export interface SelectedAchievement {
  id: AchievementId;
  tier: TierLevel;
  count: number;
}

interface SelectScreenProps {
  hasHelper: boolean;
  hasDiscussions: boolean;
  onConfirm: (selections: SelectedAchievement[]) => void;
  onBack: () => void;
}

type SelectStep = 'achievements' | 'tier' | 'confirm';

export const SelectScreen: React.FC<SelectScreenProps> = ({
  hasHelper,
  hasDiscussions,
  onConfirm,
  onBack,
}) => {
  const [step, setStep] = useState<SelectStep>('achievements');
  const [selectedIds, setSelectedIds] = useState<Set<AchievementId>>(new Set());
  const [currentAchievement, setCurrentAchievement] = useState<AchievementId | null>(null);
  const [selections, setSelections] = useState<Map<AchievementId, SelectedAchievement>>(new Map());
  const [tierQueue, setTierQueue] = useState<AchievementId[]>([]);

  // Build achievement list based on available features
  const availableAchievements = Object.entries(achievements).filter(([, achievement]) => {
    if (!achievement.automatable) return false;
    if (achievement.requiresHelper && !hasHelper) return false;
    if (achievement.requiresDiscussions && !hasDiscussions) return false;
    return true;
  });

  // Handle escape to go back
  useInput((input, key) => {
    if (key.escape) {
      if (step === 'achievements') {
        onBack();
      } else if (step === 'tier') {
        setStep('achievements');
        setTierQueue([]);
        setCurrentAchievement(null);
      } else if (step === 'confirm') {
        setStep('achievements');
      }
    }
  });

  // Achievement selection
  const achievementItems: SelectItem<AchievementId | 'done'>[] = [
    ...availableAchievements.map(([id, achievement]) => {
      const isSelected = selectedIds.has(id as AchievementId);
      return {
        label: `${isSelected ? '[x]' : '[ ]'} ${achievement.icon} ${achievement.name}`,
        value: id as AchievementId,
        description: achievement.description,
        color: isSelected ? 'green' : undefined,
      };
    }),
    {
      label: `--- Continue`,
      value: 'done' as const,
      description: selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select at least one',
    },
  ];

  const handleAchievementSelect = (item: SelectItem<AchievementId | 'done'>) => {
    if (item.value === 'done') {
      if (selectedIds.size === 0) return;

      // Start tier selection for each selected achievement
      const queue = Array.from(selectedIds);
      setTierQueue(queue);
      setCurrentAchievement(queue[0]);
      setStep('tier');
    } else {
      // Toggle selection
      const newSelected = new Set(selectedIds);
      if (newSelected.has(item.value)) {
        newSelected.delete(item.value);
      } else {
        newSelected.add(item.value);
      }
      setSelectedIds(newSelected);
    }
  };

  // Tier selection
  const getTierItems = (achievementId: AchievementId): SelectItem<TierLevel>[] => {
    const achievement = achievements[achievementId];
    const counts = tierCounts[achievementId];

    return achievement.tiers.map((tier) => ({
      label: `${tierNames[tier]} (${counts[tier]} operations)`,
      value: tier,
    }));
  };

  const handleTierSelect = (item: SelectItem<TierLevel>) => {
    const achievementId = currentAchievement!;
    const count = tierCounts[achievementId][item.value];

    // Save selection
    const newSelections = new Map(selections);
    newSelections.set(achievementId, {
      id: achievementId,
      tier: item.value,
      count,
    });
    setSelections(newSelections);

    // Move to next achievement or confirm
    const currentIndex = tierQueue.indexOf(achievementId);
    if (currentIndex < tierQueue.length - 1) {
      setCurrentAchievement(tierQueue[currentIndex + 1]);
    } else {
      setStep('confirm');
    }
  };

  // Calculate totals
  const totalOps = Array.from(selections.values()).reduce((sum, s) => sum + s.count, 0);

  // Confirm handler
  const handleConfirm = (confirmed: boolean) => {
    if (confirmed) {
      onConfirm(Array.from(selections.values()));
    } else {
      setStep('achievements');
      setSelections(new Map());
      setSelectedIds(new Set());
    }
  };

  return (
    <Box flexDirection="column">
      <Header title="Select Achievements" />

      {step === 'achievements' && (
        <Box flexDirection="column">

          {!hasHelper && (
            <Box marginY={1}>
              <Text color={colors.warning}>
                {symbols.warning} Galaxy Brain and YOLO require a helper account (run setup to configure)
              </Text>
            </Box>
          )}

          <Box marginTop={1}>
            <Select
              items={achievementItems}
              onSelect={handleAchievementSelect}
            />
          </Box>
        </Box>
      )}

      {step === 'tier' && currentAchievement && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>
              {achievements[currentAchievement].icon}{' '}
              <Text bold>{achievements[currentAchievement].name}</Text>
              {' - '}
              <Text color={colors.muted}>Select tier</Text>
            </Text>
          </Box>

          <Select
            items={getTierItems(currentAchievement)}
            onSelect={handleTierSelect}
          />

          <Box marginTop={1}>
            <Text color={colors.muted} dimColor>
              Esc to go back
            </Text>
          </Box>
        </Box>
      )}

      {step === 'confirm' && (
        <Box flexDirection="column">
          <Text bold>Summary:</Text>
          <Box flexDirection="column" marginY={1}>
            {Array.from(selections.values()).map((selection) => (
              <Box key={selection.id}>
                <Text>
                  {achievements[selection.id].icon}{' '}
                  {achievements[selection.id].name}{' '}
                  <Text color={colors.muted}>
                    ({tierNames[selection.tier]}, {selection.count} ops)
                  </Text>
                </Text>
              </Box>
            ))}
          </Box>

          <Box marginBottom={1}>
            <Text>
              Total: <Text bold color={colors.primary}>{totalOps} operations</Text>
            </Text>
          </Box>

          <Confirm
            message="Start execution?"
            onConfirm={handleConfirm}
            defaultValue={true}
          />
        </Box>
      )}
    </Box>
  );
};

export default SelectScreen;
