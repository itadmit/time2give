import React from 'react';
import { View } from 'react-native';
import { REGION_GROUPS, regionLabel, type Region } from '../lib/regions';
import { Txt, Pill } from './ui';
import { spacing, colors } from '../theme/tokens';

/**
 * בורר אזורים מקובץ (§7.3). single = בחירה בודדת, אחרת מרובה.
 */
export function RegionPicker({
  value,
  onChange,
  single,
}: {
  value: Region[];
  onChange: (next: Region[]) => void;
  single?: boolean;
}) {
  const toggle = (r: Region) => {
    if (single) {
      onChange([r]);
      return;
    }
    onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  };

  return (
    <View style={{ gap: spacing.md }}>
      {REGION_GROUPS.map((group) => (
        <View key={group.title}>
          <Txt variant="caption" weight="bold" color={colors.textMuted} style={{ marginBottom: 6 }}>
            {group.title}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {group.regions.map((r) => (
              <Pill key={r} label={regionLabel(r)} active={value.includes(r)} onPress={() => toggle(r)} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
