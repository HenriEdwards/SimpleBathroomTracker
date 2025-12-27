import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { Theme } from '../lib/theme';

type IconPickerModalProps = {
  visible: boolean;
  title: string;
  selected: string;
  options: string[];
  onSelect: (icon: string) => void;
  onClose: () => void;
  theme: Theme;
};

export default function IconPickerModal({
  visible,
  title,
  selected,
  options,
  onSelect,
  onClose,
  theme,
}: IconPickerModalProps) {
  const { width } = useWindowDimensions();
  const columns = width < 360 ? 3 : 4;
  const gap = 12;
  const sheetPadding = 16;
  const sidePadding = 24 + sheetPadding;
  const itemSize = Math.floor((width - sidePadding * 2 - gap * (columns - 1)) / columns);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.colors.card }]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
            <Pressable
              style={[styles.closeButton, { borderColor: theme.colors.border }]}
              onPress={onClose}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
          <View style={[styles.options, { gap }]}>
            {options.map((icon) => {
              const active = icon === selected;
              return (
                <Pressable
                  key={icon}
                  onPress={() => onSelect(icon)}
                  style={[
                    styles.option,
                    {
                      width: itemSize,
                      height: itemSize,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                      backgroundColor: active ? theme.colors.primary : theme.colors.card,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? theme.colors.primaryText : theme.colors.text,
                      fontSize: 24,
                    }}
                  >
                    {icon}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    padding: 24,
  },
  sheet: {
    borderRadius: 20,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  option: {
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
