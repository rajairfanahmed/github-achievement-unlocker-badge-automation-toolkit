import React from 'react';
import { Box, Text } from 'ink';
import { colors, symbols } from '../theme.js';

interface ProgressBarProps {
  current: number;
  total: number;
  width?: number;
  showPercentage?: boolean;
  showCount?: boolean;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  width = 20,
  showPercentage = true,
  showCount = true,
  color = colors.primary,
}) => {
  const safeTotal = Math.max(0, total);
  const safeWidth = Math.max(0, width);
  const safeCurrent = safeTotal > 0
    ? Math.min(Math.max(current, 0), safeTotal)
    : 0;
  const percentage = safeTotal > 0 ? Math.round((safeCurrent / safeTotal) * 100) : 0;
  const filled = safeTotal > 0 ? Math.round((safeCurrent / safeTotal) * safeWidth) : 0;
  const empty = safeWidth - filled;

  const bar = symbols.progress.filled.repeat(filled) + symbols.progress.empty.repeat(empty);

  return (
    <Box>
      <Text color={color}>{bar}</Text>
      {showPercentage && (
        <Text color={colors.muted}> {percentage.toString().padStart(3)}%</Text>
      )}
      {showCount && (
        <Text color={colors.muted}> ({safeCurrent}/{safeTotal})</Text>
      )}
    </Box>
  );
};

export default ProgressBar;
