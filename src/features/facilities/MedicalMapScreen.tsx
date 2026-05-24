import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/components/AppScreen";
import { CurrentFamilyBanner } from "@/components/CurrentFamilyBanner";
import { MenuHelpButton } from "@/components/MenuHelpButton";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { familyFacilityScore, familyRecommendation } from "@/family/familyRecommendations";
import { menuHelp } from "@/help/menuHelp";
import { findNearbyFacilities } from "@/services/medicalFacilityService";
import {
  DirectionsApp,
  getDefaultDirectionsApp,
  getLocalFavoritePlaces,
  getLocalRecentPlaces,
  getSavedBaseLocations,
  removeLocalFavoritePlace,
  saveBaseLocation,
  SavedBaseLocation,
  saveDefaultDirectionsApp,
  saveLocalFavoritePlace,
  saveLocalRecentPlace,
  StoredPlace
} from "@/services/localUserData";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { MedicalFacility } from "@/types/domain";
import {
  createFacilityReport,
  fetchFavoritePlaces,
  fetchRecentPlaces,
  removeFavoritePlaceFromServer,
  saveFavoritePlaceToServer,
  saveRecentPlaceToServer
} from "@/services/serverApi";

const filters = ["내 주변", "영업중", "약국", "병원", "응급", "야간", "휴일"];
const radiusOptions = ["1km", "3km", "5km"];
const sortOptions = ["거리순", "영업중 우선", "마감 임박 제외", "주말 운영 우선", "전화번호 우선"];
const reportTypes = ["전화번호가 달라요", "운영시간이 달라요", "위치가 달라요", "폐업한 것 같아요"];
const directionApps: { key: DirectionsApp; label: string }[] = [
  { key: "naver", label: "네이버지도" },
  { key: "kakao", label: "카카오맵" },
  { key: "kakaoNavi", label: "카카오내비" },
  { key: "google", label: "Google Maps" }
];
const regions = [
  { label: "서울", value: "서울특별시" },
  { label: "부산", value: "부산광역시" },
  { label: "대구", value: "대구광역시" },
  { label: "인천", value: "인천광역시" },
  { label: "광주", value: "광주광역시" },
  { label: "대전", value: "대전광역시" },
  { label: "울산", value: "울산광역시" },
  { label: "세종", value: "세종특별자치시" },
  { label: "경기", value: "경기도" },
  { label: "강원", value: "강원특별자치도" },
  { label: "충북", value: "충청북도" },
  { label: "충남", value: "충청남도" },
  { label: "전북", value: "전북특별자치도" },
  { label: "전남", value: "전라남도" },
  { label: "경북", value: "경상북도" },
  { label: "경남", value: "경상남도" },
  { label: "제주", value: "제주특별자치도" }
];
type ViewMode = "map" | "list";
const emergencyMapRed = "#D92D20";
const defaultLocation = { latitude: 37.5665, longitude: 126.978 };
const defaultRegion: Region = {
  ...defaultLocation,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035
};

