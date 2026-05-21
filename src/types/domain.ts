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

export type EmergencyRoom = {
  id: string;
  name: string;
  distanceKm: number;
  availableBeds: number;
  pediatricEmergency: boolean;
  deliveryRoom: boolean;
  isolationRoom: boolean;
  phone: string;
};
