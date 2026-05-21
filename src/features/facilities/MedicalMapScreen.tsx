import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { ActionButton } from "@/components/ActionButton";
import { KrdsCard } from "@/components/KrdsCard";
import { SectionHeader } from "@/components/SectionHeader";
import { findNearbyFacilities } from "@/services/medicalFacilityService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { MedicalFacility } from "@/types/domain";

export function MedicalMapScreen() {
  const [facilities, setFacilities] = useState<MedicalFacility[]>([]);

  useEffect(() => {
    findNearbyFacilities().then(setFacilities);
  }, []);

  return (
    <AppScreen>
      <SectionHeader title="병·의원 및 약국 찾기" description="위치 기반으로 운영중인 기관과 맞춤 추천을 확인합니다." />
      <View style={styles.mapPreview}>
        <Image source={require("../../../app_img/allcaremedi_hp.png")} style={styles.previewImage} resizeMode="contain" />
        <Text style={styles.previewText}>지도 영역</Text>
      </View>
      {facilities.map((facility) => (
        <KrdsCard key={facility.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{facility.name}</Text>
            <Text style={[styles.status, facility.isOpen ? styles.open : styles.closed]}>
              {facility.isOpen ? "운영중" : "운영종료"}
            </Text>
          </View>
          <Text style={styles.meta}>{facility.department ?? "약국"} · {facility.distanceKm}km · {facility.hours}</Text>
          <Text style={styles.body}>{facility.address}</Text>
          <Text style={styles.tags}>{facility.tags.join(" · ")}</Text>
          <View style={styles.buttonRow}>
            <ActionButton label="전화" icon="phone" />
            <ActionButton label="길찾기" icon="navigation-variant" tone="secondary" />
          </View>
        </KrdsCard>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  mapPreview: {
    minHeight: 180,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  previewImage: {
    width: 160,
    height: 120
  },
  previewText: {
    ...typography.caption,
    color: colors.primaryStrong
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
  status: {
    ...typography.caption
  },
  open: {
    color: colors.success
  },
  closed: {
    color: colors.textMuted
  },
  meta: {
    ...typography.body,
    color: colors.primaryStrong
  },
  body: {
    ...typography.body,
    color: colors.text
  },
  tags: {
    ...typography.caption,
    color: colors.textMuted
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
