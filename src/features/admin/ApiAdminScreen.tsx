import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { KrdsCard } from "@/components/KrdsCard";
import { SectionHeader } from "@/components/SectionHeader";
import { fetchManagedApis, ManagedApiEndpoint } from "@/services/serverApi";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export function ApiAdminScreen() {
  const [apis, setApis] = useState<ManagedApiEndpoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchManagedApis().then(setApis).catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <AppScreen>
      <SectionHeader
        title="API 관리자"
        description="doc/api 가이드 기준으로 앱에서 사용하는 공공 API를 관리합니다."
      />

      <KrdsCard>
        <View style={styles.summaryRow}>
          <MaterialCommunityIcons name="key-chain" size={28} color={colors.primary} />
          <View style={styles.summaryText}>
            <Text style={styles.cardTitle}>통합 인증키</Text>
            <Text style={styles.body}>서버 환경변수로 보관하며 앱에는 노출하지 않습니다.</Text>
          </View>
        </View>
      </KrdsCard>

      {error ? (
        <KrdsCard>
          <Text style={styles.cardTitle}>서버 연결 필요</Text>
          <Text style={styles.body}>{error}</Text>
          <Text style={styles.meta}>서버 실행 후 /admin/apis에서 목록을 불러옵니다.</Text>
        </KrdsCard>
      ) : null}

      {apis.map((api) => (
        <KrdsCard key={api.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{api.name}</Text>
            <View style={[styles.badge, api.enabled ? styles.enabled : styles.disabled]}>
              <Text style={styles.badgeText}>{api.enabled ? "사용" : "대기"}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{api.provider} · {api.category} · {api.operation}</Text>
          <Text style={styles.body}>{api.description}</Text>
          <Text style={styles.url}>{api.method} {api.url}</Text>
          <Text style={styles.meta}>문서: {api.doc_file}</Text>
        </KrdsCard>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  summaryText: {
    flex: 1,
    gap: spacing.xs
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  cardTitle: {
    flex: 1,
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  body: {
    ...typography.body,
    color: colors.text
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted
  },
  url: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  enabled: {
    backgroundColor: colors.success
  },
  disabled: {
    backgroundColor: colors.textMuted
  },
  badgeText: {
    ...typography.caption,
    color: colors.onPrimary
  }
});