export function MedicalMapScreen() {
  const { session } = useAuth();
  const { selectedProfile } = useFamilyProfile();
  const [facilities, setFacilities] = useState<MedicalFacility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<MedicalFacility | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(["내 주변", "영업중"]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(sortOptions[0]);
  const [radius, setRadius] = useState("3km");
  const [selectedRegion, setSelectedRegion] = useState(regions[0]);
  const [district, setDistrict] = useState("");
  const [locationRequested, setLocationRequested] = useState(false);
  const [userLocation, setUserLocation] = useState(defaultLocation);
  const [mapRegion, setMapRegion] = useState<Region>(defaultRegion);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [favoritePlaces, setFavoritePlaces] = useState<StoredPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<StoredPlace[]>([]);
  const [savedBaseLocations, setSavedBaseLocations] = useState<SavedBaseLocation[]>([]);
  const [mapSelectionMode, setMapSelectionMode] = useState(false);
  const [pickedLocation, setPickedLocation] = useState(defaultLocation);
  const [defaultDirectionsApp, setDefaultDirectionsApp] = useState<DirectionsApp>("google");
  const [reportFacility, setReportFacility] = useState<MedicalFacility | null>(null);
  const [reportType, setReportType] = useState("운영시간이 달라요");
  const [reportDescription, setReportDescription] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const recommendation = useMemo(() => familyRecommendation(selectedProfile), [selectedProfile]);
  const isMember = session?.mode === "member" && Boolean(session.userId);

  useEffect(() => {
    loadFacilities(userLocation);
    loadStoredPlaces();
    getSavedBaseLocations().then(setSavedBaseLocations);
    getDefaultDirectionsApp().then(setDefaultDirectionsApp);
  }, [selectedProfile?.profileId, radius, session?.mode, session?.userId]);

  useEffect(() => {
    const timer = setTimeout(() => loadFacilities(userLocation), 350);
    return () => clearTimeout(timer);
  }, [query, activeFilters.join("|")]);

  const loadStoredPlaces = async () => {
    const [localFavorites, localRecent] = await Promise.all([getLocalFavoritePlaces(), getLocalRecentPlaces()]);
    if (isMember && session?.userId) {
      const [serverFavorites, serverRecent] = await Promise.all([
        fetchFavoritePlaces(session.userId).catch(() => localFavorites),
        fetchRecentPlaces(session.userId).catch(() => localRecent)
      ]);
      setFavoritePlaces(mergePlaces(serverFavorites, localFavorites));
      setRecentPlaces(mergePlaces(serverRecent, localRecent));
      return;
    }
    setFavoritePlaces(localFavorites);
    setRecentPlaces(localRecent);
  };

  const loadFacilities = async (location = userLocation, options?: { forceRegion?: boolean }) => {
    setFacilityLoading(true);
    const activeType = activeFilters.includes("약국")
      ? "pharmacy"
      : activeFilters.includes("병원")
        ? "hospital"
        : activeFilters.includes("응급")
          ? "emergency"
          : undefined;
    try {
      const items = await findNearbyFacilities({
        latitude: location.latitude,
        longitude: location.longitude,
        query: query.trim() || undefined,
        type: activeType,
        stage1: options?.forceRegion || !locationRequested ? selectedRegion.value : undefined,
        stage2: options?.forceRegion || !locationRequested ? district.trim() || undefined : undefined,
        radiusKm: Number(radius.replace("km", ""))
      });
      setFacilities(items);
      setLocationMessage(items.length ? null : "공공 API 조회는 정상이나 조건에 맞는 병원·약국 결과가 없습니다.");
    } catch (error) {
      setFacilities([]);
      setLocationMessage(`병원·약국 공공 API 연결에 문제가 있습니다. 실제 운영 정보를 확인할 수 없어 결과를 표시하지 않습니다. ${error instanceof Error ? error.message : ""}`.trim());
    } finally {
      setSelectedFacility(null);
      setFacilityLoading(false);
    }
  };

  const loadRegionFacilities = async () => {
    setLocationRequested(false);
    setLocationMessage(`${selectedRegion.label}${district.trim() ? ` ${district.trim()}` : ""} 기준으로 표시합니다.`);
    await loadFacilities(defaultLocation, { forceRegion: true });
  };

  const requestCurrentLocation = async () => {
    setLocationMessage(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setLocationRequested(false);
      setLocationMessage("위치 권한이 없어 기본 위치 기준으로 검색합니다. 주소 검색으로도 이용할 수 있습니다.");
      await loadFacilities(defaultLocation);
      return;
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const nextLocation = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude
    };
    setLocationRequested(true);
    setUserLocation(nextLocation);
    setMapRegion({ ...nextLocation, latitudeDelta: 0.035, longitudeDelta: 0.035 });
    await loadFacilities(nextLocation);
  };

  const startMapSelection = () => {
    setViewMode("map");
    setMapSelectionMode(true);
    setPickedLocation({
      latitude: mapRegion.latitude,
      longitude: mapRegion.longitude
    });
    setLocationMessage("지도에서 기준 위치를 누른 뒤 이 위치로 검색을 선택하세요.");
  };

  const applyPickedLocation = async () => {
    const nextLocation = pickedLocation;
    setLocationRequested(true);
    setUserLocation(nextLocation);
    setMapRegion({ ...nextLocation, latitudeDelta: mapRegion.latitudeDelta, longitudeDelta: mapRegion.longitudeDelta });
    setMapSelectionMode(false);
    setLocationMessage("지도에서 선택한 위치 기준으로 검색합니다.");
    await loadFacilities(nextLocation);
  };

  const saveNamedBaseLocation = async (key: SavedBaseLocation["key"]) => {
    const nextLocation = mapSelectionMode ? pickedLocation : { latitude: mapRegion.latitude, longitude: mapRegion.longitude };
    const next = await saveBaseLocation({
      key,
      label: key === "home" ? "집" : "회사",
      latitude: nextLocation.latitude,
      longitude: nextLocation.longitude,
      address: `${nextLocation.latitude.toFixed(5)}, ${nextLocation.longitude.toFixed(5)}`,
      savedAt: new Date().toISOString()
    });
    setSavedBaseLocations(next);
    setLocationMessage(`${key === "home" ? "집" : "회사"} 위치를 저장했습니다.`);
  };

  const useSavedBaseLocation = async (location: SavedBaseLocation) => {
    const nextLocation = { latitude: location.latitude, longitude: location.longitude };
    setLocationRequested(true);
    setUserLocation(nextLocation);
    setMapRegion({ ...nextLocation, latitudeDelta: 0.035, longitudeDelta: 0.035 });
    setLocationMessage(`${location.label} 기준으로 검색합니다.`);
    await loadFacilities(nextLocation);
  };

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
  const focusedFacility = selectedFacility ?? visibleFacilities[0] ?? null;

  const toggleFilter = (filter: string) => {
    setActiveFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
    );
  };

  const selectFacility = async (facility: MedicalFacility) => {
    setSelectedFacility(facility);
    const localRecent = await saveLocalRecentPlace(facility, selectedProfile);
    const storedPlace = placeFromFacility(facility, selectedProfile);
    if (isMember && session?.userId) {
      await saveRecentPlaceToServer(session.userId, { ...storedPlace, viewedAt: new Date().toISOString() }).catch(() => undefined);
      setRecentPlaces(mergePlaces(await fetchRecentPlaces(session.userId).catch(() => []), localRecent));
      return;
    }
    setRecentPlaces(localRecent);
  };

  const addFavorite = async (facility: MedicalFacility) => {
    const storedPlace = placeFromFacility(facility, selectedProfile);
    const localFavorites = await saveLocalFavoritePlace(storedPlace);
    if (isMember && session?.userId) {
      await saveFavoritePlaceToServer(session.userId, storedPlace).catch(() => undefined);
      setFavoritePlaces(mergePlaces(await fetchFavoritePlaces(session.userId).catch(() => []), localFavorites));
      return;
    }
    setFavoritePlaces(localFavorites);
  };

  const removeFavorite = async (facility: MedicalFacility) => {
    const localFavorites = await removeLocalFavoritePlace(facility.id);
    if (isMember && session?.userId) {
      await removeFavoritePlaceFromServer(session.userId, facility.id).catch(() => undefined);
      setFavoritePlaces(mergePlaces(await fetchFavoritePlaces(session.userId).catch(() => []), localFavorites));
      return;
    }
    setFavoritePlaces(localFavorites);
  };

  const openStoredPlace = async (place: StoredPlace) => {
    const facility = storedPlaceToFacility(place);
    setSelectedFacility(facility);
    setRecentPlaces(await saveLocalRecentPlace(facility, selectedProfile));
  };

  const submitFacilityReport = async () => {
    if (!reportFacility) return;
    setReportMessage(null);
    await createFacilityReport({
      facilityExternalId: reportFacility.id,
      facilityName: reportFacility.name,
      reportType,
      description: reportDescription.trim() || undefined,
      reporterContact: reporterContact.trim() || undefined
    });
    setReportMessage("신고가 접수되었습니다. 관리자 검수 후 반영됩니다.");
    setReportDescription("");
    setReporterContact("");
  };

  return (
    <>
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="map-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.heroTitleGroup}>
            <Text style={styles.eyebrow}>병원약국</Text>
            <Text style={styles.title}>지금 갈 수 있는 곳</Text>
          </View>
          <MenuHelpButton content={menuHelp.facilities} />
        </View>
        <Text style={styles.description}>병원과 약국 운영시간은 예상값이며 방문 전 전화 확인을 권장합니다.</Text>
      </View>

      <View style={styles.regionSearchPanel}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.primary} />
          <TextInput
            accessibilityLabel="약국병원 상황 검색"
            placeholder={recommendation.queryHints.join(", ")}
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => loadFacilities(userLocation)}
          />
          <Pressable accessibilityRole="button" style={styles.searchSubmitButton} onPress={() => loadFacilities(userLocation)}>
            <Text style={styles.searchSubmitText}>조회</Text>
          </Pressable>
        </View>

        <View style={styles.regionChipRow}>
          {regions.map((region) => (
            <Pressable
              key={region.value}
              onPress={() => setSelectedRegion(region)}
              style={[styles.regionChip, selectedRegion.value === region.value && styles.regionChipActive]}
            >
              <Text style={[styles.regionChipText, selectedRegion.value === region.value && styles.regionChipTextActive]}>{region.label}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={district}
          onChangeText={setDistrict}
          onSubmitEditing={loadRegionFacilities}
          placeholder="시군구 입력 예: 강남구"
          placeholderTextColor="#6B7280"
          style={styles.districtInput}
        />

        <View style={styles.locationActions}>
          <MapButton label={facilityLoading ? "조회 중" : "조회"} icon="clipboard-search-outline" variant="filled" onPress={loadRegionFacilities} />
          <MapButton label="내 위치 기준" icon="crosshairs-gps" variant="filled" onPress={requestCurrentLocation} />
          <MapButton label="지도직접선택" icon="map-marker-radius-outline" variant="outline" onPress={startMapSelection} />
        </View>
        {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}
      </View>

      <CurrentFamilyBanner compact />

      <View style={styles.savedRow}>
        <QuickSaveButton
          label={savedBaseLocations.some((item) => item.key === "home") ? "집 기준 검색" : "집 저장"}
          icon="home-outline"
          onPress={() => {
            const home = savedBaseLocations.find((item) => item.key === "home");
            home ? useSavedBaseLocation(home) : saveNamedBaseLocation("home");
          }}
          onSave={() => saveNamedBaseLocation("home")}
        />
        <QuickSaveButton
          label={savedBaseLocations.some((item) => item.key === "work") ? "회사 기준 검색" : "회사 저장"}
          icon="briefcase-outline"
          onPress={() => {
            const work = savedBaseLocations.find((item) => item.key === "work");
            work ? useSavedBaseLocation(work) : saveNamedBaseLocation("work");
          }}
          onSave={() => saveNamedBaseLocation("work")}
        />
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
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={mapRegion}
            liteMode={Platform.OS === "android"}
            showsUserLocation={locationRequested}
            showsMyLocationButton={false}
            onRegionChangeComplete={setMapRegion}
            onPress={(event) => {
              if (mapSelectionMode) {
                setPickedLocation(event.nativeEvent.coordinate);
              }
            }}
          >
            {mapSelectionMode ? (
              <Marker coordinate={pickedLocation} title="선택한 기준 위치">
                <View style={[styles.markerBubble, styles.pickMarker]}>
                  <MaterialCommunityIcons name="map-marker-check" size={18} color="#FFFFFF" />
                </View>
              </Marker>
            ) : null}
            {visibleFacilities.filter((facility) => facility.latitude && facility.longitude).map((facility) => (
              <Marker
                key={facility.id}
                coordinate={{ latitude: facility.latitude!, longitude: facility.longitude! }}
                title={facility.name}
                description={facility.address}
                onPress={() => selectFacility(facility)}
              >
                <View style={[
                  styles.markerBubble,
                  facility.type === "pharmacy" ? styles.pharmacyMarker : facility.type === "emergency" ? styles.emergencyMarker : styles.hospitalMarker,
                  facility.id === focusedFacility?.id && styles.markerBubbleActive
                ]}>
                  <MaterialCommunityIcons name={facility.type === "pharmacy" ? "pill" : facility.type === "emergency" ? "hospital-box-outline" : "hospital-building"} size={17} color="#FFFFFF" />
                </View>
              </Marker>
            ))}
          </MapView>
          <View style={styles.mapOverlay}>
            <Text style={styles.mapOverlayTitle}>{mapSelectionMode ? "지도에서 기준 위치 선택" : facilityLoading ? "공공 API 조회 중" : focusedFacility?.name ?? "검색 결과 없음"}</Text>
            <Text style={styles.mapOverlayText}>
              {mapSelectionMode ? `${pickedLocation.latitude.toFixed(5)}, ${pickedLocation.longitude.toFixed(5)}` : focusedFacility ? `${focusedFacility.distanceKm}km · ${facilityStatusText(focusedFacility)}` : "조건을 바꿔 다시 조회해 주세요."}
            </Text>
            {mapSelectionMode ? (
              <View style={styles.actionRow}>
                <MapButton label="이 위치로 검색" icon="check" variant="filled" onPress={applyPickedLocation} />
                <MapButton label="취소" icon="close" variant="outline" onPress={() => setMapSelectionMode(false)} />
              </View>
            ) : null}
          </View>
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
        {favoritePlaces.length ? (
          <View style={styles.placeChipRow}>
            {favoritePlaces.map((item) => (
              <SavedPlaceChip key={item.placeId} place={item} onPress={() => openStoredPlace(item)} />
            ))}
          </View>
        ) : (
          <Text style={styles.body}>아직 저장한 장소가 없습니다.</Text>
        )}
        <Text style={styles.meta}>{selectedProfile?.profileName ?? "나"} 기준 최근 본 장소</Text>
        {recentPlaces.length ? (
          <View style={styles.placeChipRow}>
            {recentPlaces
              .filter((item) => !item.profileId || String(item.profileId) === String(selectedProfile?.profileId))
              .map((item) => (
                <SavedPlaceChip key={item.placeId} place={item} onPress={() => openStoredPlace(item)} />
              ))}
          </View>
        ) : (
          <Text style={styles.body}>최근 본 장소가 없습니다.</Text>
        )}
      </View>

    </AppScreen>
    <FacilityDetailModal
      facility={selectedFacility}
      isFavorite={selectedFacility ? favoritePlaces.some((item) => item.placeId === selectedFacility.id) : false}
      defaultDirectionsApp={defaultDirectionsApp}
      onClose={() => setSelectedFacility(null)}
      onToggleFavorite={() => selectedFacility ? (favoritePlaces.some((item) => item.placeId === selectedFacility.id) ? removeFavorite(selectedFacility) : addFavorite(selectedFacility)) : undefined}
      onChangeDirectionsApp={async (app) => {
        setDefaultDirectionsApp(app);
        await saveDefaultDirectionsApp(app);
      }}
      onOpenReport={() => {
        setReportFacility(selectedFacility);
        setReportMessage(null);
      }}
    />
    <FacilityReportModal
      facility={reportFacility}
      reportType={reportType}
      description={reportDescription}
      reporterContact={reporterContact}
      message={reportMessage}
      onChangeType={setReportType}
      onChangeDescription={setReportDescription}
      onChangeReporterContact={setReporterContact}
      onSubmit={submitFacilityReport}
      onClose={() => setReportFacility(null)}
    />
    </>
  );
}

function MapButton({ label, icon, variant, onPress }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; variant: "filled" | "outline"; onPress?: () => void }) {
  const filled = variant === "filled";
  return (
    <Pressable onPress={onPress} style={[styles.mapButton, filled ? styles.mapButtonFilled : styles.mapButtonOutline]}>
      <MaterialCommunityIcons name={icon} size={18} color={filled ? "#FFFFFF" : colors.primary} />
      <Text style={[styles.mapButtonText, filled ? styles.mapButtonTextFilled : styles.mapButtonTextOutline]}>{label}</Text>
    </Pressable>
  );
}

