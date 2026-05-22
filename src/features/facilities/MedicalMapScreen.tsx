import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { CurrentFamilyBanner } from "@/components/CurrentFamilyBanner";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { familyFacilityScore, familyRecommendation } from "@/family/familyRecommendations";
import { findNearbyFacilities } from "@/services/medicalFacilityService";
import {
  getLocalFavoritePlaces,
  getLocalRecentPlaces,
  saveLocalFavoritePlace,
  saveLocalRecentPlace,
  StoredPlace
} from "@/services/localUserData";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { MedicalFacility } from "@/types/domain";

const filters = ["내 주변", "영업중", "약국", "병원", "응급", "야간", "휴일"];
const radiusOptions = ["1km", "3km", "5km"];
const sortOptions = ["거리순", "영업중 우선", "마감 임박 제외", "주말 운영 우선", "전화번호 우선"];
type ViewMode = "map" | "list";

export function MedicalMapScreen() {
  const { selectedProfile } = useFamilyProfile();
  const [facilities, setFacilities] = useState<MedicalFacility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<MedicalFacility | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(["내 주변", "영업중"]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(sortOptions[0]);
  const [radius, setRadius] = useState("3km");
  const [locationRequested, setLocationRequested] = useState(false);
  const [favoritePlaces, setFavoritePlaces] = useState<StoredPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<StoredPlace[]>([]);
  const recommendation = useMemo(() => familyRecommendation(selectedProfile), [selectedProfile]);

  useEffect(() => {
    findNearbyFacilities().then((items) => {
      setFacilities(items);
      setSelectedFacility(items[0] ?? null);
    });
    getLocalFavoritePlaces().then(setFavoritePlaces);
    getLocalRecentPlaces().then(setRecentPlaces);
  }, [selectedProfile?.profileId]);

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
        const familyScore = familyFacilityScore(b, selectedProfile) - familyFacilityScore(a, selectedProfile);
        if (familyScore !== 0) return familyScore;
        if (sort === "영업중 우선") return Number(b.isOpen) - Number(a.isOpen) || a.distanceKm - b.distanceKm;
        if (sort === "전화번호 우선") return Number(b.hasPhone) - Number(a.hasPhone) || a.distanceKm - b.distanceKm;
        if (sort === "마감 임박 제외") return Number(a.closingSoonMinutes ?? 999) - Number(b.closingSoonMinutes ?? 999);
        return a.distanceKm - b.distanceKm;
      });
  }, [activeFilters, facilities, query, selectedProfile, sort]);

  const topOpenFacilities = visibleFacilities.filter((facility) => facility.operatingStatus === "open_expected").slice(0, 3);

  const toggleFilter = (filter: string) => {
    setActiveFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
    );
  };

  const selectFacility = async (facility: MedicalFacility) => {
    setSelectedFacility(facility);
    setRecentPlaces(await saveLocalRecentPlace(facility, selectedProfile));
  };

  const addFavorite = async (facility: MedicalFacility) => {
    setFavoritePlaces(
      await saveLocalFavoritePlace({
        placeId: facility.id,
        placeName: facility.name,
        placeType: facility.type,
        profileId: selectedProfile?.profileId,
        profileName: selectedProfile?.profileName,
        address: facility.address,
        phone: facility.phone
      })
    );
  };

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>지도</Text>
        <Text style={styles.title}>지금 갈 수 있는 곳</Text>
        <Text style={styles.description}>병원과 약국 운영시간은 예상값이며 방문 전 전화 확인을 권장합니다.</Text>
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={30} color={colors.primary} />
        <TextInput
          accessibilityLabel="약국병원 상황 검색"
          placeholder={recommendation.queryHints.join(", ")}
          placeholderTextColor="#6B7280"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {!locationRequested ? (
        <View style={styles.locationCard}>
          <View style={styles.locationIconBox}>
            <MaterialCommunityIcons name="map-marker-outline" size={36} color={colors.primary} />
          </View>
          <View style={styles.locationContent}>
            <Text style={styles.locationTitle}>내 주변 병원과 약국을 찾기 위해 현재 위치가 필요합니다.</Text>
            <Text style={styles.locationDescription}>위치는 검색에만 사용되며 저장하지 않습니다.</Text>
            <View style={styles.locationActions}>
              <MapButton label="현재 위치로 찾기" icon="crosshairs-gps" variant="filled" onPress={() => setLocationRequested(true)} />
              <MapButton label="주소로 검색하기" icon="home-search-outline" variant="outline" />
              <MapButton label="동/읍/면으로 검색하기" icon="map-search-outline" variant="outline" />
              <MapButton label="지도에서 직접 선택하기" icon="map-marker-radius-outline" variant="outline" />
            </View>
          </View>
        </View>
      ) : null}

      <CurrentFamilyBanner compact />

      <View style={styles.primaryActionRow}>
        <Pressable style={styles.bigPrimaryButton} onPress={() => setLocationRequested(true)}>
          <MaterialCommunityIcons name="crosshairs-gps" size={28} color="#FFFFFF" />
          <Text style={styles.bigPrimaryText}>현재 위치로 찾기</Text>
        </Pressable>
        <Text style={styles.radiusLabel}>반경 {radius}</Text>
      </View>

      <View style={styles.savedRow}>
        <QuickSaveButton label="집 저장" icon="home-outline" />
        <QuickSaveButton label="회사 저장" icon="briefcase-outline" />
      </View>

      <View style={styles.radiusRow}>
        {radiusOptions.map((option) => (
          <Pressable key={option} onPress={() => setRadius(option)} style={[styles.radiusChip, radius === option && styles.radiusChipActive]}>
            <Text style={[styles.radiusChipText, radius === option && styles.radiusChipTextActive]}>{option}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.filterRow}>
        {filters.map((filter) => {
          const active = activeFilters.includes(filter);
          return (
            <Pressable key={filter} onPress={() => toggleFilter(filter)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.recommendCard}>
        <Text style={styles.recommendTitle}>{recommendation.title}</Text>
        <Text style={styles.body}>{recommendation.description}</Text>
        <View style={styles.recommendChipRow}>
          {recommendation.chips.map((chip) => (
            <Pressable key={chip} style={styles.recommendChip} onPress={() => setQuery(chip.replace("문 연 ", "").replace("가까운 ", ""))}>
              <Text style={styles.recommendChipText}>{chip}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.segmentShell}>
        <Pressable style={[styles.segment, viewMode === "map" && styles.segmentActive]} onPress={() => setViewMode("map")}>
          <Text style={[styles.segmentText, viewMode === "map" && styles.segmentTextActive]}>지도 보기</Text>
        </Pressable>
        <Pressable style={[styles.segment, viewMode === "list" && styles.segmentActive]} onPress={() => setViewMode("list")}>
          <Text style={[styles.segmentText, viewMode === "list" && styles.segmentTextActive]}>목록 보기</Text>
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
              onPress={() => selectFacility(facility)}
            >
              <MaterialCommunityIcons name={facility.type === "pharmacy" ? "pill" : "hospital-building"} size={16} color="#FFFFFF" />
            </Pressable>
          ))}
          <Text style={styles.previewText}>마커를 누르면 상세 패널이 열립니다.</Text>
        </View>
      ) : (
        <View style={styles.sortRow}>
          {sortOptions.map((option) => (
            <Pressable key={option} style={[styles.sortChip, sort === option && styles.sortChipActive]} onPress={() => setSort(option)}>
              <Text style={[styles.sortLabel, sort === option && styles.sortLabelActive]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {visibleFacilities.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.cardTitle}>현재 위치 주변 1km 안에는 조건에 맞는 장소가 없습니다.</Text>
          <Text style={styles.body}>검색 범위를 3km로 넓히거나 전체 약국과 병원을 확인해 보세요.</Text>
          <View style={styles.actionRow}>
            <MapButton label="3km로 확대" icon="map-marker-distance" variant="filled" onPress={() => setRadius("3km")} />
            <MapButton label="전체 보기" icon="filter-remove-outline" variant="outline" />
          </View>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>가까운 영업중 장소</Text>
        <Text style={styles.sectionDescription}>지도 조작 없이 바로 판단할 수 있는 3곳입니다.</Text>
      </View>

      {(viewMode === "map" ? topOpenFacilities : visibleFacilities).map((facility) => (
        <FacilityCard key={facility.id} facility={facility} onSelect={() => selectFacility(facility)} />
      ))}

      <View style={styles.savedPlacesCard}>
        <Text style={styles.sectionTitle}>즐겨찾기와 최근 본 장소</Text>
        <Text style={styles.meta}>즐겨찾기</Text>
        <Text style={styles.body}>{favoritePlaces.length ? favoritePlaces.map((item) => item.placeName).join(" · ") : "아직 저장한 장소가 없습니다."}</Text>
        <Text style={styles.meta}>{selectedProfile?.profileName ?? "나"} 기준 최근 본 장소</Text>
        <Text style={styles.body}>{recentPlaces.length ? recentPlaces.filter((item) => !item.profileId || String(item.profileId) === String(selectedProfile?.profileId)).map((item) => item.placeName).join(" · ") || "현재 가족 기준 최근 본 장소가 없습니다." : "최근 본 장소가 없습니다."}</Text>
      </View>

      {selectedFacility ? <FacilityBottomSheet facility={selectedFacility} onFavorite={() => addFavorite(selectedFacility)} /> : null}
    </AppScreen>
  );
}

function MapButton({ label, icon, variant, onPress }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; variant: "filled" | "outline"; onPress?: () => void }) {
  const filled = variant === "filled";
  return (
    <Pressable onPress={onPress} style={[styles.mapButton, filled ? styles.mapButtonFilled : styles.mapButtonOutline]}>
      <MaterialCommunityIcons name={icon} size={20} color={filled ? "#FFFFFF" : colors.primary} />
      <Text style={[styles.mapButtonText, filled ? styles.mapButtonTextFilled : styles.mapButtonTextOutline]}>{label}</Text>
    </Pressable>
  );
}

function QuickSaveButton({ label, icon }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <Pressable style={styles.quickSaveButton}>
      <MaterialCommunityIcons name={icon} size={26} color={colors.primary} />
      <Text style={styles.quickSaveText}>{label}</Text>
    </Pressable>
  );
}

function FacilityCard({ facility, onSelect }: { facility: MedicalFacility; onSelect: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onSelect} style={styles.facilityCard}>
      <View style={styles.rowBetween}>
        <View style={styles.facilityTitleArea}>
          <Text style={styles.cardTitle}>{facility.name}</Text>
          <Text style={styles.meta}>{facility.distanceKm}km · {facilityStatusText(facility)}</Text>
        </View>
        <StatusBadge facility={facility} />
      </View>
      <Text style={styles.body}>{facility.address}</Text>
      <Text style={styles.body}>{facility.hasPhone ? "전화 가능" : "전화번호 확인 필요"} · 길찾기</Text>
    </Pressable>
  );
}

function FacilityBottomSheet({ facility, onFavorite }: { facility: MedicalFacility; onFavorite: () => void }) {
  return (
    <View style={styles.bottomSheet}>
      <View style={styles.sheetHandle} />
      <View style={styles.rowBetween}>
        <Text style={styles.sheetTitle}>{facility.name}</Text>
        <MaterialCommunityIcons name="star-outline" size={28} color={colors.primary} />
      </View>
      <Text style={styles.meta}>{facilityStatusText(facility)} · {Math.round(facility.distanceKm * 1000)}m</Text>
      <Text style={styles.body}>{facility.address}</Text>
      <Text style={styles.body}>전화번호 {facility.phone || "정보 없음"}</Text>
      <Text style={styles.notice}>운영시간은 변동될 수 있으니 방문 전 전화 확인을 권장합니다.</Text>
      <View style={styles.actionRow}>
        <MapButton label="전화" icon="phone" variant="filled" />
        <MapButton label="길찾기" icon="navigation-variant" variant="outline" />
        <MapButton label="공유" icon="share-variant" variant="outline" />
        <MapButton label="즐겨찾기" icon="star-outline" variant="outline" onPress={onFavorite} />
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
      <Text style={styles.statusText}>{isClosingSoon ? "마감 임박" : statusLabel(facility.operatingStatus)}</Text>
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
  screen: {
    backgroundColor: "#FFFFFF",
    gap: spacing.lg
  },
  hero: {
    paddingTop: spacing.sm,
    gap: spacing.xs
  },
  eyebrow: {
    ...typography.title,
    color: colors.primary,
    fontWeight: "800"
  },
  title: {
    ...typography.display,
    color: colors.textStrong
  },
  description: {
    ...typography.bodyLarge,
    color: colors.text,
    lineHeight: 30
  },
  searchBox: {
    minHeight: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  searchInput: {
    ...typography.bodyLarge,
    flex: 1,
    minHeight: 66,
    color: colors.textStrong
  },
  locationCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  locationIconBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  locationContent: {
    flex: 1,
    gap: spacing.md
  },
  locationTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong,
    lineHeight: 28
  },
  locationDescription: {
    ...typography.bodyLarge,
    color: colors.text,
    lineHeight: 28
  },
  locationActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  primaryActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  bigPrimaryButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  bigPrimaryText: {
    ...typography.title,
    color: "#FFFFFF"
  },
  radiusLabel: {
    ...typography.sectionTitle,
    color: colors.text
  },
  savedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  quickSaveButton: {
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  quickSaveText: {
    ...typography.button,
    color: colors.primary
  },
  radiusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  radiusChip: {
    minHeight: 58,
    minWidth: 86,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  radiusChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  radiusChipText: {
    ...typography.title,
    color: colors.text
  },
  radiusChipTextActive: {
    color: colors.primary
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filterChip: {
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    ...typography.button,
    color: colors.text
  },
  filterTextActive: {
    color: "#FFFFFF"
  },
  recommendCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  recommendTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  recommendChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  recommendChip: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  recommendChipText: {
    ...typography.caption,
    color: colors.primary
  },
  segmentShell: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    overflow: "hidden"
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentActive: {
    backgroundColor: colors.primary
  },
  segmentText: {
    ...typography.button,
    color: colors.primary
  },
  segmentTextActive: {
    color: "#FFFFFF"
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
    borderColor: "#FFFFFF"
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
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  sortChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  sortLabel: {
    ...typography.caption,
    color: colors.text
  },
  sortLabelActive: {
    color: colors.primaryStrong
  },
  emptyCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  sectionHeader: {
    gap: spacing.xs
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textStrong
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text
  },
  facilityCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  facilityTitleArea: {
    flex: 1,
    gap: spacing.xs
  },
  cardTitle: {
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
    color: "#FFFFFF"
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
    backgroundColor: "#FFFFFF"
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  mapButton: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  mapButtonFilled: {
    backgroundColor: colors.primary
  },
  mapButtonOutline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C7D6EA"
  },
  mapButtonText: {
    ...typography.button
  },
  mapButtonTextFilled: {
    color: "#FFFFFF"
  },
  mapButtonTextOutline: {
    color: colors.primary
  },
  navigationApps: {
    gap: spacing.xs
  },
  linkText: {
    ...typography.caption,
    color: colors.primary
  },
  savedPlacesCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  }
});
