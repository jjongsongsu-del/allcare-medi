import AsyncStorage from "@react-native-async-storage/async-storage";
import { MedicalFacility, MedicationEvent, MedicineSchedule, RegisteredMedicine } from "@/types/domain";

export type FamilyProfile = {
  profileId: string | number;
  profileName: string;
  relationType?: string | null;
  birthDate?: string | null;
  birthYear?: number | null;
  birthMonth?: number | null;
  gender?: string | null;
  phone?: string | null;
  memo?: string | null;
  isDefault?: boolean;
  bloodType?: string | null;
  allergies?: string | null;
  chronicDiseases?: string | null;
  currentMedications?: string | null;
  emergencyContact?: string | null;
  favoriteHospital?: string | null;
  favoritePharmacy?: string | null;
  canView?: boolean;
  canEdit?: boolean;
  canReceiveAlert?: boolean;
  canViewEmergency?: boolean;
  consentStatus?: "PENDING" | "ACCEPTED" | "LOCAL_ONLY";
};

export type StoredPlace = {
  placeId: string;
  placeName: string;
  placeType: string;
  profileId?: string | number;
  profileName?: string;
  address: string;
  phone: string;
  memo?: string;
  viewedAt?: string;
};

export type ConsentSettings = {
  terms: boolean;
  privacy: boolean;
  age14: boolean;
  location: boolean;
  push: boolean;
  familyMedicalMemo: boolean;
  medicinePhotoStorage: boolean;
  aiImprovement: boolean;
  marketing: boolean;
};

const familyProfilesKey = "allcaremedi.local.familyProfiles";
const favoritePlacesKey = "allcaremedi.local.favoritePlaces";
const recentPlacesKey = "allcaremedi.local.recentPlaces";
const consentSettingsKey = "allcaremedi.local.consentSettings";
const selectedFamilyProfileKey = "allcaremedi.local.selectedFamilyProfile";
const registeredMedicinesKey = "allcaremedi.local.registeredMedicines";
const medicineSchedulesKey = "allcaremedi.local.medicineSchedules";
const medicationEventsKey = "allcaremedi.local.medicationEvents";

export const defaultConsentSettings: ConsentSettings = {
  terms: false,
  privacy: false,
  age14: false,
  location: false,
  push: false,
  familyMedicalMemo: false,
  medicinePhotoStorage: false,
  aiImprovement: false,
  marketing: false
};

export async function getLocalFamilyProfiles(): Promise<FamilyProfile[]> {
  return readJson<FamilyProfile[]>(familyProfilesKey, []);
}

export async function saveLocalFamilyProfile(profile: Omit<FamilyProfile, "profileId">): Promise<FamilyProfile> {
  const profiles = await getLocalFamilyProfiles();
  const nextProfile: FamilyProfile = {
    ...profile,
    profileId: `local-profile-${Date.now()}`,
    isDefault: profiles.length === 0,
    canView: profile.canView ?? true,
    canEdit: profile.canEdit ?? true,
    canReceiveAlert: profile.canReceiveAlert ?? false,
    canViewEmergency: profile.canViewEmergency ?? true,
    consentStatus: profile.consentStatus ?? "LOCAL_ONLY"
  };
  await AsyncStorage.setItem(familyProfilesKey, JSON.stringify([...profiles, nextProfile]));
  return nextProfile;
}

export async function updateLocalFamilyProfile(profile: FamilyProfile): Promise<FamilyProfile[]> {
  const profiles = await getLocalFamilyProfiles();
  const next = profiles.map((item) => String(item.profileId) === String(profile.profileId) ? profile : item);
  await AsyncStorage.setItem(familyProfilesKey, JSON.stringify(next));
  return next;
}

export async function getSelectedFamilyProfileId(): Promise<string | null> {
  return AsyncStorage.getItem(selectedFamilyProfileKey);
}

export async function setSelectedFamilyProfileId(profileId: string | number): Promise<void> {
  await AsyncStorage.setItem(selectedFamilyProfileKey, String(profileId));
}

export async function getLocalFavoritePlaces(): Promise<StoredPlace[]> {
  return readJson<StoredPlace[]>(favoritePlacesKey, []);
}

export async function saveLocalFavoritePlace(place: StoredPlace): Promise<StoredPlace[]> {
  const places = await getLocalFavoritePlaces();
  const next = [place, ...places.filter((item) => item.placeId !== place.placeId)].slice(0, 50);
  await AsyncStorage.setItem(favoritePlacesKey, JSON.stringify(next));
  return next;
}

export async function getLocalRecentPlaces(): Promise<StoredPlace[]> {
  return readJson<StoredPlace[]>(recentPlacesKey, []);
}

export async function saveLocalRecentPlace(facility: MedicalFacility, profile?: FamilyProfile | null): Promise<StoredPlace[]> {
  const place: StoredPlace = {
    placeId: facility.id,
    placeName: facility.name,
    placeType: facility.type,
    profileId: profile?.profileId,
    profileName: profile?.profileName,
    address: facility.address,
    phone: facility.phone,
    viewedAt: new Date().toISOString()
  };
  const places = await getLocalRecentPlaces();
  const next = [place, ...places.filter((item) => item.placeId !== place.placeId)].slice(0, 30);
  await AsyncStorage.setItem(recentPlacesKey, JSON.stringify(next));
  return next;
}

export async function getConsentSettings(): Promise<ConsentSettings> {
  return readJson<ConsentSettings>(consentSettingsKey, defaultConsentSettings);
}