function QuickSaveButton({
  label,
  icon,
  onPress,
  onSave
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  onSave: () => void;
}) {
  return (
    <Pressable style={styles.quickSaveButton} onPress={onPress} onLongPress={onSave}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      <Text style={styles.quickSaveText}>{label}</Text>
      <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function SavedPlaceChip({ place, onPress }: { place: StoredPlace; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.savedPlaceChip}>
      <MaterialCommunityIcons name={place.placeType === "pharmacy" ? "pill" : place.placeType === "emergency" ? "hospital-box-outline" : "hospital-building"} size={17} color={colors.primary} />
      <Text style={styles.savedPlaceText}>{place.placeName}</Text>
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

function FacilityDetailModal({
  facility,
  isFavorite,
  defaultDirectionsApp,
  onClose,
  onToggleFavorite,
  onChangeDirectionsApp,
  onOpenReport
}: {
  facility: MedicalFacility | null;
  isFavorite: boolean;
  defaultDirectionsApp: DirectionsApp;
  onClose: () => void;
  onToggleFavorite: () => void;
  onChangeDirectionsApp: (app: DirectionsApp) => void;
  onOpenReport: () => void;
}) {
  if (!facility) return null;
  const callFacility = () => {
    if (facility.phone) {
      Linking.openURL(`tel:${facility.phone.replace(/[^0-9+]/g, "")}`);
    }
  };
  const openDirections = () => {
    Linking.openURL(createDirectionsUrl(facility, defaultDirectionsApp)).catch(() => {
      Linking.openURL(createDirectionsUrl(facility, "google"));
    });
  };

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="상세 팝업 닫기" style={styles.modalScrim} onPress={onClose} />
        <View style={styles.detailModal}>
          <View style={styles.rowBetween}>
            <Text style={styles.sheetTitle}>{facility.name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.modalCloseButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textStrong} />
            </Pressable>
          </View>
          <View style={styles.modalBadgeRow}>
            <StatusBadge facility={facility} />
            <Text style={styles.meta}>{Math.round(facility.distanceKm * 1000)}m</Text>
          </View>
          <Text style={styles.meta}>{facilityStatusText(facility)}</Text>
          <Text style={styles.body}>{facility.address}</Text>
          <Text style={styles.body}>전화번호 {facility.phone || "정보 없음"}</Text>
          <Text style={styles.notice}>운영시간은 변동될 수 있으니 방문 전 전화 확인을 권장합니다.</Text>
          <View style={styles.actionRow}>
            <MapButton label="전화" icon="phone" variant="filled" onPress={callFacility} />
            <MapButton label="길찾기" icon="navigation-variant" variant="outline" onPress={openDirections} />
            <MapButton label="공유" icon="share-variant" variant="outline" />
            <MapButton label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"} icon={isFavorite ? "star-off-outline" : "star-outline"} variant="outline" onPress={onToggleFavorite} />
          </View>
          <View style={styles.navigationApps}>
            <Text style={styles.meta}>길찾기 앱 선택</Text>
            <View style={styles.directionAppRow}>
              {directionApps.map((app) => (
                <Pressable
                  key={app.key}
                  style={[styles.directionAppChip, defaultDirectionsApp === app.key && styles.directionAppChipActive]}
                  onPress={() => onChangeDirectionsApp(app.key)}
                >
                  <Text style={[styles.directionAppText, defaultDirectionsApp === app.key && styles.directionAppTextActive]}>{app.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.meta}>기본 길찾기 앱: {directionApps.find((app) => app.key === defaultDirectionsApp)?.label}</Text>
            <Pressable onPress={onOpenReport}>
              <Text style={styles.linkText}>정보가 달라요</Text>
            </Pressable>
          </View>
      </View>
      </View>
    </Modal>
  );
}

function FacilityReportModal({
  facility,
  reportType,
  description,
  reporterContact,
  message,
  onChangeType,
  onChangeDescription,
  onChangeReporterContact,
  onSubmit,
  onClose
}: {
  facility: MedicalFacility | null;
  reportType: string;
  description: string;
  reporterContact: string;
  message: string | null;
  onChangeType: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeReporterContact: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!facility) return null;
  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="오류 신고 닫기" style={styles.modalScrim} onPress={onClose} />
        <View style={styles.detailModal}>
          <View style={styles.rowBetween}>
            <Text style={styles.sheetTitle}>정보가 달라요</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.modalCloseButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textStrong} />
            </Pressable>
          </View>
          <Text style={styles.body}>{facility.name}</Text>
          <View style={styles.reportTypeRow}>
            {reportTypes.map((type) => (
              <Pressable key={type} style={[styles.reportTypeChip, reportType === type && styles.reportTypeChipActive]} onPress={() => onChangeType(type)}>
                <Text style={[styles.reportTypeText, reportType === type && styles.reportTypeTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={description}
            onChangeText={onChangeDescription}
            placeholder="어떤 정보가 다른지 적어주세요."
            placeholderTextColor="#6B7280"
            style={[styles.districtInput, styles.reportInput]}
            multiline
          />
          <TextInput
            value={reporterContact}
            onChangeText={onChangeReporterContact}
            placeholder="연락처 또는 이메일 선택 입력"
            placeholderTextColor="#6B7280"
            style={styles.districtInput}
          />
          {message ? <Text style={styles.locationMessage}>{message}</Text> : null}
          <View style={styles.actionRow}>
            <MapButton label="신고 접수" icon="send-check-outline" variant="filled" onPress={onSubmit} />
            <MapButton label="닫기" icon="close" variant="outline" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function storedPlaceToFacility(place: StoredPlace): MedicalFacility {
  const placeType = ["pharmacy", "clinic", "hospital", "screening", "emergency"].includes(place.placeType)
    ? place.placeType as MedicalFacility["type"]
    : "hospital";
  const operatingStatus = place.operatingStatus ?? "unknown";
  return {
    id: place.placeId,
    name: place.placeName,
    type: placeType,
    distanceKm: place.distanceKm ?? 0,
    isOpen: operatingStatus === "open_expected",
    hours: place.hours ?? "운영시간 정보 없음",
    operatingStatus,
    closesAt: place.closesAt,
    holidayCare: place.tags?.includes("휴일운영") ?? false,
    nightCare: place.tags?.includes("야간") ?? false,
    hasPhone: Boolean(place.phone),
    phone: place.phone,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    tags: place.tags ?? [placeType === "pharmacy" ? "약국" : placeType === "emergency" ? "응급" : "병원"]
  };
}

function placeFromFacility(facility: MedicalFacility, profile?: { profileId?: string | number; profileName?: string } | null): StoredPlace {
  return {
    placeId: facility.id,
    placeName: facility.name,
    placeType: facility.type,
    profileId: profile?.profileId,
    profileName: profile?.profileName,
    address: facility.address,
    phone: facility.phone,
    distanceKm: facility.distanceKm,
    hours: facility.hours,
    operatingStatus: facility.operatingStatus,
    closesAt: facility.closesAt,
    latitude: facility.latitude,
    longitude: facility.longitude,
    tags: facility.tags
  };
}

function mergePlaces(primary: StoredPlace[], secondary: StoredPlace[]): StoredPlace[] {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((place) => {
    if (seen.has(place.placeId)) return false;
    seen.add(place.placeId);
    return true;
  });
}

function createDirectionsUrl(facility: MedicalFacility, app: DirectionsApp) {
  const query = encodeURIComponent(`${facility.name} ${facility.address}`);
  const lat = facility.latitude;
  const lng = facility.longitude;
  if (app === "naver") {
    return lat && lng
      ? `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(facility.name)}&appname=kr.allcaremedi`
      : `https://map.naver.com/v5/search/${query}`;
  }
  if (app === "kakao") {
    return lat && lng
      ? `kakaomap://route?ep=${lat},${lng}&by=CAR`
      : `https://map.kakao.com/link/search/${query}`;
  }
  if (app === "kakaoNavi") {
    return lat && lng
      ? `kakaonavi://navigate?name=${encodeURIComponent(facility.name)}&x=${lng}&y=${lat}&coord_type=wgs84`
      : `https://map.kakao.com/link/search/${query}`;
  }
  return lat && lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
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

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#FFFFFF",
    gap: spacing.md
  },
  hero: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs
  },
  heroHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xs
  },
  heroTitleGroup: {
    flex: 1,
    justifyContent: "center"
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 4,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800",
    lineHeight: 22
  },
  title: {
    ...typography.title,
    color: colors.textStrong,
    lineHeight: 32
  },
  description: {
    ...typography.body,
    color: colors.text,
    lineHeight: 23
  },
  searchBox: {
    minHeight: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    minHeight: 50,
    color: colors.textStrong
  },
  searchSubmitButton: {
    minWidth: 56,
    minHeight: 38,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  searchSubmitText: {
    ...typography.button,
    color: "#FFFFFF"
  },
  regionSearchPanel: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.sm
  },
  regionChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  regionChip: {
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  regionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  regionChipText: {
    ...typography.caption,
    color: colors.primaryStrong,
    fontWeight: "800"
  },
  regionChipTextActive: {
    color: "#FFFFFF"
  },
  districtInput: {
    ...typography.body,
    minHeight: 50,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    color: colors.textStrong
  },
  locationCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  locationIconBox: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  locationContent: {
    flex: 1,
    gap: spacing.sm
  },
  locationTitle: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    lineHeight: 24,
    fontWeight: "800"
  },
  locationMessage: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  locationActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  savedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  quickSaveButton: {
    minHeight: 46,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  quickSaveText: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.primary
  },
  radiusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  radiusChip: {
    minHeight: 40,
    minWidth: 62,
    borderRadius: 4,
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
    ...typography.caption,
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
    minHeight: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    ...typography.caption,
    color: colors.text
  },
  filterTextActive: {
    color: "#FFFFFF"
  },
  recommendCard: {
    borderRadius: 4,
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
    borderRadius: 4,
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
    borderRadius: 4,
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
    height: 320,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#C7D6EA"
  },
  map: {
    ...StyleSheet.absoluteFillObject
  },
  mapOverlay: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#C7D6EA"
  },
  mapOverlayTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  mapOverlayText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  previewText: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  markerBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF"
  },
  pharmacyMarker: {
    backgroundColor: colors.success
  },
  hospitalMarker: {
    backgroundColor: colors.primary
  },
  emergencyMarker: {
    backgroundColor: emergencyMapRed
  },
  pickMarker: {
    backgroundColor: colors.warning
  },
  markerBubbleActive: {
    backgroundColor: colors.primaryStrong
  },
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  sortChip: {
    minHeight: 38,
    borderRadius: 4,
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
    borderRadius: 4,
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
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text
  },
  facilityCard: {
    borderRadius: 4,
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
  notice: {
    ...typography.body,
    color: colors.warning
  },
  statusBadge: {
    borderRadius: 4,
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
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.48)"
  },
  detailModal: {
    maxHeight: "82%",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt
  },
  modalBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm
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
    minHeight: 42,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
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
    ...typography.caption
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
  directionAppRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  directionAppChip: {
    minHeight: 36,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  directionAppChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  directionAppText: {
    ...typography.caption,
    color: colors.text
  },
  directionAppTextActive: {
    color: colors.primaryStrong
  },
  linkText: {
    ...typography.caption,
    color: colors.primary
  },
  reportTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  reportTypeChip: {
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  reportTypeChipActive: {
    borderColor: colors.warning,
    backgroundColor: "#FFF7ED"
  },
  reportTypeText: {
    ...typography.caption,
    color: colors.text
  },
  reportTypeTextActive: {
    color: colors.warning
  },
  reportInput: {
    minHeight: 96,
    textAlignVertical: "top",
    paddingVertical: spacing.sm
  },
  savedPlacesCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  placeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  savedPlaceChip: {
    minHeight: 38,
    maxWidth: "100%",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  savedPlaceText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  }
});
