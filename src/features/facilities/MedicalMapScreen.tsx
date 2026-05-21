import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { ActionButton } from "@/components/ActionButton";
import { KrdsCard } from "@/components/KrdsCard";
import { SectionHeader } from "@/components/SectionHeader";
import { findNearbyFacilities } from "@/services/medicalFacilityService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { MedicalFacility } from "@/types/domain";

const filters = ["내 주변", "영업중", "약국", "병원", "응급", "야간", "휴일"];
const sortOptions = ["거리순", "영업중 우선", "마감 임박 제외", "주말 운영 우선", "전화번호 우선"];
const recentPlaces = ["아이 소아과", "야간에 열었던 약국", "우리집 근처 약국"];
const favoritePlaces = ["우리집 근처 약국", "아이 소아과"];

type ViewMode = "map" | "list";

export function MedicalMapScreen() {
  const [facilities, setFacilities] = useState<MedicalFacility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<MedicalFacility | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(["내 주변", "영업중"]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(sortOptions[0]);
  const [locationRequested, setLocationRequested] = useState(false);

  useEffect(() => {
    findNearbyFacilities().then((items) => {
      setFacilities(items);
      setSelectedFacility(items[0] ?? null);
    });
  }, []);

  const visibleFacilities = useMemo(() => {
    const normalizedQuery = query.trim();
    return facilities
      .filter((facility) => {
        if (activeFilters.includes("영업중") && facility.operatingStatus !== "open_expected") return false;
        if (activeFilters.includes("약국") && facility.type !== "pharmacy") return false;
        if (activeFilters.includes("병원") && !["clinic", "hospital", "screening"].includes(facility.type)) return false;
        if (activeFilters.includes("응급") && facility.type !== "emergency") return false;
        if (activeFilters.includes("야간") && !facility.nightCare) return false;
        if (activeFilters.includes("휴일") && !facility.holidayCare) return false;
        if (!normalizedQuery) return true;
        return [facility.name, facility.department, facility.address, facility.tags.join(" ")]
          .filter(Boolean)
          .join(" ")
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sort === "영업중 우선") return Number(b.isOpen) - Number(a.isOpen) || a.distanceKm - b.distanceKm;
        if (sort === "전화번호 우선") return Number(b.hasPhone) - Number(a.hasPhone) || a.distanceKm - b.distanceKm;
        if (sort === "마감 임박 제외") return Number(a.closingSoonMinutes ?? 999) - Number(b.closingSoonMinutes ?? 999);
        return a.distanceKm - b.distanceKm;
      });
  }, [activeFilters, facilities, query, sort]);

  const topOpenFacilities = visibleFacilities.filter((facility) => facility.operatingStatus === "open_expected").slice(0, 3);

  const toggleFilter = (filter: string) => {
    setActiveFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
    );
  };

  return (
    <AppScreen>
      <SectionHeader
        title="약국병원"
        description="지금 갈 수 있는 곳을 먼저 보여주고, 방문 전 전화 확인을 돕습니다."
      />

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={24} color={colors.primary} />
        <TextInput
          accessibilityLabel="약국병원 상황 검색"
          placeholder="야간 약국, 일요일 병원, 소아과, 응급실"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.chipRow}>
        {filters.map((filter) => {
          const active = activeFilters.includes(filter);
          return (
            <Pressable
              key={filter}
              accessibilityRole="button"
              style={[styles.chip, active && styles.activeChip]}
              onPress={() => toggleFilter(filter)}
            >
              <Text style={[styles.chipLabel, active && styles.activeChipLabel]}>{filter}</Text>
            </Pressable>
          );
        })}
      </View>

      {!locationRequested ? (
        <KrdsCard>
          <Text style={styles.cardTitle}>내 주변 병원과 약국을 찾기 위해 현재 위치가 필요합니다.</Text>
          <Text style={styles.body}>위치는 검색에만 사용되며 저장하지 않습니다.</Text>
          <ActionButton label="현재 위치로 찾기" icon="crosshairs-gps" onPress={() => setLocationRequested(true)} />
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>주소로 검색하기</Text>
            <Text style={styles.linkText}>동/읍/면 검색</Text>
            <Text style={styles.linkText}>지도에서 선택</Text>
          </View>
        </KrdsCard>
      ) : null}

      <View style={styles.segmented}>
        <Pressable style={[styles.segment, viewMode === "map" && styles.activeSegment]} onPress={() => setViewMode("map")}>
          <MaterialCommunityIcons name="map" size={18} color={viewMode === "map" ? colors.onPrimary : colors.primary} />
          <Text style={[styles.segmentText, viewMode === "map" && styles.activeSegmentText]}>지도 보기</Text>
        </Pressable>
        <Pressable style={[styles.segment, viewMode === "list" && styles.activeSegment]} onPress={() => setViewMode("list")}>
          <MaterialCommunityIcons name="format-list-bulleted" size={18} color={viewMode === "list" ? colors.onPrimary : colors.primary} />
          <Text style={[styles.segmentText, viewMode === "list" && styles.activeSegmentText]}>목록 보기</Text>
        </Pressable>
      </View>

      {viewMode === "map" ? (
        <View style={styles.mapPreview}>
          <Image source={require("../../../app_img/allcaremedi_hp.png")} style={styles.previewImage} resizeMode="contain" />
          {visibleFacilities.slice(0, 4).map((facility, index) => (
            <Pressable
              key={facility.id}
              accessibilityRole="button"
              style={[styles.marker, markerPositions[index], facility.type === "pharmacy" ? styles.pharmacyMarker : styles.hospitalMarker]}
              onPress={() => setSelectedFacility(facility)}
            >
              <MaterialCommunityIcons name={facility.type === "pharmacy" ? "pill" : "hospital-building"} size={16} color={colors.onPrimary} />
            </Pressable>
          ))}
          <Text style={styles.previewText}>마커를 누르면 상세 패널이 열립니다.</Text>
        </View>
      ) : (
        <View style={styles.sortRow}>
          {sortOptions.map((option) => (
            <Pressable key={option} style={[styles.sortChip, sort === option && styles.activeSortChip]} onPress={() => setSort(option)}>
              <Text style={[styles.sortLabel, sort === option && styles.activeSortLabel]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {visibleFacilities.length === 0 ? (
        <KrdsCard>
          <Text style={styles.cardTitle}>현재 위치 주변 1km 안에는 조건에 맞는 장소가 없습니다.</Text>
          <Text style={styles.body}>검색 범위를 3km로 넓히거나 전체 약국과 병원을 확인해 보세요.</Text>
          <View style={styles.buttonRow}>
            <ActionButton label="3km로 확대" icon="map-marker-distance" />
            <ActionButton label="전체 보기" icon="filter-remove-outline" tone="secondary" />
          </View>
        </KrdsCard>
      ) : null}

      <SectionHeader title="가까운 영업중 장소" description="지도 조작 없이 바로 판단할 수 있는 3곳입니다." />
      {(viewMode === "map" ? topOpenFacilities : visibleFacilities).map((facility) => (
        <FacilityCard key={facility.id} facility={facility} onSelect={() => setSelectedFacility(facility)} />
      ))}

      <SectionHeader title="즐겨찾기와 최근 본 장소" />
      <KrdsCard>
        <Text style={styles.meta}>즐겨찾기</Text>
        <Text style={styles.body}>{favoritePlaces.join(" · ")}</Text>
        <Text style={styles.meta}>최근 본 장소</Text>
        <Text style={styles.body}>{recentPlaces.join(" · ")}</Text>
      </KrdsCard>

      {selectedFacility ? <FacilityBottomSheet facility={selectedFacility} /> : null}
    </AppScreen>
  );
}

function FacilityCard({ facility, onSelect }: { facility: MedicalFacility; onSelect: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onSelect}>
      <KrdsCard>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>{facility.name}</Text>
          <StatusBadge facility={facility} />
        </View>
        <Text style={styles.meta}>{facility.distanceKm}km · {facilityStatusText(facility)}</Text>
        <Text style={styles.body}>{facility.hasPhone ? "전화 가능" : "전화번호 확인 필요"} · 길찾기</Text>
      </KrdsCard>
    </Pressable>
  );
}

function FacilityBottomSheet({ facility }: { facility: MedicalFacility }) {
  return (
    <View style={styles.bottomSheet}>
      <View style={styles.sheetHandle} />
      <View style={styles.rowBetween}>
        <Text style={styles.sheetTitle}>{facility.name}</Text>
        <MaterialCommunityIcons name="star-outline" size={28} color={colors.primary} />
      </View>
      <Text style={styles.meta}>{facilityStatusText(facility)} · {facility.distanceKm * 1000}m</Text>
      <Text style={styles.body}>{facility.address}</Text>
      <Text style={styles.body}>전화번호 {facility.phone || "정보 없음"}</Text>
      <Text style={styles.notice}>운영시간은 변동될 수 있으니 방문 전 전화 확인을 권장합니다.</Text>
      <View style={styles.buttonRow}>
        <ActionButton label="전화" icon="phone" />
        <ActionButton label="길찾기" icon="navigation-variant" tone="secondary" />
        <ActionButton label="공유" icon="share-variant" tone="secondary" />
        <ActionButton label="즐겨찾기" icon="star-outline" tone="secondary" />
      </View>
      <View style={styles.navigationApps}>
        <Text style={styles.meta}>길찾기 앱 선택</Text>
        <Text style={styles.body}>네이버지도 · 카카오맵 · 카카오내비 · Google Maps</Text>
        <Text style={styles.linkText}>정보가 달라요</Text>
      </View>
    </View>
  );
}

function StatusBadge({ facility }: { facility: MedicalFacility }) {
  const isClosingSoon = facility.closingSoonMinutes !== undefined && facility.closingSoonMinutes <= 60;
  const badgeStyle = isClosingSoon
    ? styles.closingSoon
    : facility.operatingStatus === "open_expected"
      ? styles.open
      : facility.operatingStatus === "closed_expected"
        ? styles.closed
        : styles.unknown;

  return (
    <View style={[styles.statusBadge, badgeStyle]}>
      <Text style={styles.statusText}>
        {isClosingSoon ? "마감 임박" : statusLabel(facility.operatingStatus)}
      </Text>
    </View>
  );
}

function statusLabel(status: MedicalFacility["operatingStatus"]) {
  if (status === "open_expected") return "영업중 예상";
  if (status === "closed_expected") return "영업종료 예상";
  return "운영시간 정보 없음";
}

function facilityStatusText(facility: MedicalFacility) {
  if (facility.closingSoonMinutes !== undefined && facility.closingSoonMinutes <= 30) {
    return `30분 내 마감 · ${facility.closesAt} 종료`;
  }
  if (facility.closingSoonMinutes !== undefined && facility.closingSoonMinutes <= 60) {
    return `1시간 내 마감 · ${facility.closesAt} 종료`;
  }
  if (facility.operatingStatus === "open_expected" && facility.closesAt) {
    return `영업중 예상 · 오늘 ${facility.closesAt} 종료`;
  }
  return `${statusLabel(facility.operatingStatus)} · ${facility.hours}`;
}

const markerPositions: ViewStyle[] = [
  { top: 34, left: "28%" },
  { top: 74, right: "26%" },
  { bottom: 64, left: "42%" },
  { bottom: 38, right: "18%" }
];

const styles = StyleSheet.create({
  searchBox: {
    minHeight: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  searchInput: {
    flex: 1,
    ...typography.bodyLarge,
    color: colors.textStrong
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  chip: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  activeChip: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  chipLabel: {
    ...typography.caption,
    color: colors.text
  },
  activeChipLabel: {
    color: colors.primaryStrong
  },
  segmented: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    overflow: "hidden"
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  activeSegment: {
    backgroundColor: colors.primary
  },
  segmentText: {
    ...typography.button,
    color: colors.primary
  },
  activeSegmentText: {
    color: colors.onPrimary
  },
  mapPreview: {
    minHeight: 240,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  previewImage: {
    width: 170,
    height: 128,
    opacity: 0.9
  },
  previewText: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  marker: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surface
  },
  pharmacyMarker: {
    backgroundColor: colors.success
  },
  hospitalMarker: {
    backgroundColor: colors.primary
  },
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  sortChip: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  activeSortChip: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  sortLabel: {
    ...typography.caption,
    color: colors.text
  },
  activeSortLabel: {
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
  sheetTitle: {
    flex: 1,
    ...typography.title,
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
  notice: {
    ...typography.body,
    color: colors.warning
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  statusText: {
    ...typography.caption,
    color: colors.onPrimary
  },
  open: {
    backgroundColor: colors.success
  },
  closed: {
    backgroundColor: colors.textMuted
  },
  closingSoon: {
    backgroundColor: colors.warning
  },
  unknown: {
    backgroundColor: colors.primaryStrong
  },
  bottomSheet: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  linkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  linkText: {
    ...typography.caption,
    color: colors.primary
  },
  navigationApps: {
    gap: spacing.xs
  }
});
