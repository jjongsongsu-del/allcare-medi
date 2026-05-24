import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import { Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/components/AppScreen";
import { CurrentFamilyIconButton } from "@/components/CurrentFamilyBanner";
import { MenuHelpButton } from "@/components/MenuHelpButton";
import { useExperienceMode } from "@/experience/ExperienceModeProvider";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { menuHelp } from "@/help/menuHelp";
import { FamilyProfile } from "@/services/localUserData";
import { getNearbyEmergencyRooms } from "@/services/emergencyService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { EmergencyRoom } from "@/types/domain";
import { createEmergencyShare } from "@/services/serverApi";

const defaultLocation = { latitude: 37.5665, longitude: 126.978 };
const defaultRegion: Region = {
  ...defaultLocation,
  latitudeDelta: 0.06,
  longitudeDelta: 0.05
};

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

type EmergencyFilter = "소아응급" | "분만실" | "음압격리" | "일반격리" | "중증진료" | "CT" | "MRI" | "인공호흡기";
const emergencyFilters: EmergencyFilter[] = ["소아응급", "분만실", "음압격리", "일반격리", "중증진료", "CT", "MRI", "인공호흡기"];

export function EmergencyScreen() {
  const { session } = useAuth();
  const { isEasyMode } = useExperienceMode();
  const [emergencyRooms, setEmergencyRooms] = useState<EmergencyRoom[]>([]);
  const [selectedRegion, setSelectedRegion] = useState(regions[0]);
  const [keyword, setKeyword] = useState("");
  const [district, setDistrict] = useState("");
  const [mapRegion, setMapRegion] = useState<Region>(defaultRegion);
  const [userLocation, setUserLocation] = useState(defaultLocation);
  const [loading, setLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState("현재 위치 권한이 없어 서울시청 기준으로 표시합니다.");
  const [selectedRoom, setSelectedRoom] = useState<EmergencyRoom | null>(null);
  const [detailRoom, setDetailRoom] = useState<EmergencyRoom | null>(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [cardDraft, setCardDraft] = useState<FamilyProfile | null>(null);
  const [activeFilters, setActiveFilters] = useState<EmergencyFilter[]>([]);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const { selectedProfile, updateProfile } = useFamilyProfile();

  useEffect(() => {
    loadEmergencyRooms({
      latitude: defaultLocation.latitude,
      longitude: defaultLocation.longitude,
      stage1: selectedRegion.value
    });
  }, []);

  useEffect(() => {
    if (selectedProfile) {
      setCardDraft(selectedProfile);
    }
  }, [selectedProfile]);

  const filteredRooms = useMemo(() => {
    return emergencyRooms.filter((room) => {
      if (activeFilters.includes("소아응급") && !room.pediatricEmergency) return false;
      if (activeFilters.includes("분만실") && !room.deliveryRoom) return false;
      if (activeFilters.includes("음압격리") && room.negativeIsolationBeds <= 0) return false;
      if (activeFilters.includes("일반격리") && room.generalIsolationBeds <= 0) return false;
      if (activeFilters.includes("중증진료") && !room.severeCare) return false;
      if (activeFilters.includes("CT") && !room.ctAvailable) return false;
      if (activeFilters.includes("MRI") && !room.mriAvailable) return false;
      if (activeFilters.includes("인공호흡기") && !room.ventilatorAvailable) return false;
      return true;
    });
  }, [activeFilters, emergencyRooms]);
  const primaryRoom = filteredRooms[0];
  const focusedRoom = selectedRoom ?? primaryRoom;
  const profileAdvice = useMemo(() => getProfileEmergencyAdvice(selectedProfile?.relationType), [selectedProfile?.relationType]);
  const emergencyNotes = [
    selectedProfile?.bloodType ? `혈액형 ${selectedProfile.bloodType}` : "혈액형 미등록",
    selectedProfile?.allergies ? `알레르기 ${selectedProfile.allergies}` : "알레르기 미등록",
    selectedProfile?.currentMedications ? `복용약 ${selectedProfile.currentMedications}` : "복용약 미등록"
  ];

  const loadEmergencyRooms = async (params?: { latitude?: number; longitude?: number; stage1?: string; stage2?: string; query?: string }) => {
    setLoading(true);
    try {
      const rooms = await getNearbyEmergencyRooms({
        latitude: params?.latitude ?? userLocation.latitude,
        longitude: params?.longitude ?? userLocation.longitude,
        stage1: params?.stage1 ?? selectedRegion.value,
        stage2: params?.stage2 ?? (district.trim() || undefined),
        query: params?.query ?? (keyword.trim() || undefined)
      });
      setEmergencyRooms(rooms);
      setSelectedRoom(rooms[0] ?? null);
      setLocationMessage(rooms.length ? "국립중앙의료원 응급실 API에서 실시간 정보를 불러왔습니다." : "응급실 API 조회는 정상이나 조건에 맞는 결과가 없습니다.");
      const firstWithLocation = rooms.find((room) => room.latitude && room.longitude);
      if (firstWithLocation?.latitude && firstWithLocation.longitude) {
        setMapRegion({
          latitude: firstWithLocation.latitude,
          longitude: firstWithLocation.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.05
        });
      }
    } catch (error) {
      setEmergencyRooms([]);
      setSelectedRoom(null);
      setLocationMessage(`응급실 공공 API 연결에 문제가 있습니다. 실제 응급실 정보를 확인할 수 없어 결과를 표시하지 않습니다. ${error instanceof Error ? error.message : ""}`.trim());
    }
    setLoading(false);
  };

  const requestCurrentLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setLocationMessage("위치 권한이 없어 선택한 지역 기준으로 조회합니다.");
      return;
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const nextLocation = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude
    };
    setUserLocation(nextLocation);
    setMapRegion({ ...nextLocation, latitudeDelta: 0.06, longitudeDelta: 0.05 });
    setLocationMessage("현재 위치 기준으로 가까운 응급실을 조회했습니다.");
    await loadEmergencyRooms({
      ...nextLocation,
      stage1: selectedRegion.value,
      stage2: district.trim() || undefined,
      query: keyword.trim() || undefined
    });
  };

  const openEmergencyCardModal = () => {
    setCardDraft(selectedProfile);
    setCardModalVisible(true);
  };

  const saveEmergencyCard = async () => {
    if (!cardDraft) return;
    await updateProfile(cardDraft);
    setCardModalVisible(false);
  };

  const toggleFilter = (filter: EmergencyFilter) => {
    setActiveFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);
  };

  const shareGuardianLocation = async (room: EmergencyRoom) => {
    const guardianContact = selectedProfile?.emergencyContact || selectedProfile?.phone || "";
    const message = [
      `[올케어메디 응급 위치 공유]`,
      `대상: ${selectedProfile?.profileName ?? "나"}`,
      `응급실: ${room.name}`,
      `주소: ${room.address}`,
      `전화: ${room.emergencyPhone || room.emergencyDirectPhone || room.phone || "확인 필요"}`,
      room.latitude && room.longitude ? `위치: https://www.google.com/maps/search/?api=1&query=${room.latitude},${room.longitude}` : "",
      guardianContact ? `보호자 연락처: ${guardianContact}` : "보호자 연락처 미등록"
    ].filter(Boolean).join("\n");
    setShareMessage(null);
    if (session?.mode === "member") {
      await createEmergencyShare({
        userId: session.userId,
        profileId: selectedProfile?.profileId,
        profileName: selectedProfile?.profileName,
        guardianContact,
        roomId: room.id,
        roomName: room.name,
        roomPhone: room.emergencyPhone || room.emergencyDirectPhone || room.phone,
        latitude: room.latitude,
        longitude: room.longitude,
        message
      }).catch(() => undefined);
    }
    await Share.share({ message });
    setShareMessage("보호자에게 공유할 응급 위치 정보를 열었습니다.");
  };

  return (
    <AppScreen contentStyle={[styles.screen, isEasyMode && styles.easyScreen]}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.alertIconBox}>
            <MaterialCommunityIcons name="alert" size={26} color={emergencyRed} />
          </View>
          <View style={styles.heroTitleGroup}>
            <Text style={styles.eyebrow}>응급</Text>
            <Text style={styles.title}>지금 갈 수 있는 응급실</Text>
          </View>
          <CurrentFamilyIconButton />
          <MenuHelpButton content={menuHelp.emergency} />
        </View>
      </View>

      <View style={styles.priorityNotice}>
        <MaterialCommunityIcons name="phone-alert" size={24} color={emergencyRed} />
        <Text style={styles.priorityText}>생명에 위협이 있거나 판단이 어려운 상황은 앱 조회보다 119 신고가 우선입니다.</Text>
      </View>

      <View style={styles.searchPanel}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={22} color={mutedRed} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => loadEmergencyRooms()}
            placeholder="병원명, 지역, 중증진료 검색"
            placeholderTextColor="#B56A6A"
            style={styles.searchInput}
          />
          <Pressable style={styles.searchSubmitButton} onPress={() => loadEmergencyRooms()}>
            <Text style={styles.searchSubmitText}>조회</Text>
          </Pressable>
        </View>

        <View style={styles.chipRow}>
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
          onSubmitEditing={() => loadEmergencyRooms()}
          placeholder="시군구 입력 예: 강남구"
          placeholderTextColor="#B56A6A"
          style={styles.districtInput}
        />

        <View style={styles.actionRow}>
          <EmergencyButton label={loading ? "조회 중" : "조회"} icon="clipboard-pulse-outline" variant="filled" onPress={() => loadEmergencyRooms()} />
          <EmergencyButton label="내 위치 기준" icon="crosshairs-gps" variant="filled" onPress={requestCurrentLocation} />
          <EmergencyButton label="NEMC 보기" icon="open-in-new" variant="outline" onPress={() => Linking.openURL("https://www.e-gen.or.kr/")} />
        </View>
        {!isEasyMode ? <View style={styles.emergencyFilterRow}>
          {emergencyFilters.map((filter) => {
            const active = activeFilters.includes(filter);
            return (
              <Pressable key={filter} style={[styles.emergencyFilterChip, active && styles.emergencyFilterChipActive]} onPress={() => toggleFilter(filter)}>
                <Text style={[styles.emergencyFilterText, active && styles.emergencyFilterTextActive]}>{filter}</Text>
              </Pressable>
            );
          })}
        </View> : null}
        <Text style={styles.updatedText}>{locationMessage}</Text>
        {shareMessage ? <Text style={styles.updatedText}>{shareMessage}</Text> : null}
      </View>

      <View style={styles.mapCard}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={mapRegion}
          liteMode={Platform.OS === "android"}
          showsUserLocation
          showsMyLocationButton={false}
          onRegionChangeComplete={setMapRegion}
        >
          {filteredRooms.filter((room) => room.latitude && room.longitude).map((room) => (
            <Marker
              key={room.id}
              coordinate={{ latitude: room.latitude!, longitude: room.longitude! }}
              title={room.name}
              description={`응급실 일반 ${formatCapacityInline(room.emergencyGeneralBeds)} · ${room.distanceKm.toFixed(1)}km`}
              onPress={() => {
                setSelectedRoom(room);
                setDetailRoom(room);
              }}
            >
              <View style={[styles.markerBubble, room.id === focusedRoom?.id && styles.markerBubbleActive]}>
                <MaterialCommunityIcons name="hospital-box-outline" size={18} color="#FFFFFF" />
              </View>
            </Marker>
          ))}
        </MapView>
        <View style={styles.mapOverlay}>
          <Text style={styles.mapOverlayTitle}>{focusedRoom?.name ?? "응급실 정보 없음"}</Text>
          <Text style={styles.mapOverlayText}>
            {focusedRoom ? `${formatDistance(focusedRoom.distanceKm)} · 응급실 일반 ${formatCapacityInline(focusedRoom.emergencyGeneralBeds)}` : "지역 또는 위치를 바꿔 다시 조회해 주세요."}
          </Text>
        </View>
      </View>

      <View style={styles.familyCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleArea}>
            <Text style={styles.cardEyebrow}>선택 가족 응급카드</Text>
            <Text style={styles.cardTitle}>{selectedProfile?.profileName ?? "나"} 기준 확인 정보</Text>
          </View>
          <View style={styles.cardHeaderActions}>
            <View style={styles.familyBadge}>
              <Text style={styles.familyBadgeText}>{profileAdvice.badge}</Text>
            </View>
            <Pressable style={styles.editCardButton} onPress={openEmergencyCardModal}>
              <MaterialCommunityIcons name="pencil" size={17} color={emergencyRed} />
              <Text style={styles.editCardText}>수정</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.familyAdvice}>{profileAdvice.message}</Text>
        <View style={styles.noteGrid}>
          {emergencyNotes.map((note) => (
            <View key={note} style={styles.notePill}>
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.helperText}>
          보호자 연락처: {selectedProfile?.emergencyContact || selectedProfile?.phone || "미등록"} · 응급실 방문 전 전화 확인을 권장합니다.
        </Text>
      </View>

      {filteredRooms.map((room) => (
        <EmergencyRoomCard
          key={room.id}
          room={room}
          highlighted={room.id === focusedRoom?.id}
          onSelect={() => {
            setSelectedRoom(room);
            setDetailRoom(room);
          }}
          onShare={() => shareGuardianLocation(room)}
        />
      ))}
      {filteredRooms.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.roomName}>조건에 맞는 응급실이 없습니다.</Text>
          <Text style={styles.address}>필터를 줄이거나 지역을 넓혀 다시 조회해 주세요. 위급 상황은 119 신고가 우선입니다.</Text>
        </View>
      ) : null}

      <EmergencyRoomDetailModal
        room={detailRoom}
        selectedProfile={selectedProfile}
        onClose={() => setDetailRoom(null)}
        onShare={shareGuardianLocation}
      />

      <EmergencyCardModal
        visible={cardModalVisible}
        draft={cardDraft}
        onChange={(patch) => setCardDraft((current) => current ? { ...current, ...patch } : current)}
        onClose={() => setCardModalVisible(false)}
        onSave={saveEmergencyCard}
      />
    </AppScreen>
  );
}

