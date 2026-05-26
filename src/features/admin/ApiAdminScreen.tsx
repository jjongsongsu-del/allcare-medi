import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { KrdsCard } from "@/components/KrdsCard";
import { SectionHeader } from "@/components/SectionHeader";
import {
  FacilityReport,
  fetchAdminHealthContents,
  fetchFacilityReports,
  fetchManagedApis,
  HealthContentSyncResult,
  ManagedApiEndpoint,
  seedAdminHealthContents,
  syncAdminHealthContents,
  syncAdminHealthContent,
  updateAdminHealthContent,
  updateFacilityReportStatus
} from "@/services/serverApi";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { HealthContent } from "@/types/domain";

export function ApiAdminScreen() {
  const [apis, setApis] = useState<ManagedApiEndpoint[]>([]);
  const [reports, setReports] = useState<FacilityReport[]>([]);
  const [healthContents, setHealthContents] = useState<HealthContent[]>([]);
  const [healthQuery, setHealthQuery] = useState("");
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [syncResult, setSyncResult] = useState<HealthContentSyncResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setError(null);
    try {
      const [apiRows, reportRows, contentRows] = await Promise.all([
        fetchManagedApis(),
        fetchFacilityReports().catch(() => []),
        fetchAdminHealthContents({ limit: 100 })
      ]);
      setApis(apiRows);
      setReports(reportRows);
      setHealthContents(contentRows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "관리자 데이터를 불러오지 못했습니다.");
    }
  };

  const searchHealthContents = async () => {
    setError(null);
    try {
      setHealthContents(await fetchAdminHealthContents({ query: healthQuery, limit: 100 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "건강정보 검색에 실패했습니다.");
    }
  };

  const seedHealthContents = async () => {
    setLoadingMessage("KDCA 건강정보 목록을 DB에 저장하는 중입니다.");
    try {
      const result = await seedAdminHealthContents();
      setSyncResult(result);
      setHealthContents(await fetchAdminHealthContents({ query: healthQuery, limit: 100 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "건강정보 목록 저장에 실패했습니다.");
    } finally {
      setLoadingMessage(null);
    }
  };

  const syncHealthDetails = async () => {
    setLoadingMessage("KDCA OpenAPI에서 상세 콘텐츠를 다시 가져오는 중입니다. 663건 전체 갱신은 시간이 걸릴 수 있습니다.");
    try {
      const result = await syncAdminHealthContents();
      setSyncResult(result);
      setHealthContents(await fetchAdminHealthContents({ query: healthQuery, limit: 100 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "건강정보 상세 갱신에 실패했습니다.");
    } finally {
      setLoadingMessage(null);
    }
  };

  const startUrlEdit = (content: HealthContent) => {
    setEditingSerial(content.contentSerial ?? content.id);
    setUrlDraft(content.sourceUrl ?? "");
  };

  const saveUrlEdit = async () => {
    if (!editingSerial) return;
    const saved = await updateAdminHealthContent(editingSerial, { sourceUrl: urlDraft });
    setHealthContents((current) => current.map((item) => (item.contentSerial === saved.contentSerial ? saved : item)));
    setEditingSerial(null);
    setUrlDraft("");
  };

  const syncSingleContent = async (content: HealthContent) => {
    const serial = content.contentSerial ?? content.id;
    try {
      const saved = await syncAdminHealthContent(serial);
      setHealthContents((current) => current.map((item) => (item.contentSerial === saved.contentSerial ? saved : item)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "건강정보 상세 갱신에 실패했습니다.");
    }
  };

  const changeReportStatus = async (report: FacilityReport, status: FacilityReport["status"]) => {
    const saved = await updateFacilityReportStatus(report.id, status);
    setReports((current) => current.map((item) => item.id === saved.id ? saved : item));
  };

  return (
    <AppScreen>
      <SectionHeader
        title="API 관리자"
        description="앱에서 사용하는 공공 API와 KDCA 건강정보 콘텐츠를 관리합니다."
      />

      <KrdsCard>
        <View style={styles.summaryRow}>
          <MaterialCommunityIcons name="key-chain" size={28} color={colors.primary} />
          <View style={styles.summaryText}>
            <Text style={styles.cardTitle}>통합 인증키</Text>
            <Text style={styles.body}>API 키는 서버 환경변수로만 관리하며 앱에는 노출하지 않습니다.</Text>
          </View>
        </View>
      </KrdsCard>

      {error ? (
        <KrdsCard>
          <Text style={styles.cardTitle}>확인 필요</Text>
          <Text style={styles.body}>{error}</Text>
        </KrdsCard>
      ) : null}

      <SectionHeader
        title="KDCA 건강정보"
        description="엑셀 기준 663개 목록과 콘텐츠별 OpenAPI URL을 DB에서 관리합니다."
      />

      <KrdsCard>
        <View style={styles.searchRow}>
          <TextInput
            value={healthQuery}
            onChangeText={setHealthQuery}
            onSubmitEditing={searchHealthContents}
            placeholder="질병명, 건강문제, 분류 검색"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <AdminButton label="검색" onPress={searchHealthContents} />
        </View>
        <View style={styles.reportActionRow}>
          <AdminButton label="목록 저장" onPress={seedHealthContents} />
          <AdminButton label="상세 갱신" onPress={syncHealthDetails} />
          <AdminButton label="새로고침" onPress={loadAdminData} />
        </View>
        {loadingMessage ? <Text style={styles.meta}>{loadingMessage}</Text> : null}
        {syncResult ? (
          <Text style={styles.meta}>처리 {syncResult.total}건 · 저장 {syncResult.updated}건 · 실패 {syncResult.failed}건</Text>
        ) : null}
      </KrdsCard>

      {healthContents.map((content) => {
        const serial = content.contentSerial ?? content.id;
        const editing = editingSerial === serial;
        return (
          <KrdsCard key={serial}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{content.title}</Text>
              <View style={[styles.badge, content.syncStatus === "synced" ? styles.enabled : styles.disabled]}>
                <Text style={styles.badgeText}>{content.syncStatus ?? "metadata"}</Text>
              </View>
            </View>
            <Text style={styles.meta}>{serial} · {content.category ?? "분류 없음"} · {content.superclass ?? "상위분류 없음"}</Text>
            <Text style={styles.body} numberOfLines={3}>{content.summary}</Text>
            {editing ? (
              <View style={styles.urlEditBox}>
                <TextInput value={urlDraft} onChangeText={setUrlDraft} style={styles.input} autoCapitalize="none" />
                <View style={styles.reportActionRow}>
                  <AdminButton label="저장" onPress={saveUrlEdit} />
                  <AdminButton label="취소" onPress={() => setEditingSerial(null)} />
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.url} numberOfLines={2}>{content.sourceUrl}</Text>
                <View style={styles.reportActionRow}>
                  <AdminButton label="URL 수정" onPress={() => startUrlEdit(content)} />
                  <AdminButton label="이 항목 갱신" onPress={() => syncSingleContent(content)} />
                </View>
              </>
            )}
          </KrdsCard>
        );
      })}

      <SectionHeader
        title="공공 API 목록"
        description="서버에 등록된 외부 API 엔드포인트와 문서 기준 정보를 확인합니다."
      />

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

      <SectionHeader
        title="정보 오류 신고 검수"
        description="사용자가 신고한 병원·약국 정보 변경 사항을 확인하고 처리 상태를 관리합니다."
      />

      {reports.length ? reports.map((report) => (
        <KrdsCard key={report.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{report.facilityName}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{report.status}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{report.facilityExternalId} · {report.reportType}</Text>
          <Text style={styles.body}>{report.description || "상세 설명 없음"}</Text>
          {report.reporterContact ? <Text style={styles.meta}>연락처: {report.reporterContact}</Text> : null}
          <View style={styles.reportActionRow}>
            <AdminButton label="검토중" onPress={() => changeReportStatus(report, "reviewing")} />
            <AdminButton label="반영" onPress={() => changeReportStatus(report, "approved")} />
            <AdminButton label="반려" onPress={() => changeReportStatus(report, "rejected")} />
          </View>
        </KrdsCard>
      )) : (
        <KrdsCard>
          <Text style={styles.body}>접수된 정보 오류 신고가 없습니다.</Text>
        </KrdsCard>
      )}
    </AppScreen>
  );
}

function AdminButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.adminButton} onPress={onPress}>
      <Text style={styles.adminButtonText}>{label}</Text>
    </Pressable>
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
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
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textStrong
  },
  urlEditBox: {
    gap: spacing.sm
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary
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
  },
  reportActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  adminButton: {
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  adminButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  }
});
