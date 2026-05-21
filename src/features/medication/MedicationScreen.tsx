import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { ActionButton } from "@/components/ActionButton";
import { KrdsCard } from "@/components/KrdsCard";
import { SectionHeader } from "@/components/SectionHeader";
import { getRecommendedHealthContents } from "@/services/healthContentService";
import { getMedicationSchedules } from "@/services/medicationService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { HealthContent, MedicationSchedule } from "@/types/domain";

export function MedicationScreen() {
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [contents, setContents] = useState<HealthContent[]>([]);

  useEffect(() => {
    getMedicationSchedules().then(setSchedules);
    getRecommendedHealthContents().then(setContents);
  }, []);

  return (
    <AppScreen>
      <SectionHeader title="스마트 복약 관리" description="등록, 알림, 가족 공유, 복약 리포트를 한 화면에서 관리합니다." />
      <KrdsCard>
        <View style={styles.topArea}>
          <Image source={require("../../../app_img/allcaremedi_dr.png")} style={styles.image} resizeMode="contain" />
          <View style={styles.topText}>
            <Text style={styles.cardTitle}>오늘의 복약</Text>
            <Text style={styles.body}>중요 약 미복용 시 보호자에게 알림을 보낼 수 있습니다.</Text>
          </View>
        </View>
        <View style={styles.buttonRow}>
          <ActionButton label="약 검색 등록" icon="pill" />
          <ActionButton label="처방전 OCR" icon="text-recognition" tone="secondary" />
        </View>
      </KrdsCard>

      {schedules.map((schedule) => (
        <KrdsCard key={schedule.id}>
          <Text style={styles.time}>{schedule.time}</Text>
          <Text style={styles.cardTitle}>{schedule.pillName}</Text>
          <Text style={styles.body}>{schedule.instruction}</Text>
          <Text style={styles.meta}>복약 완료율 {schedule.adherenceRate}% · {schedule.familyShared ? "가족 공유중" : "개인 관리"}</Text>
          <View style={styles.buttonRow}>
            <ActionButton label="복약 완료" icon="check-circle" />
            <ActionButton label="건너뜀" icon="clock-alert-outline" tone="secondary" />
          </View>
        </KrdsCard>
      ))}

      <SectionHeader title="맞춤 건강백과" description="복약 상태와 관심 정보를 바탕으로 추천합니다." />
      {contents.map((content) => (
        <KrdsCard key={content.id}>
          <Text style={styles.cardTitle}>{content.title}</Text>
          <Text style={styles.meta}>{content.category} · {content.lifeStage}</Text>
          <Text style={styles.body}>{content.summary}</Text>
        </KrdsCard>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  image: {
    width: 92,
    height: 92
  },
  topText: {
    flex: 1,
    gap: spacing.xs
  },
  cardTitle: {
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
  time: {
    ...typography.title,
    color: colors.primary
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
