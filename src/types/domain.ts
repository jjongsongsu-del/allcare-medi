export type Pill = {
  id: string;
  productName: string;
  manufacturer: string;
  ingredient: string;
  shape: string;
  color: string;
  imprint: string;
  confidence: number;
  warnings: string[];
};

export type MedicalFacility = {
  id: string;
  name: string;
  type: "pharmacy" | "clinic" | "hospital" | "screening" | "emergency";
  department?: string;
  distanceKm: number;
  isOpen: boolean;
  hours: string;
  operatingStatus: "open_expected" | "closed_expected" | "unknown";
  closesAt?: string;
  closingSoonMinutes?: number;
  lastUpdated?: string;
  holidayCare: boolean;
  nightCare: boolean;
  hasPhone: boolean;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  tags: string[];
};

export type HealthContent = {
  id: string;
  title: string;
  category: string;
  lifeStage: string;
  summary: string;
};

export type MedicationSchedule = {
  id: string;
  pillName: string;
  time: string;
  instruction: string;
  adherenceRate: number;
  familyShared: boolean;
};

export type MedicineStatus = "taking" | "scheduled" | "ended";
export type MedicineRegistrationSource = "manual" | "search" | "prescription" | "ai";
export type MedicineDoseStatus = "pending" | "taken" | "skipped" | "delayed";

export type MedicineSearchResult = {
  id: string;
  name: string;
  productName?: string;
  ingredient?: string;
  manufacturer?: string;
  dosage?: string;
  form?: string;
  color?: string;
  imprint?: string;
  imageUrl?: string;
  efficacy?: string;
  usage?: string;
  caution?: string;
  interaction?: string;
  sideEffects?: string;
  storageMethod?: string;
  source: "e_drug" | "fallback";
};

export type PrescriptionOcrMedicine = {
  name: string;
  dosage?: string;
  form?: string;
  purpose?: string;
  usage?: string;
  timing?: string;
  timesPerDay?: number;
  doseTimes: string[];
  durationDays?: number | null;
  memo?: string;
  confidence?: number | null;
};

export type PrescriptionOcrResult = {
  provider: string;
  rawText: string;
  common: {
    patientName?: string | null;
    prescribedOn?: string | null;
    hospitalName?: string | null;
    doctorName?: string | null;
  };
  medicines: PrescriptionOcrMedicine[];
  message?: string | null;
};

export type RegisteredMedicine = {
  id: string;
  userId?: number | null;
  profileId?: string | number | null;
  profileName?: string | null;
  name: string;
  alias?: string;
  productName?: string;
  ingredient?: string;
  manufacturer?: string;
  dosage?: string;
  form?: string;
  color?: string;
  imprint?: string;
  imageUrl?: string;
  purpose?: string;
  schedule?: string;
  takingMethod?: string;
  timing?: string;
  memo?: string;
  caution?: string;
  sideEffects?: string;
  storageMethod?: string;
  durWarnings?: string[];
  status: MedicineStatus;
  source: MedicineRegistrationSource;
  favorite: boolean;
  highRisk: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MedicineSchedule = {
  id: string;
  medicineId: string;
  profileId?: string | number | null;
  doseAmount: string;
  doseMethod: string;
  doseTiming: string;
  purpose?: string;
  timesPerDay: number;
  doseTimes: string[];
  startDate: string;
  endDate?: string | null;
  durationDays?: number | null;
  repeatRule: "daily" | "weekly" | "alternate_day" | "as_needed";
  notifyEnabled: boolean;
  notificationLevel: "normal" | "strong";
  createdAt: string;
  updatedAt: string;
};

export type MedicationEvent = {
  id: string;
  medicineId: string;
  scheduleId?: string | null;
  profileId?: string | number | null;
  scheduledAt: string;
  status: MedicineDoseStatus;
  takenAt?: string | null;
  sharedWithGuardian: boolean;
  memo?: string;
};

export type EmergencyRoom = {
  id: string;
  name: string;
  centerType: string;
  address: string;
  distanceKm: number;
  availableBeds: number;
  emergencyGeneralBeds: number;
  operatingRooms: number;
  icuBeds: number;
  inpatientBeds: number;
  pediatricBeds: number;
  negativeIsolationBeds: number;
  generalIsolationBeds: number;
  emergencyIcuBeds: number;
  pediatricIcuBeds: number;
  emergencyInpatientBeds: number;
  pediatricInpatientBeds: number;
  deliveryRoomBeds: number;
  traumaResuscitationBeds: number;
  traumaCareAreaBeds: number;
  pediatricEmergency: boolean;
  deliveryRoom: boolean;
  isolationRoom: boolean;
  severeCare: boolean;
  ctAvailable: boolean;
  mriAvailable: boolean;
  angiographyAvailable: boolean;
  ventilatorAvailable: boolean;
  ambulanceAvailable: boolean;
  doctorOnDuty?: string;
  emergencyDirectPhone?: string;
  pediatricDirectPhone?: string;
  dataNote: string;
  updatedAt: string;
  phone: string;
  emergencyPhone?: string;
  latitude?: number;
  longitude?: number;
};
