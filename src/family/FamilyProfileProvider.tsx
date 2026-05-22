import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  FamilyProfile,
  getLocalFamilyProfiles,
  getSelectedFamilyProfileId,
  saveLocalFamilyProfile,
  setSelectedFamilyProfileId
} from "@/services/localUserData";
import { createFamilyProfile, fetchFamilyProfiles } from "@/services/serverApi";

type FamilyProfileContextValue = {
  profiles: FamilyProfile[];
  selectedProfile: FamilyProfile | null;
  loading: boolean;
  reloadProfiles: () => Promise<void>;
  selectProfile: (profileId: string | number) => Promise<void>;
  addProfile: (profile: Omit<FamilyProfile, "profileId">) => Promise<FamilyProfile>;
};

const FamilyProfileContext = createContext<FamilyProfileContextValue | null>(null);

export function FamilyProfileProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [selectedProfileId, setSelectedProfileIdState] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);

  const isMember = session?.mode === "member" && Boolean(session.userId);

  useEffect(() => {
    reloadProfiles().finally(() => setLoading(false));
  }, [session?.mode, session?.userId]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => String(profile.profileId) === String(selectedProfileId)) ?? profiles[0] ?? null,
    [profiles, selectedProfileId]
  );

  const reloadProfiles = async () => {
    const selectedId = await getSelectedFamilyProfileId();
    const localProfiles = await getLocalFamilyProfiles();
    const loadedProfiles = isMember && session?.userId ? await fetchFamilyProfiles(session.userId).catch(() => localProfiles) : localProfiles;
    const ensuredProfiles = loadedProfiles.length ? loadedProfiles : [await createDefaultSelfProfile()];
    setProfiles(ensuredProfiles);
    setSelectedProfileIdState(selectedId ?? ensuredProfiles[0]?.profileId ?? null);
  };

  const createDefaultSelfProfile = async () => {
    const payload = normalizeProfileDraft({ profileName: "나", relationType: "SELF", consentStatus: "LOCAL_ONLY" });
    const saved = isMember && session?.userId ? await createFamilyProfile(session.userId, payload) : await saveLocalFamilyProfile(payload);
    await setSelectedFamilyProfileId(saved.profileId);
    return saved;
  };

  const selectProfile = async (profileId: string | number) => {
    setSelectedProfileIdState(profileId);
    await setSelectedFamilyProfileId(profileId);
  };

  const addProfile = async (profile: Omit<FamilyProfile, "profileId">) => {
    const payload = normalizeProfileDraft(profile);
    const saved = isMember && session?.userId ? await createFamilyProfile(session.userId, payload) : await saveLocalFamilyProfile(payload);
    setProfiles((current) => [...current, saved]);
    setSelectedProfileIdState(saved.profileId);
    await setSelectedFamilyProfileId(saved.profileId);
    return saved;
  };

  const value = useMemo(
    () => ({
      profiles,
      selectedProfile,
      loading,
      reloadProfiles,
      selectProfile,
      addProfile
    }),
    [loading, profiles, selectedProfile]
  );

  return <FamilyProfileContext.Provider value={value}>{children}</FamilyProfileContext.Provider>;
}

export function useFamilyProfile() {
  const value = useContext(FamilyProfileContext);
  if (!value) {
    throw new Error("useFamilyProfile must be used inside FamilyProfileProvider");
  }
  return value;
}

function normalizeProfileDraft(profile: Omit<FamilyProfile, "profileId">) {
  return {
    ...profile,
    profileName: profile.profileName?.trim() || "가족",
    relationType: profile.relationType ?? "ETC",
    canView: profile.canView ?? true,
    canEdit: profile.canEdit ?? true,
    canReceiveAlert: profile.canReceiveAlert ?? false,
    canViewEmergency: profile.canViewEmergency ?? true,
    consentStatus: profile.consentStatus ?? (profile.relationType === "CHILD" || profile.relationType === "SELF" ? "LOCAL_ONLY" : "PENDING")
  };
}
