import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { ActionButton } from "@/components/ActionButton";
import { KrdsCard } from "@/components/KrdsCard";
import { SectionHeader } from "@/components/SectionHeader";
import { recognizePillFromImage } from "@/services/pillRecognitionService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { Pill } from "@/types/domain";

export function PillIdentificationScreen() {
  const [pills, setPills] = useState<Pill[]>([]);

  useEffect(() => {
    recognizePillFromImage().then(setPills);
  }, []);

  return (
    <AppScreen>
      <SectionHeader title="AI 알약 식별" description="사진 촬영, 이미지 선택, OCR 처방전 등록을 한 흐름에서 시작합니다." />
      <KrdsCard>
        <View style={styles.cameraGuide}>
          <Image source={require("../../../app_img/allcaremedi_ai.png")} style={styles.guideImage} resizeMode="contain" />
          <View style={styles.guideText}>
            <Text style={styles.cardTitle}>헬시 카메라 가이드</Text>
            <Text style={styles.body}>알약 앞면과 뒷면을 밝은 배경에서 촬영하면 식별 정확도가 높아집니다.</Text>
          </View>
        </View>
        <View style={styles.buttonRow}>
          <ActionButton label="촬영" icon="camera" />
          <ActionButton label="사진 선택" icon="image-outline" tone="secondary" />
        </View>
      </KrdsCard>

      {pills.map((pill) => (
        <KrdsCard key={pill.id}>
          <Text style={styles.cardTitle}>{pill.productName}</Text>
          <Text style={styles.meta}>{pill.manufacturer} · {pill.ingredient}</Text>
          <Text style={styles.body}>{pill.shape} · {pill.color} · 식별문자 {pill.imprint}</Text>
          <Text style={styles.confidence}>AI 신뢰도 {Math.round(pill.confidence * 100)}%</Text>
          {pill.warnings.map((warning) => (
            <Text key={warning} style={styles.warning}>주의: {warning}</Text>
          ))}
          <ActionButton label="복약 일정에 등록" icon="calendar-plus" />
        </KrdsCard>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cameraGuide: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center"
  },
  guideImage: {
    width: 96,
    height: 96
  },
  guideText: {
    flex: 1,
    gap: spacing.xs
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  meta: {
    ...typography.body,
    color: colors.primaryStrong
  },
  body: {
    ...typography.body,
    color: colors.text
  },
  confidence: {
    ...typography.caption,
    color: colors.success
  },
  warning: {
    ...typography.body,
    color: colors.warning
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