function EmergencyButton({
  label,
  icon,
  variant,
  onPress
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  variant: "filled" | "outline";
  onPress?: () => void;
}) {
  const filled = variant === "filled";
  return (
    <Pressable style={[styles.button, filled ? styles.buttonFilled : styles.buttonOutline]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={18} color={filled ? "#FFFFFF" : emergencyRed} />
      <Text style={[styles.buttonText, filled ? styles.buttonTextFilled : styles.buttonTextOutline]}>{label}</Text>
    </Pressable>
  );
}

function EmergencyRoomCard({
  room,
  highlighted,
  onSelect,
  onShare
}: {
  room: EmergencyRoom;
  highlighted: boolean;
  onSelect: () => void;
  onShare: () => void;
}) {
  const phone = room.emergencyPhone || room.phone;
  const openDirections = () => {
    const url = room.latitude && room.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${room.latitude},${room.longitude}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${room.name} ${room.address}`)}`;
    Linking.openURL(url);
  };

  return (
    <Pressable style={[styles.roomCard, highlighted && styles.roomCardHighlighted]} onPress={onSelect}>
      <View style={styles.roomTopRow}>
        <View style={styles.roomTitleArea}>
          <Text style={styles.roomName}>{room.name}</Text>
          <Text style={styles.roomMeta}>{room.centerType} · {formatDistance(room.distanceKm)}</Text>
        </View>
        <View style={styles.bedBadge}>
          <Text style={styles.bedCount}>{formatCapacityValue(room.emergencyGeneralBeds)}</Text>
          <Text style={styles.bedLabel}>응급실</Text>
        </View>
      </View>
      <Text style={styles.address}>{room.address}</Text>

      <EmergencyRoomCapacityDetails room={room} />

      {false && (
        <>
      <View style={styles.metricRow}>
        <MetricBox value={room.operatingRooms} label="수술실" />
        <MetricBox value={room.icuBeds} label="중환자" />
        <MetricBox value={room.inpatientBeds} label="입원실" />
      </View>

      <View style={styles.statusRow}>
        <StatusPill label="소아응급" active={room.pediatricEmergency} />
        <StatusPill label="분만실" active={room.deliveryRoom} />
        <StatusPill label="격리실" active={room.isolationRoom} />
        <StatusPill label="중증진료" active={room.severeCare} />
      </View>

        </>
      )}

      <Text style={styles.roomNotice}>최근 업데이트: {room.updatedAt} · 실제 수용 가능 여부는 전화 확인이 필요합니다.</Text>

      <View style={styles.roomActions}>
        <EmergencyButton label="전화" icon="phone" variant="filled" onPress={() => phone && Linking.openURL(`tel:${phone}`)} />
        <EmergencyButton label="길찾기" icon="navigation-variant" variant="outline" onPress={openDirections} />
        <EmergencyButton label="공유" icon="share-variant" variant="outline" onPress={onShare} />
      </View>
    </Pressable>
  );
}

function EmergencyRoomDetailModal({
  room,
  selectedProfile,
  onClose,
  onShare
}: {
  room: EmergencyRoom | null;
  selectedProfile: FamilyProfile | null;
  onClose: () => void;
  onShare: (room: EmergencyRoom) => void;
}) {
  if (!room) return null;
  const phone = room.emergencyPhone || room.emergencyDirectPhone || room.phone;
  const directionsUrl = room.latitude && room.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${room.latitude},${room.longitude}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${room.name} ${room.address}`)}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.detailBackdrop}>
        <Pressable style={styles.detailScrim} onPress={onClose} />
        <View style={styles.detailModal}>
          <View style={styles.modalHeader}>
            <View style={styles.detailTitleArea}>
              <Text style={styles.cardEyebrow}>응급실 상세</Text>
              <Text style={styles.modalTitle}>{room.name}</Text>
              <Text style={styles.roomMeta}>{room.centerType} · {formatDistance(room.distanceKm)}</Text>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textStrong} />
            </Pressable>
          </View>

          <Text style={styles.address}>{room.address}</Text>
          <Text style={styles.roomNotice}>전화: {phone || "확인 필요"} · 입력일시: {room.updatedAt}</Text>

          <EmergencyRoomCapacityDetails room={room} />

          <View style={styles.detailSection}>
            <Text style={styles.capacityTitle}>선택 가족 응급정보</Text>
            <View style={styles.noteGrid}>
              <View style={styles.notePill}><Text style={styles.noteText}>대상 {selectedProfile?.profileName ?? "나"}</Text></View>
              <View style={styles.notePill}><Text style={styles.noteText}>혈액형 {selectedProfile?.bloodType || "미등록"}</Text></View>
              <View style={styles.notePill}><Text style={styles.noteText}>알레르기 {selectedProfile?.allergies || "미등록"}</Text></View>
              <View style={styles.notePill}><Text style={styles.noteText}>복용약 {selectedProfile?.currentMedications || "미등록"}</Text></View>
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.capacityTitle}>특화 진료/장비</Text>
            <View style={styles.statusRow}>
              <StatusPill label="소아응급" active={room.pediatricEmergency} />
              <StatusPill label="분만실" active={room.deliveryRoom} />
              <StatusPill label="음압격리" active={room.negativeIsolationBeds > 0} />
              <StatusPill label="일반격리" active={room.generalIsolationBeds > 0} />
              <StatusPill label="중증진료" active={room.severeCare} />
            </View>
          </View>

          <View style={styles.roomActions}>
            <EmergencyButton label="전화" icon="phone" variant="filled" onPress={() => phone && Linking.openURL(`tel:${phone}`)} />
            <EmergencyButton label="길찾기" icon="navigation-variant" variant="outline" onPress={() => Linking.openURL(directionsUrl)} />
            <EmergencyButton label="보호자 공유" icon="share-variant" variant="outline" onPress={() => onShare(room)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EmergencyCardModal({
  visible,
  draft,
  onChange,
  onClose,
  onSave
}: {
  visible: boolean;
  draft: FamilyProfile | null;
  onChange: (patch: Partial<FamilyProfile>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>응급카드 수정</Text>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textStrong} />
            </Pressable>
          </View>
          <EmergencyInput label="혈액형" value={draft?.bloodType ?? ""} onChangeText={(value) => onChange({ bloodType: value })} placeholder="예: A+" />
          <EmergencyInput label="알레르기" value={draft?.allergies ?? ""} onChangeText={(value) => onChange({ allergies: value })} placeholder="예: 페니실린, 땅콩" />
          <EmergencyInput label="기저질환" value={draft?.chronicDiseases ?? ""} onChangeText={(value) => onChange({ chronicDiseases: value })} placeholder="예: 고혈압, 당뇨" />
          <EmergencyInput label="복용 중인 약" value={draft?.currentMedications ?? ""} onChangeText={(value) => onChange({ currentMedications: value })} placeholder="예: 혈압약 아침 1정" />
          <EmergencyInput label="응급 연락처" value={draft?.emergencyContact ?? ""} onChangeText={(value) => onChange({ emergencyContact: value })} placeholder="예: 010-0000-0000" />
          <View style={styles.modalActions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={onSave}>
              <Text style={styles.saveButtonText}>저장</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EmergencyInput({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={styles.modalInput} />
    </View>
  );
}

function EmergencyRoomCapacityDetails({ room }: { room: EmergencyRoom }) {
  return (
    <View style={styles.capacityPanel}>
      <Text style={styles.capacityTitle}>응급의료정보조회서비스 V4 병상 현황</Text>
      <View style={styles.metricRow}>
        <MetricBox value={formatCapacityValue(room.emergencyGeneralBeds)} label="응급실 일반" />
        <MetricBox value={formatCapacityValue(room.pediatricBeds)} label="소아" />
        <MetricBox value={formatCapacityValue(room.operatingRooms)} label="수술실" />
      </View>
      <View style={styles.metricRow}>
        <MetricBox value={formatCapacityValue(room.icuBeds)} label="중환자실 일반" />
        <MetricBox value={formatCapacityValue(room.emergencyIcuBeds)} label="응급전용 중환자" />
        <MetricBox value={formatCapacityValue(room.inpatientBeds)} label="입원실 일반" />
      </View>
      <View style={styles.metricRow}>
        <MetricBox value={formatCapacityValue(room.negativeIsolationBeds)} label="응급 음압격리" />
        <MetricBox value={formatCapacityValue(room.generalIsolationBeds)} label="응급 일반격리" />
        <MetricBox value={formatCapacityValue(room.deliveryRoomBeds)} label="분만실" />
      </View>
      <View style={styles.statusRow}>
        <EquipmentPill label="CT" active={room.ctAvailable} />
        <EquipmentPill label="MRI" active={room.mriAvailable} />
        <EquipmentPill label="혈관촬영" active={room.angiographyAvailable} />
        <EquipmentPill label="인공호흡기" active={room.ventilatorAvailable} />
        <EquipmentPill label="구급차" active={room.ambulanceAvailable} />
      </View>
      <Text style={styles.roomNotice}>응급실 전화: {room.emergencyDirectPhone || room.emergencyPhone || room.phone || "확인 필요"}</Text>
      <Text style={styles.roomNotice}>입력일시: {room.updatedAt} · {room.dataNote}</Text>
    </View>
  );
}

function MetricBox({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.statusPill, active ? styles.statusPillActive : styles.statusPillInactive]}>
      <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextInactive]}>
        {active ? label : `${label} 확인`}
      </Text>
    </View>
  );
}

function EquipmentPill({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.statusPill, active ? styles.statusPillActive : styles.statusPillInactive]}>
      <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextInactive]}>
        {label} {active ? "가용" : "확인"}
      </Text>
    </View>
  );
}

function formatDistance(distanceKm: number) {
  if (!distanceKm) return "거리 확인";
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`;
}

function formatCapacityValue(value: number) {
  if (value < 0) return `초과 ${Math.abs(value)}`;
  return value;
}

function formatCapacityInline(value: number) {
  if (value < 0) return `초과 ${Math.abs(value)}병상`;
  return `${value}병상`;
}

function getProfileEmergencyAdvice(relation?: string | null) {
  if (relation === "CHILD") {
    return { badge: "소아 우선", message: "자녀 프로필이 선택되어 소아응급 가능 여부를 먼저 확인할 수 있습니다." };
  }
  if (relation === "PARENT") {
    return { badge: "보호자 확인", message: "부모님 프로필이 선택되어 복용약, 기저질환, 보호자 연락처 확인을 우선합니다." };
  }
  if (relation === "SPOUSE") {
    return { badge: "가족 공유", message: "배우자 응급정보와 보호자 연락처를 함께 확인할 수 있습니다." };
  }
  return { badge: "본인", message: "현재 선택 가족의 응급카드 정보를 기준으로 전화와 길찾기를 진행합니다." };
}

const emergencyRed = "#D92D20";
const emergencyDark = "#8C1D18";
const emergencySoft = "#FFF1F1";
const emergencyTint = "#FFE4E2";
const mutedRed = "#A64B45";

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#FFFFFF",
    gap: spacing.md
  },
  easyScreen: {
    gap: spacing.xl,
    paddingHorizontal: spacing.xl
  },
  hero: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FFB4AB",
    backgroundColor: emergencySoft,
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
  alertIconBox: {
    width: 54,
    height: 54,
    borderRadius: 4,
    backgroundColor: emergencyTint,
    alignItems: "center",
    justifyContent: "center"
  },
  eyebrow: {
    ...typography.caption,
    color: emergencyRed,
    fontWeight: "800"
  },
  title: {
    ...typography.title,
    color: emergencyDark
  },
  description: {
    ...typography.body,
    color: emergencyDark
  },
  priorityNotice: {
    minHeight: 70,
    borderRadius: 4,
    backgroundColor: emergencyTint,
    borderWidth: 1,
    borderColor: "#FFB4AB",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  priorityText: {
    ...typography.body,
    flex: 1,
    color: emergencyDark,
    fontWeight: "700"
  },
  searchPanel: {
    borderRadius: 4,
    backgroundColor: emergencySoft,
    borderWidth: 1,
    borderColor: "#FFD0CC",
    padding: spacing.md,
    gap: spacing.sm
  },
  searchBox: {
    minHeight: 52,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F7B5AF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    color: colors.textStrong,
    minHeight: 50
  },
  searchSubmitButton: {
    minHeight: 40,
    borderRadius: 4,
    backgroundColor: emergencyRed,
    paddingHorizontal: spacing.md,
    justifyContent: "center"
  },
  searchSubmitText: {
    ...typography.caption,
    color: "#FFFFFF",
    fontWeight: "800"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  regionChip: {
    minHeight: 38,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F2B8B5"
  },
  regionChipActive: {
    backgroundColor: emergencyRed,
    borderColor: emergencyRed
  },
  regionChipText: {
    ...typography.caption,
    color: emergencyDark,
    fontWeight: "700"
  },
  regionChipTextActive: {
    color: "#FFFFFF"
  },
  districtInput: {
    ...typography.body,
    minHeight: 50,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F7B5AF",
    paddingHorizontal: spacing.md,
    color: colors.textStrong
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  button: {
    minHeight: 48,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  buttonFilled: {
    backgroundColor: emergencyRed
  },
  buttonOutline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: emergencyRed
  },
  buttonText: {
    ...typography.button
  },
  buttonTextFilled: {
    color: "#FFFFFF"
  },
  buttonTextOutline: {
    color: emergencyRed
  },
  updatedText: {
    ...typography.caption,
    color: mutedRed
  },
  emergencyFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  emergencyFilterChip: {
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#F2B8B5",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.sm,
    justifyContent: "center"
  },
  emergencyFilterChipActive: {
    borderColor: emergencyRed,
    backgroundColor: emergencyRed
  },
  emergencyFilterText: {
    ...typography.caption,
    color: emergencyDark,
    fontWeight: "800"
  },
  emergencyFilterTextActive: {
    color: "#FFFFFF"
  },
  mapCard: {
    height: 320,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: "#FFD0CC"
  },
  map: {
    ...StyleSheet.absoluteFillObject
  },
  markerBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: emergencyRed,
    borderWidth: 2,
    borderColor: "#FFFFFF"
  },
  markerBubbleActive: {
    backgroundColor: emergencyDark
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
    borderColor: "#FFD0CC"
  },
  mapOverlayTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  mapOverlayText: {
    ...typography.caption,
    color: emergencyRed,
    fontWeight: "800"
  },
  familyCard: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFD0CC",
    padding: spacing.md,
    gap: spacing.sm
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  cardTitleArea: {
    flex: 1
  },
  cardHeaderActions: {
    alignItems: "flex-end",
    gap: spacing.xs
  },
  cardEyebrow: {
    ...typography.caption,
    color: emergencyRed,
    fontWeight: "800"
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  familyBadge: {
    borderRadius: 4,
    backgroundColor: emergencyTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  familyBadgeText: {
    ...typography.caption,
    color: emergencyDark,
    fontWeight: "800"
  },
  editCardButton: {
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: emergencyRed,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  editCardText: {
    ...typography.caption,
    color: emergencyRed,
    fontWeight: "800"
  },
  familyAdvice: {
    ...typography.body,
    color: colors.text
  },
  noteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  notePill: {
    minHeight: 34,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  noteText: {
    ...typography.caption,
    color: colors.textStrong,
    fontWeight: "700"
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted
  },
  roomCard: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm
  },
  roomCardHighlighted: {
    borderColor: "#FFB4AB",
    shadowColor: emergencyRed,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2
  },
  emptyCard: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFD0CC",
    padding: spacing.md,
    gap: spacing.sm
  },
  roomTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  roomTitleArea: {
    flex: 1,
    gap: 2
  },
  roomName: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  roomMeta: {
    ...typography.caption,
    color: emergencyRed,
    fontWeight: "800"
  },
  bedBadge: {
    minWidth: 70,
    borderRadius: 4,
    backgroundColor: emergencyTint,
    alignItems: "center",
    paddingVertical: spacing.xs
  },
  bedCount: {
    ...typography.sectionTitle,
    color: emergencyRed
  },
  bedLabel: {
    ...typography.caption,
    color: emergencyDark,
    fontWeight: "800"
  },
  address: {
    ...typography.body,
    color: colors.text
  },
  capacityPanel: {
    borderRadius: 4,
    backgroundColor: "#FFF8F7",
    borderWidth: 1,
    borderColor: "#FFD0CC",
    padding: spacing.sm,
    gap: spacing.sm
  },
  capacityTitle: {
    ...typography.caption,
    color: emergencyRed,
    fontWeight: "800"
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  metricBox: {
    flex: 1,
    minHeight: 70,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  metricValue: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "800"
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  statusPill: {
    minHeight: 34,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    justifyContent: "center"
  },
  statusPillActive: {
    backgroundColor: "#E8F5EE"
  },
  statusPillInactive: {
    backgroundColor: "#F3F4F6"
  },
  statusText: {
    ...typography.caption,
    fontWeight: "800"
  },
  statusTextActive: {
    color: colors.success
  },
  statusTextInactive: {
    color: colors.textMuted
  },
  roomNotice: {
    ...typography.caption,
    color: colors.textMuted
  },
  roomActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "flex-end"
  },
  detailBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  detailScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.42)"
  },
  detailModal: {
    maxHeight: "88%",
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFD0CC",
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  },
  detailTitleArea: {
    flex: 1,
    gap: 2
  },
  detailSection: {
    gap: spacing.sm
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: spacing.lg,
    gap: spacing.md
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  modalTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  inputGroup: {
    gap: spacing.xs
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textStrong,
    fontWeight: "800"
  },
  modalInput: {
    ...typography.body,
    minHeight: 50,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.textStrong
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.text
  },
  saveButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 4,
    backgroundColor: emergencyRed,
    alignItems: "center",
    justifyContent: "center"
  },
  saveButtonText: {
    ...typography.button,
    color: "#FFFFFF"
  }
});
