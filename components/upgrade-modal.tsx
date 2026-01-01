import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Theme } from '../src/lib/theme';

type UpgradeModalProps = {
  visible: boolean;
  isPro: boolean;
  showDevToggle: boolean;
  onClose: () => void;
  onEnableDevPro?: () => void;
  theme: Theme;
};

export default function UpgradeModal({
  visible,
  isPro,
  showDevToggle,
  onClose,
  onEnableDevPro,
  theme,
}: UpgradeModalProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t('upgradeModal.title')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            {isPro ? t('upgradeModal.subtitleUnlocked') : t('upgradeModal.subtitleLocked')}
          </Text>
          <View style={styles.list}>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>
              - {t('proBenefits.exportAll')}
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>
              - {t('proBenefits.homeWidget')}
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>
              - {t('proBenefits.themePresets')}
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>
              - {t('proBenefits.incognitoIcons')}
            </Text>
          </View>
          {showDevToggle && !isPro ? (
            <>
              <Text style={[styles.notice, { color: theme.colors.muted }]}>
                {t('upgradeModal.comingSoon')}
              </Text>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
                onPress={onEnableDevPro}
                accessibilityRole="button"
              >
                <Text style={[styles.primaryButtonText, { color: theme.colors.primaryText }]}>
                  {t('upgradeModal.enableProDev')}
                </Text>
              </Pressable>
            </>
          ) : null}
          <Pressable
            style={[
              styles.secondaryButton,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
            ]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
              {t('common.close')}
            </Text>
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
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
  },
  list: {
    marginTop: 16,
    gap: 6,
  },
  listItem: {
    fontSize: 14,
  },
  notice: {
    marginTop: 16,
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
});
