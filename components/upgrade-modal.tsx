import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type UpgradeModalProps = {
  visible: boolean;
  isPro: boolean;
  showDevToggle: boolean;
  onClose: () => void;
  onEnableDevPro?: () => void;
};

export default function UpgradeModal({
  visible,
  isPro,
  showDevToggle,
  onClose,
  onEnableDevPro,
}: UpgradeModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Pro Upgrade</Text>
          <Text style={styles.subtitle}>
            {isPro ? 'Pro is already unlocked.' : 'Unlock these benefits:'}
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>- Export (PDF/Text/CSV)</Text>
            <Text style={styles.listItem}>- Home Widget (coming later)</Text>
            <Text style={styles.listItem}>- Theme presets</Text>
            <Text style={styles.listItem}>- Incognito icons</Text>
          </View>
          {showDevToggle && !isPro ? (
            <>
              <Text style={styles.notice}>Coming soon. Dev builds can unlock now.</Text>
              <Pressable
                style={styles.primaryButton}
                onPress={onEnableDevPro}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Enable Pro (dev)</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable style={styles.secondaryButton} onPress={onClose} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F242A',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#5C646E',
  },
  list: {
    marginTop: 16,
    gap: 6,
  },
  listItem: {
    fontSize: 14,
    color: '#1F242A',
  },
  notice: {
    marginTop: 16,
    fontSize: 12,
    color: '#5C646E',
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#2C6B8F',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#EEF1F4',
  },
  secondaryButtonText: {
    color: '#2E3A45',
    fontWeight: '600',
  },
});