export async function saveConsentSettings(settings: ConsentSettings): Promise<void> {
  await AsyncStorage.setItem(consentSettingsKey, JSON.stringify(settings));
}

export async function getLocalRegisteredMedicines(profile?: FamilyProfile | null): Promise<RegisteredMedicine[]> {
  const medicines = await readJson<RegisteredMedicine[]>(registeredMedicinesKey, []);
  if (!profile?.profileId) return medicines;
  return medicines.filter((medicine) => !medicine.profileId || String(medicine.profileId) === String(profile.profileId));
}

export async function saveLocalRegisteredMedicine(
  medicine: Omit<RegisteredMedicine, "id" | "createdAt" | "updatedAt"> & Partial<Pick<RegisteredMedicine, "id" | "createdAt" | "updatedAt">>
): Promise<RegisteredMedicine[]> {
  const medicines = await readJson<RegisteredMedicine[]>(registeredMedicinesKey, []);
  const now = new Date().toISOString();
  const nextMedicine: RegisteredMedicine = {
    ...medicine,
    id: medicine.id ?? `local-medicine-${Date.now()}`,
    name: medicine.name.trim(),
    status: medicine.status ?? "taking",
    source: medicine.source ?? "manual",
    favorite: medicine.favorite ?? false,
    highRisk: medicine.highRisk ?? false,
    durWarnings: medicine.durWarnings ?? [],
    createdAt: medicine.createdAt ?? now,
    updatedAt: now
  };
  const next = [nextMedicine, ...medicines.filter((item) => item.id !== nextMedicine.id)];
  await AsyncStorage.setItem(registeredMedicinesKey, JSON.stringify(next));
  return next;
}

export async function updateLocalRegisteredMedicine(medicine: RegisteredMedicine): Promise<RegisteredMedicine[]> {
  const medicines = await readJson<RegisteredMedicine[]>(registeredMedicinesKey, []);
  const updatedMedicine = { ...medicine, updatedAt: new Date().toISOString() };
  const exists = medicines.some((item) => item.id === medicine.id);
  const next = exists
    ? medicines.map((item) => item.id === medicine.id ? updatedMedicine : item)
    : [updatedMedicine, ...medicines];
  await AsyncStorage.setItem(registeredMedicinesKey, JSON.stringify(next));
  return next;
}

export async function deleteLocalRegisteredMedicine(medicineId: string): Promise<RegisteredMedicine[]> {
  const [medicines, schedules, events] = await Promise.all([
    readJson<RegisteredMedicine[]>(registeredMedicinesKey, []),
    readJson<MedicineSchedule[]>(medicineSchedulesKey, []),
    readJson<MedicationEvent[]>(medicationEventsKey, [])
  ]);
  await AsyncStorage.setItem(registeredMedicinesKey, JSON.stringify(medicines.filter((medicine) => medicine.id !== medicineId)));
  await AsyncStorage.setItem(medicineSchedulesKey, JSON.stringify(schedules.filter((schedule) => schedule.medicineId !== medicineId)));
  await AsyncStorage.setItem(medicationEventsKey, JSON.stringify(events.filter((event) => event.medicineId !== medicineId)));
  return getLocalRegisteredMedicines();
}

export async function getLocalMedicineSchedules(profile?: FamilyProfile | null): Promise<MedicineSchedule[]> {
  const schedules = await readJson<MedicineSchedule[]>(medicineSchedulesKey, []);
  if (!profile?.profileId) return schedules;
  return schedules.filter((schedule) => !schedule.profileId || String(schedule.profileId) === String(profile.profileId));
}

export async function saveLocalMedicineSchedule(
  schedule: Omit<MedicineSchedule, "id" | "createdAt" | "updatedAt"> & Partial<Pick<MedicineSchedule, "id" | "createdAt" | "updatedAt">>
): Promise<MedicineSchedule[]> {
  const schedules = await readJson<MedicineSchedule[]>(medicineSchedulesKey, []);
  const now = new Date().toISOString();
  const nextSchedule: MedicineSchedule = {
    ...schedule,
    id: schedule.id ?? `local-schedule-${Date.now()}`,
    createdAt: schedule.createdAt ?? now,
    updatedAt: now
  };
  const next = [nextSchedule, ...schedules.filter((item) => item.id !== nextSchedule.id)];
  await AsyncStorage.setItem(medicineSchedulesKey, JSON.stringify(next));
  return next;
}

export async function getLocalMedicationEvents(profile?: FamilyProfile | null): Promise<MedicationEvent[]> {
  const events = await readJson<MedicationEvent[]>(medicationEventsKey, []);
  if (!profile?.profileId) return events;
  return events.filter((event) => !event.profileId || String(event.profileId) === String(profile.profileId));
}

export async function saveLocalMedicationEvent(
  event: Omit<MedicationEvent, "id"> & Partial<Pick<MedicationEvent, "id">>
): Promise<MedicationEvent[]> {
  const events = await readJson<MedicationEvent[]>(medicationEventsKey, []);
  const nextEvent: MedicationEvent = {
    ...event,
    id: event.id ?? `local-dose-${Date.now()}`
  };
  const next = [nextEvent, ...events.filter((item) => item.id !== nextEvent.id)];
  await AsyncStorage.setItem(medicationEventsKey, JSON.stringify(next));
  return next;
}

export async function clearLocalUserData(): Promise<void> {
  await AsyncStorage.multiRemove([
    familyProfilesKey,
    favoritePlacesKey,
    recentPlacesKey,
    registeredMedicinesKey,
    medicineSchedulesKey,
    medicationEventsKey
  ]);
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
