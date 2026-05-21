import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { ActionButton } from "@/components/ActionButton";
import { KrdsCard } from "@/components/KrdsCard";
import { SectionHeader } from "@/components/SectionHeader";
import { getNearbyEmergencyRooms } from "@/services/emergencyService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { EmergencyRoom } from "@/types/domain";

export function EmergencyScreen() {
  const [emergencyRooms, setEmergencyRooms] = useState<EmergencyRoom[]>([]);

  useEffect(() => {
    getNearbyEmergencyRooms().then(setEmergencyRooms);
  }, []);

  return (
    <AppScreen>
      <SectionHeader title="실시간 응급실 안내" description="응급 위험이 높으면 119 연결과 가까운 응급실을 우선 안내합니다." />
      <KrdsCard>
        <View style={styles.alertArea}>
          <Image source={require("../../../app_img/allcaremedi_sh.png")} style={styles.image} resizeMode="contain" />
          <View style={styles.alertText}>
            <Text style={styles.cardTitle}>응급 증상인가요?</Text>
            <Text style={styles.body}>가슴 통증, 호흡곤란, 의식저하 등은 즉시 119를 이용하세요.</Text>
          </View>
        </View>
        <ActionButton label="119 즉시 연결" icon="phone-alert" tone="danger" />
      </KrdsCard>

      {emergencyRooms.map((room) => (
        <KrdsCard key={room.id}>
          <Text style={styles.cardTitle}>{room.name}</Text>
          <Text style={styles.meta}>{room.distanceKm}km · 가용 병상 {room.availableBeds}개</Text>
          <Text style={styles.body}>
            소아응급 {room.pediatricEmergency ? "가능" : "확인필요"} · 분만실 {room.deliveryRoom ? "가능" : "확인필요"} · 음압격리 {room.isolationRoom ? "가능" : "확인필요"}
          </Text>
          <View style={styles.buttonRow}>
            <ActionButton label="전화" icon="phone" />
            <ActionButton label="보호자 공유" icon="share-variant" tone="secondary" />
          </View>
        </KrdsCard>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  alertArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  image: {
    width: 92,
    height: 92
  },
  alertText: {
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
    ...typography.body,
    color: colors.primaryStrong
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
