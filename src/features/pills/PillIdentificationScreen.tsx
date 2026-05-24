import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BarcodeScanningResult, Camera, CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { CurrentFamilyBanner } from "@/components/CurrentFamilyBanner";
import { MenuHelpButton } from "@/components/MenuHelpButton";
import { useAuth } from "@/auth/AuthProvider";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { menuHelp } from "@/help/menuHelp";
import {
  getLocalRegisteredMedicines,
  saveLocalMedicationEvent,
  saveLocalMedicineSchedule,
  saveLocalRegisteredMedicine,
  updateLocalRegisteredMedicine
} from "@/services/localUserData";
import { rescheduleLocalMedicationNotifications } from "@/services/medicationNotificationService";
import { recognizePillFromImage } from "@/services/pillRecognitionService";
import { parsePrescriptionQrPayload } from "@/services/prescriptionQrService";
import { createMedicineSchedule, createMedicationEvent, createRegisteredMedicine, fetchRegisteredMedicines, searchDurSafety, searchMedicines, updateRegisteredMedicine, uploadPrescriptionOcr } from "@/services/serverApi";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { MedicationEvent, MedicineSchedule, MedicineSearchResult, Pill, PrescriptionOcrMedicine, PrescriptionOcrResult, RegisteredMedicine } from "@/types/domain";

type PillTab = "medicine" | "prescription";
type RegisterMethod = "manual" | "search" | "prescription" | "ai";
type RegisterStep = "input" | "confirm" | "schedule";
type MedicineDraft = {
  name: string;
  alias: string;
  manufacturer: string;
  ingredient: string;
  dosage: string;
  form: string;
  color: string;
  purpose: string;
  memo: string;
  durWarnings: string[];
};
type PrescriptionMedicineDraft = PrescriptionOcrMedicine & {
  localId: string;
  selected: boolean;
};
type DurCompareSeverity = "danger" | "warning" | "safe";
type DurCompareResult = {
  id: string;
  severity: DurCompareSeverity;
  title: string;
  description: string;
  medicineNames: string[];
};
const prescriptionQrSamplePayload = JSON.stringify({
  patientName: "홍길동",
  prescriptionDate: "2026-05-24",
  hospitalName: "올케어의원",
  doctorName: "김케어",
  medicines: [
    {
      medicineName: "아침 혈압약",
      dosage: "1정",
      timing: "아침 식후",
      durationDays: 7,
      doseTimes: ["08:00"],
      usage: "하루 1회 아침 식후 복용"
    },
    {
      medicineName: "저녁 위장약",
      dosage: "1정",
      timing: "저녁 식후",
      durationDays: 7,
      doseTimes: ["19:00"],
      usage: "하루 1회 저녁 식후 복용"
    }
  ]
});
type ScheduleDraftState = {
  timesPerDay: number;
  doseTimes: string[];
  startDate: string;
  endDate: string;
  durationDays: string;
  repeatRule: MedicineSchedule["repeatRule"];
  weekdays: number[];
  weekInterval: string;
  monthlyMode: NonNullable<MedicineSchedule["monthlyMode"]>;
  monthDays: number[];
  monthlyWeekOrdinal: string;
  monthlyWeekday: string;
  missingDatePolicy: NonNullable<MedicineSchedule["missingDatePolicy"]>;
  intervalHours: string;
  intervalDays: string;
  cycleActiveDays: string;
  cycleRestDays: string;
  maxDailyNotifications: string;
  relationOffsetMinutes: string;
  reminderEnabled: boolean;
  reminderIntervalMinutes: string;
  reminderMaxCount: string;
  guardianAlertEnabled: boolean;
  guardianAlertDelayMinutes: string;
  paused: boolean;
  notifyEnabled: boolean;
  notificationLevel: MedicineSchedule["notificationLevel"];
  doseMethod: string;
  doseTiming: string;
};
const registrationMethods: Array<{
  key: RegisterMethod;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: "manual", title: "직접등록", description: "약명·용량 입력", icon: "square-edit-outline" },
  { key: "search", title: "검색등록", description: "e약은 API", icon: "magnify" },
  { key: "prescription", title: "처방전등록", description: "OCR 추출", icon: "file-document-edit-outline" },
  { key: "ai", title: "AI판독등록", description: "사진 후보 확인", icon: "camera-outline" }
];

const listFilters = ["전체", "복용중", "복용예정", "복용종료", "즐겨찾기", "고위험"];
const scheduleTimes = ["아침 08:00", "점심 13:00", "저녁 19:00", "취침 전 22:00"];
const defaultDoseTimes = ["08:00", "13:00", "19:00", "22:00"];
const weekdayOptions = [
  { label: "월", value: 1 },
  { label: "화", value: 2 },
  { label: "수", value: 3 },
  { label: "목", value: 4 },
  { label: "금", value: 5 },
  { label: "토", value: 6 },
  { label: "일", value: 0 }
];
const defaultScheduleDraft = (): ScheduleDraftState => ({
  timesPerDay: 1,
  doseTimes: ["08:00"],
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  durationDays: "",
  repeatRule: "daily",
  weekdays: [new Date().getDay()],
  weekInterval: "1",
  monthlyMode: "date",
  monthDays: [new Date().getDate()],
  monthlyWeekOrdinal: "1",
  monthlyWeekday: String(new Date().getDay()),
  missingDatePolicy: "last_day",
  intervalHours: "6",
  intervalDays: "",
  cycleActiveDays: "3",
  cycleRestDays: "1",
  maxDailyNotifications: "4",
  relationOffsetMinutes: "30",
  reminderEnabled: false,
  reminderIntervalMinutes: "10",
  reminderMaxCount: "3",
  guardianAlertEnabled: false,
  guardianAlertDelayMinutes: "30",
  paused: false,
  notifyEnabled: true,
  notificationLevel: "normal",
  doseMethod: "경구",
  doseTiming: "식후"
});

const registeredMedicinesSeed: RegisteredMedicine[] = [
  {
    id: "registered-001",
    name: "아모잘탄정",
    alias: "아침 혈압약",
    ingredient: "암로디핀/로사르탄",
    manufacturer: "한미약품",
    dosage: "1정",
    form: "정제",
    color: "분홍색",
    purpose: "혈압",
    timing: "아침 식후",
    schedule: "매일 08:00 · 30일",
    status: "taking",
    source: "manual",
    favorite: true,
    highRisk: true,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z"
  },
  {
    id: "registered-002",
    name: "비타민 D",
    alias: "저녁 영양제",
    ingredient: "콜레칼시페롤",
    manufacturer: "올케어제약",
    dosage: "1캡슐",
    form: "캡슐",
    color: "노란색",
    purpose: "영양",
    timing: "저녁 식후",
    schedule: "매일 21:00 · 장기",
    status: "scheduled",
    source: "manual",
    favorite: false,
    highRisk: false,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z"
  }
];

export function PillIdentificationScreen() {
  const { session } = useAuth();
  const { selectedProfile } = useFamilyProfile();
  const [pills, setPills] = useState<Pill[]>([]);
  const [activeTab, setActiveTab] = useState<PillTab>("medicine");
  const [selectedMethod, setSelectedMethod] = useState<RegisterMethod>("manual");
  const [activeStep, setActiveStep] = useState<RegisterStep>("input");
  const [registrationModalVisible, setRegistrationModalVisible] = useState(false);
  const [durCompareMode, setDurCompareMode] = useState(false);
  const [durCompareSelectedIds, setDurCompareSelectedIds] = useState<string[]>([]);
  const [durCompareModalVisible, setDurCompareModalVisible] = useState(false);
  const [durCompareLoading, setDurCompareLoading] = useState(false);
  const [durCompareResults, setDurCompareResults] = useState<DurCompareResult[]>([]);
  const [durCompareMessage, setDurCompareMessage] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [medicineSearchQuery, setMedicineSearchQuery] = useState("");
  const [medicineSearchResults, setMedicineSearchResults] = useState<MedicineSearchResult[]>([]);
  const [selectedSearchMedicine, setSelectedSearchMedicine] = useState<MedicineSearchResult | null>(null);
  const [medicineSearchLoading, setMedicineSearchLoading] = useState(false);
  const [medicineSearchError, setMedicineSearchError] = useState<string | null>(null);
  const [prescriptionOcrResult, setPrescriptionOcrResult] = useState<PrescriptionOcrResult | null>(null);
  const [selectedPrescriptionMedicine, setSelectedPrescriptionMedicine] = useState<PrescriptionOcrMedicine | null>(null);
  const [prescriptionOcrLoading, setPrescriptionOcrLoading] = useState(false);
  const [prescriptionOcrError, setPrescriptionOcrError] = useState<string | null>(null);
  const [prescriptionQrScannerVisible, setPrescriptionQrScannerVisible] = useState(false);
  const [prescriptionQrScanned, setPrescriptionQrScanned] = useState(false);
  const [prescriptionQrRaw, setPrescriptionQrRaw] = useState<string | null>(null);
  const [prescriptionQrSampleText, setPrescriptionQrSampleText] = useState("");
  const [prescriptionMedicineDrafts, setPrescriptionMedicineDrafts] = useState<PrescriptionMedicineDraft[]>([]);
  const [prescriptionDurWarnings, setPrescriptionDurWarnings] = useState<Record<string, string[]>>({});
  const [prescriptionDurLoading, setPrescriptionDurLoading] = useState(false);
  const [prescriptionDurMessage, setPrescriptionDurMessage] = useState<string | null>(null);
  const [durLoading, setDurLoading] = useState(false);
  const [durMessage, setDurMessage] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState("전체");
  const [draft, setDraft] = useState<MedicineDraft>({
    name: "",
    alias: "",
    manufacturer: "",
    ingredient: "",
    dosage: "1정",
    form: "정제",
    color: "",
    purpose: "",
    memo: "",
    durWarnings: []
  });
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraftState>(defaultScheduleDraft);
  const [medicines, setMedicines] = useState<RegisteredMedicine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const isMember = session?.mode === "member" && Boolean(session.userId);

  useEffect(() => {
    recognizePillFromImage().then(setPills);
  }, []);

  useEffect(() => {
    loadMedicines();
  }, [session?.mode, session?.userId, selectedProfile?.profileId]);

  const loadMedicines = async () => {
    if (isMember && session?.userId) {
      const serverMedicines = await fetchRegisteredMedicines({ userId: session.userId, profileId: selectedProfile?.profileId }).catch(() => []);
      if (serverMedicines.length) {
        setMedicines(serverMedicines);
        return;
      }
    }
    const localMedicines = await getLocalRegisteredMedicines(selectedProfile);
    setMedicines(localMedicines.length ? localMedicines : seedForSelectedProfile(selectedProfile));
  };

  const filteredMedicines = useMemo(() => {
    const normalizedSearch = searchText.trim();
    return medicines
      .filter((medicine) => {
        if (listFilter === "복용중" && medicine.status !== "taking") return false;
        if (listFilter === "복용예정" && medicine.status !== "scheduled") return false;
        if (listFilter === "복용종료" && medicine.status !== "ended") return false;
        if (listFilter === "즐겨찾기" && !medicine.favorite) return false;
        if (listFilter === "고위험" && !medicine.highRisk) return false;
        if (!normalizedSearch) return true;
        return [medicine.name, medicine.alias, medicine.ingredient, medicine.purpose].join(" ").includes(normalizedSearch);
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite));
  }, [listFilter, medicines, searchText]);

  const selectedMethodMeta = registrationMethods.find((method) => method.key === selectedMethod) ?? registrationMethods[0];

  const openRegistrationModal = (method: RegisterMethod) => {
    setSelectedMethod(method);
    setActiveStep("input");
    setRegistrationModalVisible(true);
    setMedicineSearchError(null);
    setRegistrationError(null);
    if (method !== "search") {
      setSelectedSearchMedicine(null);
      setMedicineSearchResults([]);
    }
    if (method !== "prescription") {
      setPrescriptionOcrResult(null);
      setSelectedPrescriptionMedicine(null);
      setPrescriptionOcrError(null);
      setPrescriptionQrScannerVisible(false);
      setPrescriptionQrScanned(false);
      setPrescriptionQrRaw(null);
      setPrescriptionQrSampleText("");
      setPrescriptionMedicineDrafts([]);
      setPrescriptionDurWarnings({});
      setPrescriptionDurMessage(null);
    }
  };

  const closeRegistrationModal = () => {
    setRegistrationModalVisible(false);
    setSelectedSearchMedicine(null);
    setPrescriptionOcrResult(null);
    setSelectedPrescriptionMedicine(null);
    setPrescriptionOcrError(null);
    setPrescriptionQrScannerVisible(false);
    setPrescriptionQrScanned(false);
    setPrescriptionQrRaw(null);
    setPrescriptionQrSampleText("");
    setPrescriptionMedicineDrafts([]);
    setPrescriptionDurWarnings({});
    setPrescriptionDurMessage(null);
    setMedicineSearchResults([]);
    setMedicineSearchQuery("");
    setScheduleDraft(defaultScheduleDraft());
    setActiveStep("input");
    setRegistrationError(null);
  };

  const runMedicineSearch = async () => {
    const query = medicineSearchQuery.trim();
    if (!query) {
      setMedicineSearchError("검색할 약명, 성분명 또는 식별문자를 입력해 주세요.");
      return;
    }
    setMedicineSearchLoading(true);
    setMedicineSearchError(null);
    setSelectedSearchMedicine(null);
    try {
      const results = await searchMedicines(query);
      setMedicineSearchResults(results);
      if (!results.length) {
        setMedicineSearchError("검색 결과가 없습니다. 약명이나 성분명을 조금 더 넓게 입력해 보세요.");
      }
    } catch {
      setMedicineSearchError("e약은 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setMedicineSearchResults([]);
    } finally {
      setMedicineSearchLoading(false);
    }
  };

  const selectMedicineSearchResult = (medicine: MedicineSearchResult) => {
    setSelectedSearchMedicine(medicine);
    setRegistrationError(null);
    const initialDurWarnings = medicine.durWarnings ?? [];
    setDraft((current) => ({
      ...current,
      name: medicine.productName ?? medicine.name,
      manufacturer: medicine.manufacturer ?? current.manufacturer,
      ingredient: medicine.ingredient ?? current.ingredient,
      dosage: medicine.dosage ?? current.dosage,
      form: medicine.form ?? current.form,
      color: medicine.color ?? current.color,
      purpose: medicine.efficacy ?? current.purpose,
      memo: [medicine.usage, medicine.caution, medicine.interaction, medicine.sideEffects, medicine.storageMethod].filter(Boolean).join("\n\n") || current.memo,
      durWarnings: initialDurWarnings
    }));
    refreshDurWarnings(medicine.productName ?? medicine.name);
    setActiveStep("confirm");
  };

  const refreshDurWarnings = async (query: string) => {
    if (!query.trim()) return;
    setDurLoading(true);
    setDurMessage(null);
    try {
      const result = await searchDurSafety(query.trim());
      setDraft((current) => ({ ...current, durWarnings: result.warnings }));
      if (result.message) setDurMessage(result.message);
      if (!result.warnings.length && result.source === "public-data") {
        setDurMessage("DUR 주의 정보가 조회되지 않았습니다.");
      }
    } catch {
      setDurMessage("DUR 정보를 불러오지 못했습니다. 저장 후 전문가 확인을 권장합니다.");
    } finally {
      setDurLoading(false);
    }
  };

  const runPrescriptionOcr = async (source: "camera" | "library") => {
    setPrescriptionOcrLoading(true);
    setPrescriptionOcrError(null);
    setPrescriptionQrScannerVisible(false);
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPrescriptionOcrError(source === "camera" ? "카메라 권한이 필요합니다." : "사진첩 접근 권한이 필요합니다.");
        return;
      }
      const pickerResult = source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsEditing: false, mediaTypes: ["images"] });
      if (pickerResult.canceled || !pickerResult.assets[0]?.uri) {
        return;
      }
      const result = await uploadPrescriptionOcr(pickerResult.assets[0].uri);
      applyPrescriptionResult(result);
      if (result.message) {
        setPrescriptionOcrError(result.message);
      }
    } catch {
      setPrescriptionOcrError("처방전 OCR을 처리하지 못했습니다. 잠시 후 다시 시도하거나 직접 입력해 주세요.");
    } finally {
      setPrescriptionOcrLoading(false);
    }
  };

  const runPrescriptionQrScan = async () => {
    setPrescriptionOcrError(null);
    const permission = await Camera.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPrescriptionOcrError("카메라 권한이 필요합니다.");
      return;
    }
    setPrescriptionQrRaw(null);
    setPrescriptionQrScanned(false);
    setPrescriptionQrScannerVisible(true);
  };

  const handlePrescriptionQrScanned = (result: BarcodeScanningResult) => {
    if (prescriptionQrScanned) return;
    setPrescriptionQrScanned(true);
    setPrescriptionQrScannerVisible(false);
    applyPrescriptionQrPayload(result.data);
  };

  const applyPrescriptionQrPayload = (payload: string) => {
    const value = payload.trim();
    if (!value) {
      setPrescriptionOcrError("QR 원문 또는 샘플 문자열을 입력해 주세요.");
      return;
    }
    setPrescriptionQrRaw(value);
    try {
      const parsed = parsePrescriptionQrPayload(value);
      applyPrescriptionResult(parsed);
      setPrescriptionOcrError(parsed.message ?? null);
    } catch {
      setPrescriptionOcrError("QR 내용을 약 정보로 해석하지 못했습니다. OCR 또는 직접 입력으로 등록해 주세요.");
    }
  };

  const applyPrescriptionQrSample = () => {
    applyPrescriptionQrPayload(prescriptionQrSampleText);
  };

  const fillPrescriptionQrSample = () => {
    setPrescriptionQrSampleText(prescriptionQrSamplePayload);
    setPrescriptionOcrError(null);
  };

  const applyPrescriptionResult = (result: PrescriptionOcrResult) => {
    setPrescriptionOcrResult(result);
    const drafts = result.medicines.map((medicine, index) => ({
      ...medicine,
      localId: `${medicine.name || "medicine"}-${index}-${Date.now()}`,
      selected: true
    }));
    setPrescriptionMedicineDrafts(drafts);
    analyzePrescriptionDurWarnings(drafts);
    if (drafts[0]) {
      applyPrescriptionMedicine(drafts[0]);
    }
  };

  const analyzePrescriptionDurWarnings = async (drafts: PrescriptionMedicineDraft[]) => {
    if (!drafts.length) {
      setPrescriptionDurWarnings({});
      setPrescriptionDurMessage(null);
      return;
    }
    setPrescriptionDurLoading(true);
    setPrescriptionDurMessage(null);
    const activeMedicines = medicines.filter((medicine) => medicine.status !== "ended");
    const normalizedCounts = drafts.reduce<Record<string, number>>((acc, medicine) => {
      const key = normalizeMedicineText(medicine.name);
      if (key) acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const nextWarnings: Record<string, string[]> = {};

    await Promise.all(drafts.map(async (medicine) => {
      const normalizedName = normalizeMedicineText(medicine.name);
      const warnings = [
        ...buildExistingMedicineWarnings(medicine.name, undefined, activeMedicines),
        ...(normalizedName && normalizedCounts[normalizedName] > 1 ? ["이번 처방전 안에 같은 약명이 중복되어 있습니다. 실제 중복 처방인지 약사에게 확인하세요."] : [])
      ];
      try {
        const durResult = await searchDurSafety(medicine.name);
        warnings.push(...durResult.warnings);
      } catch {
        warnings.push("DUR API 조회에 실패했습니다. 저장 후 약사에게 병용금기와 중복성분 여부를 확인하세요.");
      }
      nextWarnings[medicine.localId] = uniqueWarnings(warnings);
    }));

    setPrescriptionDurWarnings(nextWarnings);
    setPrescriptionDurMessage("처방전 후보 약 기준으로 DUR과 중복 가능성을 확인했습니다.");
    setPrescriptionDurLoading(false);
  };

  const updatePrescriptionMedicineDraft = (localId: string, patch: Partial<PrescriptionOcrMedicine>) => {
    setPrescriptionMedicineDrafts((current) =>
      current.map((medicine) => medicine.localId === localId ? { ...medicine, ...patch } : medicine)
    );
    setPrescriptionDurMessage("약 정보를 수정했습니다. 저장 전 DUR 재확인을 권장합니다.");
  };

  const togglePrescriptionMedicineDraft = (localId: string) => {
    setPrescriptionMedicineDrafts((current) =>
      current.map((medicine) => medicine.localId === localId ? { ...medicine, selected: !medicine.selected } : medicine)
    );
  };

  const applyPrescriptionMedicine = (medicine: PrescriptionOcrMedicine) => {
    setSelectedPrescriptionMedicine(medicine);
    setRegistrationError(null);
    setDraft((current) => ({
      ...current,
      name: medicine.name,
      dosage: medicine.dosage ?? current.dosage,
      form: medicine.form ?? current.form,
      purpose: medicine.purpose ?? current.purpose,
      memo: [medicine.usage, medicine.memo].filter(Boolean).join("\n\n") || current.memo
    }));
    refreshDurWarnings(medicine.name);
    setScheduleDraft((current) => ({
      ...current,
      timesPerDay: medicine.timesPerDay ?? current.timesPerDay,
      doseTimes: medicine.doseTimes.length ? medicine.doseTimes : current.doseTimes,
      durationDays: medicine.durationDays ? String(medicine.durationDays) : current.durationDays,
      doseTiming: medicine.timing ?? current.doseTiming,
      repeatRule: medicine.timesPerDay === 0 ? "as_needed" : current.repeatRule
    }));
  };

  const proceedRegistrationStep = () => {
    if (selectedMethod === "search" && activeStep === "input") {
      if (!selectedSearchMedicine) {
        setMedicineSearchError("검색 결과에서 등록할 약을 먼저 선택해 주세요.");
        return;
      }
      setActiveStep("confirm");
      return;
    }
    if (activeStep === "input") {
      if (!draft.name.trim()) {
        setRegistrationError("약명은 필수입니다.");
        return;
      }
      setRegistrationError(null);
      refreshDurWarnings(draft.name);
      setActiveStep("confirm");
      return;
    }
    if (activeStep === "confirm") {
      setActiveStep("schedule");
      return;
    }
    saveDraftMedicine({ withSchedule: true });
  };

  const changeRegistrationStep = (step: RegisterStep) => {
    if (step !== "input" && activeStep === "input") {
      if (selectedMethod === "search" && !selectedSearchMedicine) {
        setMedicineSearchError("검색 결과에서 등록할 약을 먼저 선택해 주세요.");
        return;
      }
      if (selectedMethod !== "search" && !draft.name.trim()) {
        setRegistrationError("약명은 필수입니다.");
        return;
      }
    }
    setRegistrationError(null);
    setActiveStep(step);
  };

  const persistMedicine = async (medicine: RegisteredMedicine) => {
    if (isMember && session?.userId && !medicine.id.startsWith("local-")) {
      await updateRegisteredMedicine(session.userId, medicine).catch(() => updateLocalRegisteredMedicine(medicine));
    } else {
      await updateLocalRegisteredMedicine(medicine);
    }
    await loadMedicines();
  };

  const toggleFavorite = async (medicineId: string) => {
    const medicine = medicines.find((item) => item.id === medicineId);
    if (!medicine) return;
    await persistMedicine({ ...medicine, favorite: !medicine.favorite });
  };

  const endMedicine = async (medicineId: string) => {
    const medicine = medicines.find((item) => item.id === medicineId);
    if (!medicine) return;
    await persistMedicine({ ...medicine, status: "ended" });
    setMessage("삭제 대신 복용종료로 처리했습니다. 연결된 스케줄과 이력은 보존됩니다.");
  };

  const saveSelectedPrescriptionMedicines = async (options?: { withSchedule?: boolean }) => {
    const selectedDrafts = prescriptionMedicineDrafts.filter((medicine) => medicine.selected && medicine.name.trim());
    if (!selectedDrafts.length) {
      setPrescriptionOcrError("등록할 약을 하나 이상 선택해 주세요.");
      return;
    }
    for (const medicineDraft of selectedDrafts) {
      const doseTimes = medicineDraft.doseTimes.length ? medicineDraft.doseTimes : scheduleDraft.doseTimes;
      const durationDays = medicineDraft.durationDays ? String(medicineDraft.durationDays) : scheduleDraft.durationDays;
      const scheduleForMedicine = {
        ...scheduleDraft,
        timesPerDay: medicineDraft.timesPerDay ?? scheduleDraft.timesPerDay,
      doseTimes,
      durationDays,
      doseTiming: medicineDraft.timing ?? scheduleDraft.doseTiming
      };
      const baseMedicine: RegisteredMedicine = {
        id: `local-medicine-${Date.now()}-${medicineDraft.localId}`,
        userId: session?.userId,
        profileId: selectedProfile?.profileId,
        profileName: selectedProfile?.profileName,
        name: medicineDraft.name.trim(),
        alias: "",
        productName: medicineDraft.name.trim(),
        dosage: medicineDraft.dosage,
        form: medicineDraft.form,
        purpose: medicineDraft.purpose,
        timing: scheduleForMedicine.doseTiming,
        takingMethod: scheduleForMedicine.doseMethod,
        schedule: options?.withSchedule ? formatScheduleSummary(scheduleForMedicine) : undefined,
        memo: [medicineDraft.usage, medicineDraft.memo].filter(Boolean).join("\n\n"),
        durWarnings: prescriptionDurWarnings[medicineDraft.localId] ?? [],
        status: options?.withSchedule ? "taking" : "scheduled",
        source: "prescription",
        favorite: false,
        highRisk: Boolean(prescriptionDurWarnings[medicineDraft.localId]?.length),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const savedMedicine = isMember && session?.userId
        ? await createRegisteredMedicine(session.userId, baseMedicine).catch(async () => (await saveLocalRegisteredMedicine(baseMedicine))[0])
        : (await saveLocalRegisteredMedicine(baseMedicine))[0];
      if (options?.withSchedule) {
        await saveScheduleForMedicineWithDraft(savedMedicine, scheduleForMedicine);
      }
    }
    await loadMedicines();
    setMessage(`${selectedDrafts.length}개 약을 처방전 결과에서 등록했습니다.`);
    setRegistrationModalVisible(false);
    setPrescriptionMedicineDrafts([]);
    setPrescriptionDurWarnings({});
    setPrescriptionDurMessage(null);
    setPrescriptionOcrResult(null);
    setSelectedPrescriptionMedicine(null);
  };

  const saveDraftMedicine = async (options?: { withSchedule?: boolean }) => {
    const withSchedule = options?.withSchedule ?? activeStep === "schedule";
    const name = draft.name.trim();
    if (!name) {
      setRegistrationError("약명은 필수입니다.");
      setMessage("약명은 필수입니다.");
      setActiveStep("input");
      return;
    }
    const safetyWarnings = uniqueWarnings([
      ...buildExistingMedicineWarnings(name, draft.ingredient, medicines.filter((medicine) => medicine.status !== "ended")),
      ...draft.durWarnings
    ]);
    const baseMedicine: RegisteredMedicine = {
      id: `local-medicine-${Date.now()}`,
      userId: session?.userId,
      profileId: selectedProfile?.profileId,
      profileName: selectedProfile?.profileName,
      name,
      alias: draft.alias,
      productName: name,
      ingredient: draft.ingredient,
      manufacturer: draft.manufacturer,
      dosage: draft.dosage,
      form: draft.form,
      color: draft.color,
      purpose: draft.purpose,
      timing: scheduleDraft.doseTiming,
      takingMethod: scheduleDraft.doseMethod,
      schedule: withSchedule ? formatScheduleSummary(scheduleDraft) : undefined,
      memo: draft.memo,
      durWarnings: safetyWarnings,
      status: withSchedule ? "taking" : "scheduled",
      source: selectedMethod,
      favorite: false,
      highRisk: Boolean(safetyWarnings.length),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const savedMedicine = isMember && session?.userId
      ? await createRegisteredMedicine(session.userId, baseMedicine).catch(async () => {
          const localList = await saveLocalRegisteredMedicine(baseMedicine);
          return localList[0];
        })
      : (await saveLocalRegisteredMedicine(baseMedicine))[0];

    if (withSchedule) {
      await saveScheduleForMedicine(savedMedicine);
    }
    await loadMedicines();
    setMessage(safetyWarnings.length ? "약을 저장했습니다. DUR 또는 중복 가능성 주의가 있어 복용 전 전문가 확인을 권장합니다." : "약을 저장했습니다. 오늘 복약 목록 보기 또는 약 추가 등록을 선택할 수 있습니다.");
    setDraft({ name: "", alias: "", manufacturer: "", ingredient: "", dosage: "1정", form: "정제", color: "", purpose: "", memo: "", durWarnings: [] });
    setScheduleDraft(defaultScheduleDraft());
    setSelectedSearchMedicine(null);
    setPrescriptionOcrResult(null);
    setSelectedPrescriptionMedicine(null);
    setPrescriptionOcrError(null);
    setMedicineSearchResults([]);
    setMedicineSearchQuery("");
    setActiveStep("input");
    setRegistrationModalVisible(false);
  };

  const saveScheduleForMedicine = async (medicine: RegisteredMedicine) => {
    await saveScheduleForMedicineWithDraft(medicine, scheduleDraft);
  };

  const saveScheduleForMedicineWithDraft = async (medicine: RegisteredMedicine, nextScheduleDraft: ScheduleDraftState) => {
    const durationDays = Number(nextScheduleDraft.durationDays);
    const schedule: MedicineSchedule = {
      id: `local-schedule-${Date.now()}`,
      medicineId: medicine.id,
      profileId: selectedProfile?.profileId,
      doseAmount: medicine.dosage ?? "1정",
      doseMethod: nextScheduleDraft.doseMethod,
      doseTiming: nextScheduleDraft.doseTiming,
      purpose: medicine.purpose,
      timesPerDay: nextScheduleDraft.timesPerDay,
      doseTimes: nextScheduleDraft.doseTimes,
      startDate: nextScheduleDraft.startDate,
      endDate: nextScheduleDraft.endDate || (Number.isFinite(durationDays) && durationDays > 0 ? calculateEndDate(nextScheduleDraft.startDate, durationDays) : null),
      durationDays: Number.isFinite(durationDays) && durationDays > 0 ? durationDays : null,
      repeatRule: nextScheduleDraft.repeatRule,
      weekdays: nextScheduleDraft.weekdays,
      weekInterval: parseOptionalNumber(nextScheduleDraft.weekInterval),
      monthlyMode: nextScheduleDraft.monthlyMode,
      monthDays: nextScheduleDraft.monthDays,
      monthlyWeekOrdinal: parseOptionalNumber(nextScheduleDraft.monthlyWeekOrdinal),
      monthlyWeekday: parseOptionalNumber(nextScheduleDraft.monthlyWeekday),
      missingDatePolicy: nextScheduleDraft.missingDatePolicy,
      intervalHours: parseOptionalNumber(nextScheduleDraft.intervalHours),
      intervalDays: parseOptionalNumber(nextScheduleDraft.intervalDays),
      cycleActiveDays: parseOptionalNumber(nextScheduleDraft.cycleActiveDays),
      cycleRestDays: parseOptionalNumber(nextScheduleDraft.cycleRestDays),
      maxDailyNotifications: parseOptionalNumber(nextScheduleDraft.maxDailyNotifications),
      relationOffsetMinutes: parseOptionalNumber(nextScheduleDraft.relationOffsetMinutes),
      reminderEnabled: nextScheduleDraft.reminderEnabled,
      reminderIntervalMinutes: parseOptionalNumber(nextScheduleDraft.reminderIntervalMinutes),
      reminderMaxCount: parseOptionalNumber(nextScheduleDraft.reminderMaxCount),
      guardianAlertEnabled: nextScheduleDraft.guardianAlertEnabled,
      guardianAlertDelayMinutes: parseOptionalNumber(nextScheduleDraft.guardianAlertDelayMinutes),
      paused: nextScheduleDraft.paused,
      pauseReason: null,
      notifyEnabled: nextScheduleDraft.notifyEnabled,
      notificationLevel: nextScheduleDraft.notificationLevel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (isMember && session?.userId && !medicine.id.startsWith("local-")) {
      await createMedicineSchedule(schedule).catch(() => saveLocalMedicineSchedule(schedule));
    } else {
      await saveLocalMedicineSchedule(schedule);
    }
    await rescheduleLocalMedicationNotifications(selectedProfile);
  };

  const recordDose = async (medicine: RegisteredMedicine, status: MedicationEvent["status"]) => {
    const event: MedicationEvent = {
      id: `local-dose-${Date.now()}`,
      medicineId: medicine.id,
      scheduleId: null,
      profileId: selectedProfile?.profileId,
      scheduledAt: new Date().toISOString(),
      status,
      takenAt: status === "taken" ? new Date().toISOString() : null,
      sharedWithGuardian: false,
      memo: medicine.highRisk ? "중요 약 복약 상태 확인 필요" : undefined
    };
    if (isMember && session?.userId && !medicine.id.startsWith("local-")) {
      await createMedicationEvent(event).catch(() => saveLocalMedicationEvent(event));
    } else {
      await saveLocalMedicationEvent(event);
    }
    setMessage(status === "taken" ? "복약 완료를 기록했습니다." : "이번 회차를 건너뜀으로 기록했습니다.");
  };

  const toggleDurCompareMode = () => {
    setDurCompareMode((current) => {
      const next = !current;
      if (!next) {
        setDurCompareSelectedIds([]);
        setDurCompareMessage(null);
      }
      return next;
    });
  };

  const toggleDurCompareMedicine = (medicineId: string) => {
    setDurCompareSelectedIds((current) =>
      current.includes(medicineId) ? current.filter((id) => id !== medicineId) : [...current, medicineId]
    );
  };

  const runDurCompare = async () => {
    const selectedMedicines = medicines.filter((medicine) => durCompareSelectedIds.includes(medicine.id));
    if (selectedMedicines.length < 2) {
      setDurCompareMessage("DUR 비교는 약을 2개 이상 선택해 주세요.");
      return;
    }
    setDurCompareLoading(true);
    setDurCompareMessage(null);
    const results: DurCompareResult[] = [];

    selectedMedicines.forEach((medicine) => {
      medicine.durWarnings?.forEach((warning, index) => {
        results.push({
          id: `saved-${medicine.id}-${index}`,
          severity: "warning",
          title: "기존 DUR 주의",
          description: warning,
          medicineNames: [medicine.alias || medicine.name]
        });
      });
    });

    selectedMedicines.forEach((medicine, index) => {
      selectedMedicines.slice(index + 1).forEach((other) => {
        if (normalizeMedicineText(medicine.name) && normalizeMedicineText(medicine.name) === normalizeMedicineText(other.name)) {
          results.push({
            id: `same-name-${medicine.id}-${other.id}`,
            severity: "danger",
            title: "같은 약명 중복 가능성",
            description: "같은 약이 중복 등록되어 있을 수 있습니다. 실제 중복 복용인지 약사에게 확인하세요.",
            medicineNames: [medicine.alias || medicine.name, other.alias || other.name]
          });
        }
        if (normalizeMedicineText(medicine.ingredient) && normalizeMedicineText(medicine.ingredient) === normalizeMedicineText(other.ingredient)) {
          results.push({
            id: `same-ingredient-${medicine.id}-${other.id}`,
            severity: "danger",
            title: "중복성분 가능성",
            description: "성분명이 같은 약이 함께 선택되었습니다. 용량 초과나 중복 복용 여부를 확인하세요.",
            medicineNames: [medicine.alias || medicine.name, other.alias || other.name]
          });
        }
      });
    });

    await Promise.all(selectedMedicines.map(async (medicine) => {
      try {
        const durResult = await searchDurSafety(medicine.productName || medicine.name);
        durResult.warnings.forEach((warning, index) => {
          results.push({
            id: `api-${medicine.id}-${index}`,
            severity: "warning",
            title: "DUR API 주의",
            description: warning,
            medicineNames: [medicine.alias || medicine.name]
          });
        });
      } catch {
        results.push({
          id: `api-failed-${medicine.id}`,
          severity: "warning",
          title: "DUR API 확인 실패",
          description: "DUR API 조회가 실패했습니다. 선택한 약의 병용금기와 중복성분은 약사에게 확인하세요.",
          medicineNames: [medicine.alias || medicine.name]
        });
      }
    }));

    if (!results.length) {
      results.push({
        id: "no-warning",
        severity: "safe",
        title: "현재 비교 항목에서 확인된 주의 없음",
        description: "등록된 이름과 성분 기준으로는 중복 가능성이 낮습니다. 실제 복용 판단은 의사 또는 약사 확인을 권장합니다.",
        medicineNames: selectedMedicines.map((medicine) => medicine.alias || medicine.name)
      });
    }

    setDurCompareResults(results);
    setDurCompareModalVisible(true);
    setDurCompareLoading(false);
  };

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="archive-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.heroTitleGroup}>
            <Text style={styles.eyebrow}>내 약통</Text>
            <Text style={styles.title}>약관리</Text>
          </View>
          <MenuHelpButton content={menuHelp.pills} />
        </View>
        <Text style={styles.description}>직접등록, 검색등록, 처방전등록, AI판독등록으로 약을 등록하고 복약 스케줄까지 이어서 설정합니다.</Text>
      </View>

      <View style={styles.notice}>
        <MaterialCommunityIcons name="alert-circle-outline" size={22} color={noticeText} />
        <Text style={styles.noticeText}>
          OCR과 AI 판독 결과는 자동 저장하지 않습니다. 사용자가 후보와 상세 정보를 최종 확인한 뒤 저장하며, DUR 위험 정보는 쉬운 설명으로 표시합니다.
        </Text>
      </View>

      <CurrentFamilyBanner compact />

      <View style={styles.segmented}>
        <SegmentButton label="약관리" active={activeTab === "medicine"} onPress={() => setActiveTab("medicine")} />
        <SegmentButton label="처방전 관리" active={activeTab === "prescription"} onPress={() => setActiveTab("prescription")} />
      </View>

      <View style={styles.actionGrid}>
        {registrationMethods.map((method) => (
          <RegistrationTile
            key={method.key}
            title={method.title}
            description={method.description}
            icon={method.icon}
            active={selectedMethod === method.key}
            onPress={() => openRegistrationModal(method.key)}
          />
        ))}
      </View>

      <View style={styles.todayCard}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>오늘 복약 목록</Text>
            <Text style={styles.body}>시간대별로 완료, 건너뜀, 지연 상태를 기록합니다.</Text>
          </View>
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>복약 기록</Text>
          </View>
        </View>
        {medicines.filter((medicine) => medicine.status !== "ended").map((medicine) => (
          <TodayDoseRow key={medicine.id} medicine={medicine} onTaken={() => recordDose(medicine, "taken")} onSkipped={() => recordDose(medicine, "skipped")} />
        ))}
      </View>

      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>등록된 약 목록</Text>
            <Text style={styles.meta}>{durCompareMode ? `${durCompareSelectedIds.length}개 선택됨` : "여러 약을 선택해 DUR을 비교할 수 있습니다."}</Text>
          </View>
          <Pressable style={durCompareMode ? styles.primaryButton : styles.secondaryButton} onPress={toggleDurCompareMode}>
            <MaterialCommunityIcons name="shield-search" size={18} color={durCompareMode ? "#FFFFFF" : colors.primary} />
            <Text style={durCompareMode ? styles.primaryButtonText : styles.secondaryButtonText}>{durCompareMode ? "비교 종료" : "DUR 비교"}</Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="약명, 성분명, 복용 목적 검색"
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterRow}>
          {listFilters.map((filter) => (
            <Pressable key={filter} onPress={() => setListFilter(filter)} style={[styles.filterChip, listFilter === filter && styles.filterChipActive]}>
              <Text style={[styles.filterText, listFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          ))}
        </View>

        {durCompareMode ? (
          <View style={styles.compareActionBox}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>비교할 약 선택</Text>
              <Text style={styles.meta}>복용중이거나 새로 등록한 약을 2개 이상 선택해 중복성분과 DUR 주의를 확인합니다.</Text>
              {durCompareMessage ? <Text style={styles.dangerText}>{durCompareMessage}</Text> : null}
            </View>
            <Pressable style={styles.primaryButton} onPress={runDurCompare} disabled={durCompareLoading}>
              {durCompareLoading ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="compare-horizontal" size={18} color="#FFFFFF" />}
              <Text style={styles.primaryButtonText}>{durCompareLoading ? "비교 중" : "비교하기"}</Text>
            </Pressable>
          </View>
        ) : null}

        {filteredMedicines.length ? filteredMedicines.map((medicine) => (
          <MedicineListItem
            key={medicine.id}
            medicine={medicine}
            compareMode={durCompareMode}
            selectedForCompare={durCompareSelectedIds.includes(medicine.id)}
            onToggleCompare={() => toggleDurCompareMedicine(medicine.id)}
            onToggleFavorite={() => toggleFavorite(medicine.id)}
            onEnd={() => endMedicine(medicine.id)}
          />
        )) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>조건에 맞는 약이 없습니다.</Text>
            <Text style={styles.emptyDescription}>검색어를 지우거나 전체 목록을 확인해 보세요.</Text>
          </View>
        )}
      </View>

      <MedicineRegistrationModal
        visible={registrationModalVisible}
        method={selectedMethod}
        methodTitle={selectedMethodMeta.title}
        activeStep={activeStep}
        draft={draft}
        pills={pills}
        searchQuery={medicineSearchQuery}
        searchResults={medicineSearchResults}
        selectedSearchMedicine={selectedSearchMedicine}
        searchLoading={medicineSearchLoading}
        searchError={medicineSearchError}
        prescriptionOcrResult={prescriptionOcrResult}
        selectedPrescriptionMedicine={selectedPrescriptionMedicine}
        prescriptionOcrLoading={prescriptionOcrLoading}
        prescriptionOcrError={prescriptionOcrError}
        prescriptionQrScannerVisible={prescriptionQrScannerVisible}
        prescriptionQrRaw={prescriptionQrRaw}
        prescriptionQrSampleText={prescriptionQrSampleText}
        prescriptionMedicineDrafts={prescriptionMedicineDrafts}
        prescriptionDurWarnings={prescriptionDurWarnings}
        prescriptionDurLoading={prescriptionDurLoading}
        prescriptionDurMessage={prescriptionDurMessage}
        durLoading={durLoading}
        durMessage={durMessage}
        validationError={registrationError}
        scheduleDraft={scheduleDraft}
        onClose={closeRegistrationModal}
        onStepChange={changeRegistrationStep}
        onDraftChange={(patch) => {
          setDraft((current) => ({ ...current, ...patch }));
          if (patch.name?.trim()) {
            setRegistrationError(null);
          }
        }}
        onSearchQueryChange={setMedicineSearchQuery}
        onSearch={runMedicineSearch}
        onSelectSearchResult={selectMedicineSearchResult}
        onPrescriptionOcr={runPrescriptionOcr}
        onPrescriptionQrScan={runPrescriptionQrScan}
        onPrescriptionQrScanned={handlePrescriptionQrScanned}
        onCancelPrescriptionQrScan={() => setPrescriptionQrScannerVisible(false)}
        onPrescriptionQrSampleTextChange={setPrescriptionQrSampleText}
        onApplyPrescriptionQrSample={applyPrescriptionQrSample}
        onFillPrescriptionQrSample={fillPrescriptionQrSample}
        onSelectPrescriptionMedicine={applyPrescriptionMedicine}
        onUpdatePrescriptionMedicine={updatePrescriptionMedicineDraft}
        onTogglePrescriptionMedicine={togglePrescriptionMedicineDraft}
        onSaveSelectedPrescriptionMedicines={saveSelectedPrescriptionMedicines}
        onAnalyzePrescriptionDur={() => analyzePrescriptionDurWarnings(prescriptionMedicineDrafts)}
        onScheduleDraftChange={(patch) => setScheduleDraft((current) => ({ ...current, ...patch }))}
        onNext={proceedRegistrationStep}
        onSaveMedicineOnly={() => saveDraftMedicine({ withSchedule: false })}
      />

      <DurCompareModal
        visible={durCompareModalVisible}
        selectedMedicines={medicines.filter((medicine) => durCompareSelectedIds.includes(medicine.id))}
        results={durCompareResults}
        onClose={() => setDurCompareModalVisible(false)}
      />

      {message ? <Text style={styles.successNotice}>{message}</Text> : null}
    </AppScreen>
  );
}

function MedicineRegistrationModal({
  visible,
  method,
  methodTitle,
  activeStep,
  draft,
  pills,
  searchQuery,
  searchResults,
  selectedSearchMedicine,
  searchLoading,
  searchError,
  prescriptionOcrResult,
  selectedPrescriptionMedicine,
  prescriptionOcrLoading,
  prescriptionOcrError,
  prescriptionQrScannerVisible,
  prescriptionQrRaw,
  prescriptionQrSampleText,
  prescriptionMedicineDrafts,
  prescriptionDurWarnings,
  prescriptionDurLoading,
  prescriptionDurMessage,
  durLoading,
  durMessage,
  validationError,
  scheduleDraft,
  onClose,
  onStepChange,
  onDraftChange,
  onSearchQueryChange,
  onSearch,
  onSelectSearchResult,
  onPrescriptionOcr,
  onPrescriptionQrScan,
  onPrescriptionQrScanned,
  onCancelPrescriptionQrScan,
  onPrescriptionQrSampleTextChange,
  onApplyPrescriptionQrSample,
  onFillPrescriptionQrSample,
  onSelectPrescriptionMedicine,
  onUpdatePrescriptionMedicine,
  onTogglePrescriptionMedicine,
  onSaveSelectedPrescriptionMedicines,
  onAnalyzePrescriptionDur,
  onScheduleDraftChange,
  onNext,
  onSaveMedicineOnly
}: {
  visible: boolean;
  method: RegisterMethod;
  methodTitle: string;
  activeStep: RegisterStep;
  draft: MedicineDraft;
  pills: Pill[];
  searchQuery: string;
  searchResults: MedicineSearchResult[];
  selectedSearchMedicine: MedicineSearchResult | null;
  searchLoading: boolean;
  searchError: string | null;
  prescriptionOcrResult: PrescriptionOcrResult | null;
  selectedPrescriptionMedicine: PrescriptionOcrMedicine | null;
  prescriptionOcrLoading: boolean;
  prescriptionOcrError: string | null;
  prescriptionQrScannerVisible: boolean;
  prescriptionQrRaw: string | null;
  prescriptionQrSampleText: string;
  prescriptionMedicineDrafts: PrescriptionMedicineDraft[];
  prescriptionDurWarnings: Record<string, string[]>;
  prescriptionDurLoading: boolean;
  prescriptionDurMessage: string | null;
  durLoading: boolean;
  durMessage: string | null;
  validationError: string | null;
  scheduleDraft: ScheduleDraftState;
  onClose: () => void;
  onStepChange: (step: RegisterStep) => void;
  onDraftChange: (patch: Partial<MedicineDraft>) => void;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelectSearchResult: (medicine: MedicineSearchResult) => void;
  onPrescriptionOcr: (source: "camera" | "library") => void;
  onPrescriptionQrScan: () => void;
  onPrescriptionQrScanned: (result: BarcodeScanningResult) => void;
  onCancelPrescriptionQrScan: () => void;
  onPrescriptionQrSampleTextChange: (value: string) => void;
  onApplyPrescriptionQrSample: () => void;
  onFillPrescriptionQrSample: () => void;
  onSelectPrescriptionMedicine: (medicine: PrescriptionOcrMedicine) => void;
  onUpdatePrescriptionMedicine: (localId: string, patch: Partial<PrescriptionOcrMedicine>) => void;
  onTogglePrescriptionMedicine: (localId: string) => void;
  onSaveSelectedPrescriptionMedicines: (options?: { withSchedule?: boolean }) => void;
  onAnalyzePrescriptionDur: () => void;
  onScheduleDraftChange: (patch: Partial<ScheduleDraftState>) => void;
  onNext: () => void;
  onSaveMedicineOnly: () => void;
}) {
  const nextLabel = activeStep === "schedule" ? "약 저장" : activeStep === "confirm" ? "스케줄 등록" : activeStep === "input" && method === "search" ? "선택 후 다음" : "다음 단계";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>약 등록 절차</Text>
              <Text style={styles.body}>{methodTitle} 방식으로 약 정보 확인 후 복약 스케줄까지 설정합니다.</Text>
            </View>
            <Pressable style={styles.iconAction} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.stepRow}>
            <StepPill label="1 입력/검색" active={activeStep === "input"} onPress={() => onStepChange("input")} />
            <StepPill label="2 상세 정보" active={activeStep === "confirm"} onPress={() => onStepChange("confirm")} />
            <StepPill label="3 스케줄" active={activeStep === "schedule"} onPress={() => onStepChange("schedule")} />
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {activeStep === "input" && method === "search" ? (
              <SearchRegistrationStep
                query={searchQuery}
                results={searchResults}
                selected={selectedSearchMedicine}
                loading={searchLoading}
                error={searchError}
                onQueryChange={onSearchQueryChange}
                onSearch={onSearch}
                onSelect={onSelectSearchResult}
              />
            ) : null}

            {activeStep === "input" && method !== "search" ? (
              <>
                {method === "prescription" ? (
                  <PrescriptionOcrStep
                    result={prescriptionOcrResult}
                    selected={selectedPrescriptionMedicine}
                    loading={prescriptionOcrLoading}
                    error={prescriptionOcrError}
                    qrScannerVisible={prescriptionQrScannerVisible}
                    qrRaw={prescriptionQrRaw}
                    qrSampleText={prescriptionQrSampleText}
                    medicineDrafts={prescriptionMedicineDrafts}
                    durWarningsByMedicine={prescriptionDurWarnings}
                    durLoading={prescriptionDurLoading}
                    durMessage={prescriptionDurMessage}
                    onRunOcr={onPrescriptionOcr}
                    onRunQrScan={onPrescriptionQrScan}
                    onQrScanned={onPrescriptionQrScanned}
                    onCancelQrScan={onCancelPrescriptionQrScan}
                    onQrSampleTextChange={onPrescriptionQrSampleTextChange}
                    onApplyQrSample={onApplyPrescriptionQrSample}
                    onFillQrSample={onFillPrescriptionQrSample}
                    onSelect={onSelectPrescriptionMedicine}
                    onUpdateMedicine={onUpdatePrescriptionMedicine}
                    onToggleMedicine={onTogglePrescriptionMedicine}
                    onSaveSelected={onSaveSelectedPrescriptionMedicines}
                    onAnalyzeDur={onAnalyzePrescriptionDur}
                  />
                ) : null}
                {method !== "prescription" ? <RegistrationInput method={method} draft={draft} onChange={onDraftChange} /> : null}
                {validationError ? <Text style={styles.validationText}>{validationError}</Text> : null}
              </>
            ) : null}

            {activeStep === "confirm" ? (
              <>
                <CandidateConfirmation method={method} pills={pills} draftName={draft.name} selectedMedicine={selectedSearchMedicine} prescriptionMedicine={selectedPrescriptionMedicine} ocrResult={prescriptionOcrResult} durWarnings={draft.durWarnings} durLoading={durLoading} durMessage={durMessage} />
                <RegistrationInput method={method} draft={draft} onChange={onDraftChange} />
              </>
            ) : null}

            {activeStep === "schedule" ? <ScheduleDraft schedule={scheduleDraft} onChange={onScheduleDraftChange} /> : null}
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable style={styles.primaryButton} onPress={onNext}>
              <MaterialCommunityIcons name={activeStep === "schedule" ? "content-save-outline" : "arrow-right"} size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>{nextLabel}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={activeStep === "confirm" || activeStep === "schedule" ? onSaveMedicineOnly : onClose}>
              <MaterialCommunityIcons name={activeStep === "confirm" || activeStep === "schedule" ? "skip-next-outline" : "close-circle-outline"} size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>{activeStep === "confirm" || activeStep === "schedule" ? "약만 등록" : "닫기"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SearchRegistrationStep({
  query,
  results,
  selected,
  loading,
  error,
  onQueryChange,
  onSearch,
  onSelect
}: {
  query: string;
  results: MedicineSearchResult[];
  selected: MedicineSearchResult | null;
  loading: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (medicine: MedicineSearchResult) => void;
}) {
  return (
    <View style={styles.inputStack}>
      <Text style={styles.body}>e약은 API를 통해 약명, 성분명, 식별문자를 검색하고 등록할 약을 선택합니다.</Text>
      <View style={styles.searchRegisterRow}>
        <TextInput
          style={[styles.input, styles.searchRegisterInput]}
          placeholder="예: 타이레놀, 아세트아미노펜, GB"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={onSearch}
        />
        <Pressable style={styles.searchRegisterButton} onPress={onSearch}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="magnify" size={22} color="#FFFFFF" />}
        </Pressable>
      </View>
      {error ? <Text style={styles.dangerText}>{error}</Text> : null}
      {results.map((medicine) => {
        const active = selected?.id === medicine.id;
        return (
          <Pressable key={medicine.id} style={[styles.searchResultItem, active && styles.searchResultItemActive]} onPress={() => onSelect(medicine)}>
            <View style={styles.pillIcon}>
              <MaterialCommunityIcons name="pill" size={24} color={colors.primary} />
            </View>
            <View style={styles.resultText}>
              <Text style={styles.resultTitle}>{medicine.productName ?? medicine.name}</Text>
              <Text style={styles.resultMeta}>{medicine.manufacturer ?? "제조사 정보 없음"} · {medicine.ingredient ?? medicine.efficacy ?? "효능 정보 없음"}</Text>
              <Text style={styles.meta}>{medicine.form ?? "제형 미상"} · {medicine.color ?? "색상 미상"} · 식별문자 {medicine.imprint ?? "정보 없음"}</Text>
            </View>
            {active ? <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function PrescriptionOcrStep({
  result,
  selected,
  loading,
  error,
  qrScannerVisible,
  qrRaw,
  qrSampleText,
  medicineDrafts,
  durWarningsByMedicine,
  durLoading,
  durMessage,
  onRunOcr,
  onRunQrScan,
  onQrScanned,
  onCancelQrScan,
  onQrSampleTextChange,
  onApplyQrSample,
  onFillQrSample,
  onSelect,
  onUpdateMedicine,
  onToggleMedicine,
  onSaveSelected,
  onAnalyzeDur
}: {
  result: PrescriptionOcrResult | null;
  selected: PrescriptionOcrMedicine | null;
  loading: boolean;
  error: string | null;
  qrScannerVisible: boolean;
  qrRaw: string | null;
  qrSampleText: string;
  medicineDrafts: PrescriptionMedicineDraft[];
  durWarningsByMedicine: Record<string, string[]>;
  durLoading: boolean;
  durMessage: string | null;
  onRunOcr: (source: "camera" | "library") => void;
  onRunQrScan: () => void;
  onQrScanned: (result: BarcodeScanningResult) => void;
  onCancelQrScan: () => void;
  onQrSampleTextChange: (value: string) => void;
  onApplyQrSample: () => void;
  onFillQrSample: () => void;
  onSelect: (medicine: PrescriptionOcrMedicine) => void;
  onUpdateMedicine: (localId: string, patch: Partial<PrescriptionOcrMedicine>) => void;
  onToggleMedicine: (localId: string) => void;
  onSaveSelected: (options?: { withSchedule?: boolean }) => void;
  onAnalyzeDur: () => void;
}) {
  const selectedCount = medicineDrafts.filter((medicine) => medicine.selected).length;
  const warningCount = Object.values(durWarningsByMedicine).reduce((sum, warnings) => sum + warnings.length, 0);

  return (
    <View style={styles.inputStack}>
      <Text style={styles.body}>처방전 QR을 먼저 스캔하거나, 사진 촬영/사진첩 선택으로 OCR을 실행해 약명, 복용량, 횟수, 일수를 초안으로 추출합니다.</Text>
      <View style={styles.prescriptionGuideBox}>
        <Text style={styles.cardTitle}>사용자 확인 후 저장</Text>
        <Text style={styles.meta}>QR/OCR 결과는 바로 저장되지 않습니다. 약명과 복용 정보를 확인하고 필요한 약만 선택해 등록하세요.</Text>
      </View>
      <View style={styles.resultActions}>
        <Pressable style={styles.primaryButton} onPress={onRunQrScan}>
          <MaterialCommunityIcons name="qrcode-scan" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>QR 스캔</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => onRunOcr("camera")}>
          <MaterialCommunityIcons name="camera-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{loading ? "인식 중" : "사진 찍기"}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => onRunOcr("library")}>
          <MaterialCommunityIcons name="image-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>사진첩 선택</Text>
        </Pressable>
      </View>
      {qrScannerVisible ? (
        <View style={styles.qrScannerCard}>
          <CameraView
            style={styles.qrCamera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onQrScanned}
          />
          <View style={styles.qrGuideBox}>
            <Text style={styles.cardTitle}>처방전 QR을 화면 중앙에 맞춰 주세요.</Text>
            <Text style={styles.meta}>읽은 내용은 자동 저장하지 않고 확인 단계에서 사용자가 확정합니다.</Text>
            <Pressable style={styles.secondaryButton} onPress={onCancelQrScan}>
              <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>QR 스캔 닫기</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={styles.qrSampleBox}>
        <Text style={styles.cardTitle}>개발용 QR 샘플 테스트</Text>
        <Text style={styles.meta}>실제 QR이 없어도 JSON, URL, key=value 원문을 붙여넣어 파싱과 등록 흐름을 확인할 수 있습니다.</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder='예: {"medicines":[{"medicineName":"아침 혈압약","dosage":"1정","timing":"식후","durationDays":7}]}'
          placeholderTextColor={colors.textMuted}
          value={qrSampleText}
          onChangeText={onQrSampleTextChange}
          multiline
        />
        <View style={styles.resultActions}>
          <Pressable style={styles.secondaryButton} onPress={onFillQrSample}>
            <MaterialCommunityIcons name="text-box-plus-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>샘플 채우기</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onApplyQrSample}>
            <MaterialCommunityIcons name="flask-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>샘플 적용</Text>
          </Pressable>
        </View>
      </View>
      {error ? <Text style={styles.dangerText}>{error}</Text> : null}
      {qrRaw ? (
        <View style={styles.candidateBox}>
          <Text style={styles.cardTitle}>QR 원문</Text>
          <Text style={styles.meta} numberOfLines={3}>{qrRaw}</Text>
        </View>
      ) : null}
      {result ? (
        <View style={styles.candidateBox}>
          <Text style={styles.cardTitle}>{result.provider === "Prescription QR" ? "QR 공통 항목" : "OCR 공통 항목"}</Text>
          <Text style={styles.body}>
            {[result.common.patientName, result.common.prescribedOn, result.common.hospitalName, result.common.doctorName].filter(Boolean).join(" · ") || "공통 항목은 직접 확인해 주세요."}
          </Text>
          <Text style={styles.meta}>공급자: {result.provider} · 추출 텍스트 {result.rawText.length}자</Text>
        </View>
      ) : null}
      {result && !medicineDrafts.length ? (
        <View style={styles.qrFallbackBox}>
          <Text style={styles.cardTitle}>약 정보를 자동으로 찾지 못했습니다.</Text>
          <Text style={styles.meta}>QR이 병원 내부 URL이나 코드만 담고 있을 수 있습니다. 원문을 확인한 뒤 OCR 또는 직접등록을 이용해 주세요.</Text>
        </View>
      ) : null}
      {medicineDrafts.length ? (
        <View style={styles.bulkActionBox}>
          <Text style={styles.cardTitle}>등록할 약 {selectedCount}/{medicineDrafts.length}개 선택</Text>
          <Text style={styles.meta}>약만 저장하면 목록에만 추가되고, 스케줄까지 등록하면 오늘 복약 관리에 바로 연결됩니다.</Text>
          <View style={styles.durSummaryRow}>
            <MaterialCommunityIcons name={warningCount ? "alert-octagon-outline" : "shield-check-outline"} size={20} color={warningCount ? noticeText : colors.success} />
            <Text style={warningCount ? styles.warningText : styles.successText}>
              {durLoading ? "DUR과 중복 가능성을 확인하고 있습니다." : warningCount ? `DUR/중복 주의 ${warningCount}건` : "현재 후보에서 확인된 DUR 주의가 없습니다."}
            </Text>
          </View>
          {durMessage ? <Text style={styles.meta}>{durMessage}</Text> : null}
          <View style={styles.resultActions}>
            <Pressable style={styles.secondaryButton} onPress={onAnalyzeDur}>
              <MaterialCommunityIcons name="shield-sync-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>DUR 다시 확인</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => onSaveSelected({ withSchedule: false })}>
              <MaterialCommunityIcons name="content-save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>선택 약만 저장</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => onSaveSelected({ withSchedule: true })}>
              <MaterialCommunityIcons name="calendar-check" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>스케줄까지 등록</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {medicineDrafts.map((medicine) => {
        const active = selected?.name === medicine.name;
        const medicineDurWarnings = durWarningsByMedicine[medicine.localId] ?? [];
        return (
          <View key={medicine.localId} style={[styles.prescriptionEditCard, active && styles.searchResultItemActive]}>
            <View style={styles.rowBetween}>
              <Pressable style={styles.prescriptionCheckRow} onPress={() => onToggleMedicine(medicine.localId)}>
                <MaterialCommunityIcons name={medicine.selected ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={medicine.selected ? colors.success : colors.textMuted} />
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{medicine.name || "약명 확인 필요"}</Text>
                  <Text style={styles.meta}>{medicine.selected ? "등록 대상" : "등록 제외"} · 수정 후 저장</Text>
                </View>
              </Pressable>
              <Pressable style={styles.smallOutlineButton} onPress={() => onSelect(medicine)}>
                <Text style={styles.smallOutlineButtonText}>상세 적용</Text>
              </Pressable>
            </View>
            {medicineDurWarnings.length ? (
              <View style={styles.durWarningStack}>
                {medicineDurWarnings.slice(0, 3).map((warning) => (
                  <View key={warning} style={styles.warningRow}>
                    <MaterialCommunityIcons name="alert-outline" size={18} color={noticeText} />
                    <Text style={styles.warningText}>{warning}</Text>
                  </View>
                ))}
                {medicineDurWarnings.length > 3 ? <Text style={styles.meta}>외 {medicineDurWarnings.length - 3}건의 주의 정보가 더 있습니다.</Text> : null}
              </View>
            ) : null}
            <View style={styles.twoColumn}>
              <TextInput style={styles.input} placeholder="약명" placeholderTextColor={colors.textMuted} value={medicine.name} onChangeText={(value) => onUpdateMedicine(medicine.localId, { name: value })} />
              <TextInput style={styles.input} placeholder="용량" placeholderTextColor={colors.textMuted} value={medicine.dosage ?? ""} onChangeText={(value) => onUpdateMedicine(medicine.localId, { dosage: value })} />
            </View>
            <View style={styles.twoColumn}>
              <TextInput style={styles.input} placeholder="복용시점" placeholderTextColor={colors.textMuted} value={medicine.timing ?? ""} onChangeText={(value) => onUpdateMedicine(medicine.localId, { timing: value })} />
              <TextInput style={styles.input} placeholder="복용일수" placeholderTextColor={colors.textMuted} value={medicine.durationDays ? String(medicine.durationDays) : ""} keyboardType="number-pad" onChangeText={(value) => onUpdateMedicine(medicine.localId, { durationDays: value ? Number(value) : null })} />
            </View>
            <TextInput style={styles.input} placeholder="복용법/메모" placeholderTextColor={colors.textMuted} value={medicine.usage ?? medicine.memo ?? ""} onChangeText={(value) => onUpdateMedicine(medicine.localId, { usage: value })} />
          </View>
        );
      })}
    </View>
  );
}

function RegistrationInput({
  method,
  draft,
  onChange
}: {
  method: RegisterMethod;
  draft: MedicineDraft;
  onChange: (patch: Partial<MedicineDraft>) => void;
}) {
  const methodHint = {
    manual: "약명은 필수입니다. 제조사, 성분명, 용량, 제형, 색상, 메모를 직접 입력합니다.",
    search: "e약은 API 또는 의약품 정보 API로 약명, 성분명, 식별문자를 검색한 뒤 선택 등록합니다.",
    prescription: "처방전 이미지를 촬영 또는 업로드하면 OCR이 약명, 용량, 복용횟수, 복용일수를 초안으로 채웁니다.",
    ai: "알약 사진으로 모양, 색상, 식별문자를 분석하고 후보 약 목록을 제시합니다."
  }[method];

  return (
    <View style={styles.inputStack}>
      <Text style={styles.body}>{methodHint}</Text>
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="약명 필수" placeholderTextColor={colors.textMuted} value={draft.name} onChangeText={(value) => onChange({ name: value })} />
        <TextInput style={styles.input} placeholder="별칭 예: 아침 혈압약" placeholderTextColor={colors.textMuted} value={draft.alias} onChangeText={(value) => onChange({ alias: value })} />
      </View>
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="제조사" placeholderTextColor={colors.textMuted} value={draft.manufacturer} onChangeText={(value) => onChange({ manufacturer: value })} />
        <TextInput style={styles.input} placeholder="성분명" placeholderTextColor={colors.textMuted} value={draft.ingredient} onChangeText={(value) => onChange({ ingredient: value })} />
      </View>
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="용량 예: 1정" placeholderTextColor={colors.textMuted} value={draft.dosage} onChangeText={(value) => onChange({ dosage: value })} />
        <TextInput style={styles.input} placeholder="제형 예: 정제" placeholderTextColor={colors.textMuted} value={draft.form} onChangeText={(value) => onChange({ form: value })} />
      </View>
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="색상" placeholderTextColor={colors.textMuted} value={draft.color} onChangeText={(value) => onChange({ color: value })} />
        <TextInput style={styles.input} placeholder="복용 목적 예: 혈압" placeholderTextColor={colors.textMuted} value={draft.purpose} onChangeText={(value) => onChange({ purpose: value })} />
      </View>
      <TextInput style={styles.input} placeholder="개인 메모" placeholderTextColor={colors.textMuted} value={draft.memo} onChangeText={(value) => onChange({ memo: value })} />
    </View>
  );
}

function CandidateConfirmation({
  method,
  pills,
  draftName,
  selectedMedicine,
  prescriptionMedicine,
  ocrResult,
  durWarnings,
  durLoading,
  durMessage
}: {
  method: RegisterMethod;
  pills: Pill[];
  draftName: string;
  selectedMedicine?: MedicineSearchResult | null;
  prescriptionMedicine?: PrescriptionOcrMedicine | null;
  ocrResult?: PrescriptionOcrResult | null;
  durWarnings: string[];
  durLoading: boolean;
  durMessage: string | null;
}) {
  const title = method === "ai" ? "AI 후보 확인" : method === "prescription" ? "OCR 추출 결과 확인" : "약 상세 정보 확인";

  return (
    <View style={styles.inputStack}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.body}>중복 등록 여부, 제품명, 성분명, DUR 위험 정보를 확인한 뒤 저장합니다.</Text>
      <View style={styles.warningRow}>
        <MaterialCommunityIcons name="alert-decagram-outline" size={18} color={noticeText} />
        <Text style={styles.warningText}>중복성분, 병용금기, 연령주의, 임부금기 정보가 있으면 쉬운 설명으로 표시합니다.</Text>
      </View>
      <View style={styles.durPanel}>
        <View style={styles.resultTop}>
          <View style={styles.resultText}>
            <Text style={styles.cardTitle}>DUR 안전 사용 확인</Text>
            <Text style={styles.meta}>식품의약품안전처 의약품안전사용서비스(DUR) 품목정보 기준</Text>
          </View>
          {durLoading ? <ActivityIndicator color={noticeText} /> : <StatusBadge status={durWarnings.length ? "taking" : "scheduled"} highRisk={durWarnings.length > 0} />}
        </View>
        {durWarnings.length ? durWarnings.map((warning) => (
          <View key={warning} style={styles.warningRow}>
            <MaterialCommunityIcons name="alert-outline" size={18} color={noticeText} />
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        )) : (
          <Text style={styles.body}>{durMessage ?? "현재 조회된 DUR 주의 정보가 없습니다. 실제 복용 판단은 전문가에게 확인해 주세요."}</Text>
        )}
        {durWarnings.length ? <Text style={styles.meta}>DUR 정보는 복약 안전 안내이며 복용 가능 여부 판단은 의사·약사 확인이 필요합니다.</Text> : null}
      </View>
      {selectedMedicine ? (
        <View style={styles.candidateBox}>
          <Text style={styles.cardTitle}>{selectedMedicine.productName ?? selectedMedicine.name}</Text>
          <Text style={styles.body}>{selectedMedicine.manufacturer ?? "제조사 정보 없음"} · {selectedMedicine.efficacy ?? selectedMedicine.ingredient ?? "효능 정보 없음"}</Text>
          <Text style={styles.meta}>e약은 검색 결과 선택 완료 · 저장 전 최종 확인</Text>
        </View>
      ) : null}
      {prescriptionMedicine ? (
        <View style={styles.candidateBox}>
          <Text style={styles.cardTitle}>{prescriptionMedicine.name}</Text>
          <Text style={styles.body}>{prescriptionMedicine.usage ?? "OCR 추출 내용을 확인해 주세요."}</Text>
          <Text style={styles.meta}>
            {prescriptionMedicine.dosage ?? "용량 확인 필요"} · {prescriptionMedicine.timing ?? "복용시점 확인 필요"} · {prescriptionMedicine.durationDays ? `${prescriptionMedicine.durationDays}일` : "복용일수 확인 필요"}
          </Text>
        </View>
      ) : null}
      {ocrResult?.rawText ? (
        <View style={styles.candidateBox}>
          <Text style={styles.cardTitle}>OCR 원문 메모</Text>
          <Text style={styles.meta} numberOfLines={6}>{ocrResult.rawText}</Text>
        </View>
      ) : null}
      {(method === "ai" ? pills : pills.slice(0, 1)).map((pill) => (
        <View key={pill.id} style={styles.candidateBox}>
          <Text style={styles.cardTitle}>{draftName || pill.productName}</Text>
          <Text style={styles.body}>{pill.manufacturer} · {pill.ingredient}</Text>
          <Text style={styles.meta}>후보 신뢰도 {Math.round(pill.confidence * 100)}% · 최종 확인 후 저장</Text>
        </View>
      ))}
    </View>
  );
}

function ScheduleDraft({ schedule, onChange }: { schedule: ScheduleDraftState; onChange: (patch: Partial<ScheduleDraftState>) => void }) {
  const setTimesPerDay = (timesPerDay: number) => {
    const doseTimes = timesPerDay === 0 ? [] : defaultDoseTimes.slice(0, timesPerDay);
    onChange({ timesPerDay, doseTimes, repeatRule: timesPerDay === 0 ? "as_needed" : schedule.repeatRule === "as_needed" ? "daily" : schedule.repeatRule });
  };
  const setRepeatRule = (repeatRule: MedicineSchedule["repeatRule"]) => {
    onChange({
      repeatRule,
      timesPerDay: repeatRule === "as_needed" ? 0 : Math.max(schedule.timesPerDay, 1),
      doseTimes: repeatRule === "as_needed" ? [] : schedule.doseTimes.length ? schedule.doseTimes : ["08:00"]
    });
  };
  const toggleDoseTime = (time: string) => {
    const doseTimes = schedule.doseTimes.includes(time)
      ? schedule.doseTimes.filter((item) => item !== time)
      : [...schedule.doseTimes, time].sort();
    onChange({ doseTimes, timesPerDay: doseTimes.length || schedule.timesPerDay });
  };
  const toggleWeekday = (weekday: number) => {
    const weekdays = schedule.weekdays.includes(weekday)
      ? schedule.weekdays.filter((day) => day !== weekday)
      : [...schedule.weekdays, weekday].sort();
    onChange({ weekdays: weekdays.length ? weekdays : [weekday] });
  };
  const toggleMonthDay = (day: number) => {
    const monthDays = schedule.monthDays.includes(day)
      ? schedule.monthDays.filter((item) => item !== day)
      : [...schedule.monthDays, day].sort((a, b) => a - b);
    onChange({ monthDays: monthDays.length ? monthDays : [day] });
  };

  return (
    <View style={styles.inputStack}>
      <Text style={styles.cardTitle}>복약 스케줄 설정</Text>
      <Text style={styles.body}>매일, 요일별, 매주, 매월, 수시, 주기성 복약을 선택하고 알림·기간을 함께 설정합니다.</Text>
      <View style={styles.scheduleTypeGrid}>
        <ScheduleTypeChoice title="매일" description="매일 같은 시간" active={schedule.repeatRule === "daily"} onPress={() => setRepeatRule("daily")} />
        <ScheduleTypeChoice title="요일별" description="월/수/금 등" active={schedule.repeatRule === "weekday"} onPress={() => setRepeatRule("weekday")} />
        <ScheduleTypeChoice title="매주" description="N주마다 반복" active={schedule.repeatRule === "weekly"} onPress={() => setRepeatRule("weekly")} />
        <ScheduleTypeChoice title="매월" description="날짜/요일 기준" active={schedule.repeatRule === "monthly"} onPress={() => setRepeatRule("monthly")} />
        <ScheduleTypeChoice title="수시" description="필요할 때 기록" active={schedule.repeatRule === "as_needed"} onPress={() => setRepeatRule("as_needed")} />
        <ScheduleTypeChoice title="주기성" description="N시간/N일·휴약" active={schedule.repeatRule === "interval" || schedule.repeatRule === "cycle"} onPress={() => setRepeatRule("interval")} />
      </View>
      <View style={styles.filterRow}>
        <MiniChoice label="1일 1회" active={schedule.timesPerDay === 1 && schedule.repeatRule !== "as_needed"} onPress={() => setTimesPerDay(1)} />
        <MiniChoice label="1일 2회" active={schedule.timesPerDay === 2} onPress={() => setTimesPerDay(2)} />
        <MiniChoice label="1일 3회" active={schedule.timesPerDay === 3} onPress={() => setTimesPerDay(3)} />
        <MiniChoice label="필요 시" active={schedule.repeatRule === "as_needed"} onPress={() => setTimesPerDay(0)} />
      </View>
      {schedule.repeatRule !== "as_needed" ? (
        <View style={styles.filterRow}>
          {scheduleTimes.map((time) => (
            <MiniChoice key={time} label={time} active={schedule.doseTimes.includes(time.slice(-5))} onPress={() => toggleDoseTime(time.slice(-5))} />
          ))}
        </View>
      ) : null}
      {schedule.repeatRule === "weekday" || schedule.repeatRule === "weekly" ? (
        <View style={styles.schedulePanel}>
          <Text style={styles.cardTitle}>{schedule.repeatRule === "weekly" ? "반복 기준 요일" : "복약 요일"}</Text>
          <View style={styles.filterRow}>
            {weekdayOptions.map((day) => (
              <MiniChoice key={day.value} label={day.label} active={schedule.weekdays.includes(day.value)} onPress={() => toggleWeekday(day.value)} />
            ))}
          </View>
          {schedule.repeatRule === "weekly" ? (
            <TextInput style={styles.input} placeholder="반복 주기 예: 1=매주, 2=2주마다" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.weekInterval} onChangeText={(value) => onChange({ weekInterval: value.replace(/[^0-9]/g, "") })} />
          ) : <Text style={styles.meta}>선택한 요일마다 같은 복약 시간이 적용됩니다. 요일별 다른 시간은 이후 상세 편집에서 확장합니다.</Text>}
        </View>
      ) : null}
      {schedule.repeatRule === "monthly" ? (
        <View style={styles.schedulePanel}>
          <Text style={styles.cardTitle}>매월 반복 방식</Text>
          <View style={styles.filterRow}>
            <MiniChoice label="날짜" active={schedule.monthlyMode === "date"} onPress={() => onChange({ monthlyMode: "date" })} />
            <MiniChoice label="N번째 요일" active={schedule.monthlyMode === "weekday"} onPress={() => onChange({ monthlyMode: "weekday" })} />
            <MiniChoice label="말일" active={schedule.monthlyMode === "last_day"} onPress={() => onChange({ monthlyMode: "last_day" })} />
          </View>
          {schedule.monthlyMode === "date" ? (
            <>
              <View style={styles.filterRow}>
                {[1, 5, 10, 15, 20, 25, 30, 31].map((day) => (
                  <MiniChoice key={day} label={`${day}일`} active={schedule.monthDays.includes(day)} onPress={() => toggleMonthDay(day)} />
                ))}
              </View>
              <View style={styles.filterRow}>
                <MiniChoice label="없는 날짜는 말일" active={schedule.missingDatePolicy === "last_day"} onPress={() => onChange({ missingDatePolicy: "last_day" })} />
                <MiniChoice label="없는 달은 건너뜀" active={schedule.missingDatePolicy === "skip"} onPress={() => onChange({ missingDatePolicy: "skip" })} />
              </View>
            </>
          ) : null}
          {schedule.monthlyMode === "weekday" ? (
            <View style={styles.twoColumn}>
              <TextInput style={styles.input} placeholder="N번째 예: 1, 2, 3, 4" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.monthlyWeekOrdinal} onChangeText={(value) => onChange({ monthlyWeekOrdinal: value.replace(/[^0-9]/g, "") })} />
              <TextInput style={styles.input} placeholder="요일 숫자 0=일, 1=월" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.monthlyWeekday} onChangeText={(value) => onChange({ monthlyWeekday: value.replace(/[^0-9]/g, "") })} />
            </View>
          ) : null}
        </View>
      ) : null}
      {schedule.repeatRule === "interval" || schedule.repeatRule === "cycle" ? (
        <View style={styles.schedulePanel}>
          <Text style={styles.cardTitle}>주기성 복약</Text>
          <View style={styles.filterRow}>
            <MiniChoice label="시간 간격" active={schedule.repeatRule === "interval"} onPress={() => setRepeatRule("interval")} />
            <MiniChoice label="복용+휴약" active={schedule.repeatRule === "cycle"} onPress={() => setRepeatRule("cycle")} />
          </View>
          {schedule.repeatRule === "interval" ? (
            <View style={styles.twoColumn}>
              <TextInput style={styles.input} placeholder="N시간마다 예: 6" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.intervalHours} onChangeText={(value) => onChange({ intervalHours: value.replace(/[^0-9]/g, "") })} />
              <TextInput style={styles.input} placeholder="N일마다 예: 2" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.intervalDays} onChangeText={(value) => onChange({ intervalDays: value.replace(/[^0-9]/g, "") })} />
            </View>
          ) : (
            <View style={styles.twoColumn}>
              <TextInput style={styles.input} placeholder="복용일 예: 3" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.cycleActiveDays} onChangeText={(value) => onChange({ cycleActiveDays: value.replace(/[^0-9]/g, "") })} />
              <TextInput style={styles.input} placeholder="휴약일 예: 1" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.cycleRestDays} onChangeText={(value) => onChange({ cycleRestDays: value.replace(/[^0-9]/g, "") })} />
            </View>
          )}
          <TextInput style={styles.input} placeholder="하루 최대 알림 횟수" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.maxDailyNotifications} onChangeText={(value) => onChange({ maxDailyNotifications: value.replace(/[^0-9]/g, "") })} />
        </View>
      ) : null}
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="시작일 YYYY-MM-DD" placeholderTextColor={colors.textMuted} value={schedule.startDate} onChangeText={(value) => onChange({ startDate: value })} />
        <TextInput style={styles.input} placeholder="종료일 미설정 시 계속 반복" placeholderTextColor={colors.textMuted} value={schedule.endDate} onChangeText={(value) => onChange({ endDate: value })} />
      </View>
      <TextInput style={styles.input} placeholder="복용일수 입력 시 종료일 자동 계산 예: 7, 14, 30" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.durationDays} onChangeText={(value) => onChange({ durationDays: value.replace(/[^0-9]/g, "") })} />
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="복용 방법 예: 경구" placeholderTextColor={colors.textMuted} value={schedule.doseMethod} onChangeText={(value) => onChange({ doseMethod: value })} />
        <TextInput style={styles.input} placeholder="복용 시점 예: 식후" placeholderTextColor={colors.textMuted} value={schedule.doseTiming} onChangeText={(value) => onChange({ doseTiming: value })} />
      </View>
      <TextInput style={styles.input} placeholder="식전/식후 offset 분 예: 식후 30분이면 30" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.relationOffsetMinutes} onChangeText={(value) => onChange({ relationOffsetMinutes: value.replace(/[^0-9]/g, "") })} />
      <View style={styles.filterRow}>
        <MiniChoice label="알림 켜기" active={schedule.notifyEnabled} onPress={() => onChange({ notifyEnabled: !schedule.notifyEnabled })} />
        <MiniChoice label="강한 알림" active={schedule.notificationLevel === "strong"} onPress={() => onChange({ notificationLevel: schedule.notificationLevel === "strong" ? "normal" : "strong" })} />
        <MiniChoice label="재알림" active={schedule.reminderEnabled} onPress={() => onChange({ reminderEnabled: !schedule.reminderEnabled })} />
        <MiniChoice label="보호자 알림" active={schedule.guardianAlertEnabled} onPress={() => onChange({ guardianAlertEnabled: !schedule.guardianAlertEnabled })} />
        <MiniChoice label="일시중지" active={schedule.paused} onPress={() => onChange({ paused: !schedule.paused })} />
      </View>
      {schedule.reminderEnabled || schedule.guardianAlertEnabled ? (
        <View style={styles.twoColumn}>
          <TextInput style={styles.input} placeholder="재알림 간격 분" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.reminderIntervalMinutes} onChangeText={(value) => onChange({ reminderIntervalMinutes: value.replace(/[^0-9]/g, "") })} />
          <TextInput style={styles.input} placeholder="보호자 알림 지연 분" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={schedule.guardianAlertDelayMinutes} onChangeText={(value) => onChange({ guardianAlertDelayMinutes: value.replace(/[^0-9]/g, "") })} />
        </View>
      ) : null}
      <Text style={styles.meta}>저장될 스케줄: {formatScheduleSummary(schedule)}</Text>
    </View>
  );
}

function TodayDoseRow({ medicine, onTaken, onSkipped }: { medicine: RegisteredMedicine; onTaken: () => void; onSkipped: () => void }) {
  return (
    <View style={[styles.todayDoseRow, medicine.highRisk && styles.highRiskRow]}>
      <View style={styles.doseTimeBox}>
        <Text style={styles.doseTime}>{medicine.schedule?.split(" ")[1] ?? "08:00"}</Text>
        <Text style={styles.meta}>{medicine.timing}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{medicine.alias || medicine.name}</Text>
        <Text style={styles.body}>{medicine.dosage} · {medicine.form} · {medicine.purpose}</Text>
        {medicine.highRisk ? <Text style={styles.dangerText}>중요도 높은 약 · 복약 확인 권장</Text> : null}
        {medicine.durWarnings?.length ? <Text style={styles.dangerText}>DUR 주의 · {medicine.durWarnings[0]}</Text> : null}
      </View>
      <View style={styles.statusActions}>
        <Pressable style={styles.iconAction} onPress={onTaken}>
          <MaterialCommunityIcons name="check-circle" size={22} color={colors.success} />
        </Pressable>
        <Pressable style={styles.iconAction} onPress={onSkipped}>
          <MaterialCommunityIcons name="clock-alert-outline" size={22} color={colors.warning} />
        </Pressable>
      </View>
    </View>
  );
}

function MedicineListItem({
  medicine,
  compareMode,
  selectedForCompare,
  onToggleCompare,
  onToggleFavorite,
  onEnd
}: {
  medicine: RegisteredMedicine;
  compareMode?: boolean;
  selectedForCompare?: boolean;
  onToggleCompare?: () => void;
  onToggleFavorite: () => void;
  onEnd: () => void;
}) {
  return (
    <View style={[styles.medicineItem, selectedForCompare && styles.compareSelectedItem]}>
      {compareMode ? (
        <Pressable style={styles.compareSelectRow} onPress={onToggleCompare}>
          <MaterialCommunityIcons name={selectedForCompare ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={selectedForCompare ? colors.success : colors.textMuted} />
          <Text style={styles.cardTitle}>{selectedForCompare ? "비교 대상" : "비교에 추가"}</Text>
        </Pressable>
      ) : null}
      <View style={styles.resultTop}>
        <Pressable onPress={onToggleFavorite} style={styles.pillIcon}>
          <MaterialCommunityIcons name={medicine.favorite ? "star" : "star-outline"} size={24} color={medicine.favorite ? colors.warning : colors.primary} />
        </Pressable>
        <View style={styles.resultText}>
          <Text style={styles.resultTitle}>{medicine.alias || medicine.name}</Text>
          <Text style={styles.resultMeta}>{medicine.name} · {medicine.ingredient}</Text>
        </View>
        <StatusBadge status={medicine.status} highRisk={medicine.highRisk} />
      </View>
      <Text style={styles.body}>{medicine.manufacturer} · {medicine.dosage} · {medicine.timing} · {medicine.schedule}</Text>
      {medicine.durWarnings?.length ? (
        <View style={styles.durPanel}>
          <Text style={styles.cardTitle}>DUR 주의 정보</Text>
          {medicine.durWarnings.slice(0, 3).map((warning) => (
            <View key={warning} style={styles.warningRow}>
              <MaterialCommunityIcons name="alert-outline" size={18} color={noticeText} />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.resultActions}>
        <Pressable style={styles.secondaryButton}>
          <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>수정</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton}>
          <MaterialCommunityIcons name="calendar-plus" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>스케줄</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onEnd}>
          <MaterialCommunityIcons name="stop-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>복용종료</Text>
        </Pressable>
      </View>
      <Text style={styles.meta}>삭제 전 연결된 복약 스케줄과 이력을 안내하고, 삭제 대신 복용종료를 선택할 수 있습니다.</Text>
    </View>
  );
}

function DurCompareModal({
  visible,
  selectedMedicines,
  results,
  onClose
}: {
  visible: boolean;
  selectedMedicines: RegisteredMedicine[];
  results: DurCompareResult[];
  onClose: () => void;
}) {
  const dangerCount = results.filter((result) => result.severity === "danger").length;
  const warningCount = results.filter((result) => result.severity === "warning").length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>DUR 비교 결과</Text>
              <Text style={styles.body}>{selectedMedicines.length}개 약의 중복성분과 DUR 주의를 비교했습니다.</Text>
            </View>
            <Pressable style={styles.iconAction} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.primary} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            <View style={styles.compareSummaryGrid}>
              <View style={styles.compareSummaryCard}>
                <Text style={styles.resultTitle}>{dangerCount}건</Text>
                <Text style={styles.meta}>주의 필요</Text>
              </View>
              <View style={styles.compareSummaryCard}>
                <Text style={styles.resultTitle}>{warningCount}건</Text>
                <Text style={styles.meta}>확인 권장</Text>
              </View>
              <View style={styles.compareSummaryCard}>
                <Text style={styles.resultTitle}>{selectedMedicines.length}개</Text>
                <Text style={styles.meta}>비교 약</Text>
              </View>
            </View>
            <View style={styles.candidateBox}>
              <Text style={styles.cardTitle}>선택한 약</Text>
              <Text style={styles.body}>{selectedMedicines.map((medicine) => medicine.alias || medicine.name).join(", ")}</Text>
            </View>
            {results.map((result) => (
              <View key={result.id} style={[styles.compareResultCard, result.severity === "danger" && styles.compareDangerCard, result.severity === "safe" && styles.compareSafeCard]}>
                <View style={styles.resultTop}>
                  <MaterialCommunityIcons
                    name={result.severity === "danger" ? "alert-octagon-outline" : result.severity === "warning" ? "alert-outline" : "shield-check-outline"}
                    size={24}
                    color={result.severity === "safe" ? colors.success : noticeText}
                  />
                  <View style={styles.resultText}>
                    <Text style={styles.cardTitle}>{result.title}</Text>
                    <Text style={styles.meta}>{result.medicineNames.join(" + ")}</Text>
                  </View>
                </View>
                <Text style={result.severity === "safe" ? styles.successText : styles.warningText}>{result.description}</Text>
              </View>
            ))}
            <Text style={styles.meta}>DUR 비교는 복약 안전 보조 정보입니다. 실제 복용 중단이나 병용 판단은 의사 또는 약사에게 확인하세요.</Text>
          </ScrollView>
          <View style={styles.modalActions}>
            <Pressable style={styles.primaryButton} onPress={onClose}>
              <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AiCandidateCard({ pill }: { pill: Pill }) {
  return (
    <View style={styles.resultCard}>
      <View style={styles.resultTop}>
        <View style={styles.pillIcon}>
          <MaterialCommunityIcons name="pill" size={26} color={colors.primary} />
        </View>
        <View style={styles.resultText}>
          <Text style={styles.resultTitle}>{pill.productName}</Text>
          <Text style={styles.resultMeta}>{pill.manufacturer} · {pill.ingredient}</Text>
        </View>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>{Math.round(pill.confidence * 100)}%</Text>
        </View>
      </View>
      <Text style={styles.body}>{pill.shape} · {pill.color} · 식별문자 {pill.imprint}</Text>
      {pill.warnings.map((warning) => (
        <View key={warning} style={styles.warningRow}>
          <MaterialCommunityIcons name="alert-outline" size={18} color={noticeText} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ))}
      <View style={styles.resultActions}>
        <Pressable style={styles.primaryButton}>
          <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>이 약 선택</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton}>
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>상세보기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function RegistrationTile({ title, description, icon, active = false, onPress }: { title: string; description: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tile, active && styles.tileActive]}>
      <MaterialCommunityIcons name={icon} size={26} color={active ? "#FFFFFF" : colors.primary} />
      <Text style={[styles.tileTitle, active && styles.tileTitleActive]}>{title}</Text>
      <Text style={[styles.tileDescription, active && styles.tileDescriptionActive]}>{description}</Text>
    </Pressable>
  );
}

function StepPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.stepPill, active && styles.stepPillActive]}>
      <Text style={[styles.stepText, active && styles.stepTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MiniChoice({ label, active = false, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ScheduleTypeChoice({ title, description, active, onPress }: { title: string; description: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.scheduleTypeChoice, active && styles.scheduleTypeChoiceActive]} onPress={onPress}>
      <Text style={[styles.cardTitle, active && styles.scheduleTypeTextActive]}>{title}</Text>
      <Text style={[styles.meta, active && styles.scheduleTypeMetaActive]}>{description}</Text>
    </Pressable>
  );
}

function parseOptionalNumber(value?: string | null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function uniqueWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings.map((warning) => warning.trim()).filter(Boolean)));
}

function normalizeMedicineText(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, "").replace(/[(){}\[\]·.,]/g, "").toLowerCase();
}

function buildExistingMedicineWarnings(name: string, ingredient: string | undefined, medicines: RegisteredMedicine[]): string[] {
  const normalizedName = normalizeMedicineText(name);
  const normalizedIngredient = normalizeMedicineText(ingredient);
  const warnings: string[] = [];
  const sameName = medicines.find((medicine) =>
    [medicine.name, medicine.productName, medicine.alias].some((value) => normalizeMedicineText(value) === normalizedName)
  );
  if (sameName) {
    warnings.push("이미 등록된 약과 이름이 같습니다. 중복 복용 여부를 확인하세요.");
  }
  if (normalizedIngredient) {
    const sameIngredient = medicines.find((medicine) => normalizeMedicineText(medicine.ingredient) === normalizedIngredient);
    if (sameIngredient) {
      warnings.push("이미 등록된 약과 성분명이 같습니다. 중복성분 복용 가능성을 확인하세요.");
    }
  }
  return warnings;
}

function formatScheduleSummary(schedule: ScheduleDraftState): string {
  const repeatLabel = {
    daily: "매일",
    weekday: `요일별 ${schedule.weekdays.map((day) => weekdayOptions.find((item) => item.value === day)?.label).filter(Boolean).join("/")}`,
    weekly: `${schedule.weekInterval || 1}주마다 ${schedule.weekdays.map((day) => weekdayOptions.find((item) => item.value === day)?.label).filter(Boolean).join("/")}`,
    monthly: schedule.monthlyMode === "last_day" ? "매월 말일" : schedule.monthlyMode === "weekday" ? `매월 ${schedule.monthlyWeekOrdinal}번째 요일` : `매월 ${schedule.monthDays.join(", ")}일`,
    interval: schedule.intervalHours ? `${schedule.intervalHours}시간마다` : `${schedule.intervalDays || 1}일마다`,
    cycle: `${schedule.cycleActiveDays || 0}일 복용 + ${schedule.cycleRestDays || 0}일 휴약`,
    alternate_day: "격일",
    as_needed: "필요 시"
  }[schedule.repeatRule];
  const timeLabel = schedule.repeatRule === "as_needed" ? "필요 시" : schedule.doseTimes.join(", ") || "시간 미정";
  const durationLabel = schedule.endDate ? ` · ${schedule.endDate}까지` : schedule.durationDays ? ` · ${schedule.durationDays}일` : " · 계속 반복";
  const alertLabel = schedule.notifyEnabled ? ` · ${schedule.notificationLevel === "strong" ? "강한 알림" : "알림"}` : " · 알림 꺼짐";
  const reminderLabel = schedule.reminderEnabled ? ` · ${schedule.reminderIntervalMinutes}분 재알림` : "";
  return `${repeatLabel} ${timeLabel}${durationLabel}${alertLabel}${reminderLabel}`;
}

function calculateEndDate(startDate: string, durationDays: number): string | null {
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  start.setDate(start.getDate() + Math.max(0, durationDays - 1));
  return start.toISOString().slice(0, 10);
}

function StatusBadge({ status, highRisk }: { status: RegisteredMedicine["status"]; highRisk: boolean }) {
  const label = highRisk ? "고위험" : status === "taking" ? "복용중" : status === "scheduled" ? "복용예정" : "복용종료";
  return (
    <View style={[styles.statusBadge, highRisk ? styles.highRiskBadge : status === "ended" ? styles.endedBadge : styles.takingBadge]}>
      <Text style={[styles.statusBadgeText, highRisk && styles.highRiskBadgeText]}>{label}</Text>
    </View>
  );
}

function seedForSelectedProfile(profile?: { profileId?: string | number | null; profileName?: string | null } | null): RegisteredMedicine[] {
  return registeredMedicinesSeed.map((medicine) => ({
    ...medicine,
    profileId: profile?.profileId,
    profileName: profile?.profileName
  }));
}

const noticeText = "#A83B15";

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
  notice: {
    minHeight: 78,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  noticeText: {
    ...typography.body,
    flex: 1,
    color: noticeText,
    fontWeight: "800",
    lineHeight: 22
  },
  segmented: {
    minHeight: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.xs,
    flexDirection: "row",
    gap: spacing.xs
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: colors.primary
  },
  segmentText: {
    ...typography.button,
    color: colors.primary,
    textAlign: "center"
  },
  segmentTextActive: {
    color: "#FFFFFF"
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  tile: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 96,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    justifyContent: "space-between"
  },
  tileActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  tileTitle: {
    ...typography.bodyLarge,
    fontWeight: "800",
    color: colors.primary
  },
  tileTitleActive: {
    color: "#FFFFFF"
  },
  tileDescription: {
    ...typography.body,
    color: colors.text
  },
  tileDescriptionActive: {
    color: "#FFFFFF"
  },
  flowCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  listCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  flex: {
    flex: 1,
    gap: spacing.xs
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
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
  saveBadge: {
    borderRadius: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  saveBadgeText: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  stepRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  stepPill: {
    minHeight: 42,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  stepPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  stepText: {
    ...typography.caption,
    color: colors.primary
  },
  stepTextActive: {
    color: "#FFFFFF"
  },
  inputStack: {
    gap: spacing.sm
  },
  input: {
    minHeight: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textStrong
  },
  twoColumn: {
    gap: spacing.sm
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filterChip: {
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    ...typography.caption,
    color: colors.primary
  },
  filterTextActive: {
    color: "#FFFFFF"
  },
  scheduleTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  scheduleTypeChoice: {
    flexBasis: "31%",
    flexGrow: 1,
    minHeight: 76,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.sm,
    gap: spacing.xs,
    justifyContent: "center"
  },
  scheduleTypeChoiceActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  scheduleTypeTextActive: {
    color: "#FFFFFF"
  },
  scheduleTypeMetaActive: {
    color: "#EAF3FF"
  },
  schedulePanel: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  candidateBox: {
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs
  },
  qrScannerCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    gap: spacing.sm
  },
  qrCamera: {
    height: 130,
    width: "100%"
  },
  qrGuideBox: {
    padding: spacing.sm,
    gap: spacing.xs
  },
  prescriptionGuideBox: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
    gap: spacing.xs
  },
  qrFallbackBox: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
    padding: spacing.md,
    gap: spacing.xs
  },
  qrSampleBox: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  bulkActionBox: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  prescriptionEditCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  prescriptionCheckRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  smallOutlineButton: {
    minHeight: 36,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  smallOutlineButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  durPanel: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
    padding: spacing.md,
    gap: spacing.sm
  },
  todayCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.sm
  },
  todayBadge: {
    borderRadius: 4,
    backgroundColor: "#E8F5EE",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  todayBadgeText: {
    ...typography.caption,
    color: colors.success
  },
  todayDoseRow: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  highRiskRow: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED"
  },
  doseTimeBox: {
    width: 82,
    borderRadius: 4,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    padding: spacing.sm,
    gap: 2
  },
  doseTime: {
    ...typography.sectionTitle,
    color: colors.primary
  },
  dangerText: {
    ...typography.caption,
    color: noticeText
  },
  validationText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: "800"
  },
  statusActions: {
    gap: spacing.xs
  },
  iconAction: {
    width: 42,
    height: 42,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  addButton: {
    minWidth: 64,
    minHeight: 52,
    borderRadius: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  addButtonText: {
    ...typography.button,
    color: "#FFFFFF"
  },
  searchBox: {
    minHeight: 62,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  searchInput: {
    ...typography.bodyLarge,
    minHeight: 58,
    color: colors.textStrong
  },
  emptyBox: {
    minHeight: 104,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.xs
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  emptyDescription: {
    ...typography.bodyLarge,
    color: colors.text
  },
  medicineItem: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  compareSelectedItem: {
    borderColor: colors.primary,
    backgroundColor: "#F8FBFF"
  },
  compareSelectRow: {
    minHeight: 44,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  compareActionBox: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  compareSummaryGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  compareSummaryCard: {
    flex: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.xs
  },
  compareResultCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
    padding: spacing.md,
    gap: spacing.sm
  },
  compareDangerCard: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2"
  },
  compareSafeCard: {
    borderColor: "#86EFAC",
    backgroundColor: "#F0FDF4"
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  takingBadge: {
    backgroundColor: colors.primarySoft
  },
  endedBadge: {
    backgroundColor: "#F3F4F6"
  },
  highRiskBadge: {
    backgroundColor: "#FFF7ED"
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  highRiskBadgeText: {
    color: noticeText
  },
  candidateSection: {
    gap: spacing.xs
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text
  },
  resultCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  resultTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  pillIcon: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  resultText: {
    flex: 1,
    gap: 2
  },
  resultTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  resultMeta: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  confidenceBadge: {
    minHeight: 36,
    borderRadius: 4,
    backgroundColor: "#E8F5EE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  confidenceText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "800"
  },
  warningRow: {
    borderRadius: 4,
    backgroundColor: "#FFF7ED",
    padding: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "flex-start"
  },
  warningText: {
    ...typography.caption,
    flex: 1,
    color: noticeText,
    lineHeight: 19
  },
  successText: {
    ...typography.caption,
    flex: 1,
    color: colors.success,
    lineHeight: 19,
    fontWeight: "700"
  },
  durSummaryRow: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C7D6EA",
    padding: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "flex-start"
  },
  durWarningStack: {
    gap: spacing.xs
  },
  resultActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  primaryButtonText: {
    ...typography.button,
    color: "#FFFFFF"
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.primary
  },
  successNotice: {
    ...typography.body,
    color: colors.success,
    textAlign: "center"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.md
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  modalBody: {
    maxHeight: 520
  },
  modalBodyContent: {
    gap: spacing.md,
    paddingBottom: spacing.sm
  },
  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  searchRegisterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center"
  },
  searchRegisterInput: {
    flex: 1
  },
  searchRegisterButton: {
    width: 52,
    height: 52,
    borderRadius: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  searchResultItem: {
    minHeight: 86,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  searchResultItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  }
});
