import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { RecruitingProfile, SharingVisibility } from '@/domain/types';
import { recruitingProfileRepo } from '@/db/database';

interface RecruitingState {
  profiles: RecruitingProfile[];
  activeProfile: RecruitingProfile | null;
  loading: boolean;

  loadProfilesForTeam: (teamId: string) => Promise<void>;
  getProfileForPlayer: (playerId: string) => Promise<RecruitingProfile | undefined>;
  setActiveProfile: (profile: RecruitingProfile | null) => void;
  createProfile: (teamId: string, playerId: string, data: Partial<RecruitingProfile>) => Promise<RecruitingProfile>;
  updateProfile: (id: string, updates: Partial<RecruitingProfile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setVisibility: (id: string, visibility: SharingVisibility) => Promise<void>;
  addSchool: (id: string, school: string) => Promise<void>;
  removeSchool: (id: string, school: string) => Promise<void>;
  linkHighlightReel: (id: string, reelId: string) => Promise<void>;
  unlinkHighlightReel: (id: string, reelId: string) => Promise<void>;
}

export const useRecruitingStore = create<RecruitingState>((set, get) => ({
  profiles: [],
  activeProfile: null,
  loading: false,

  loadProfilesForTeam: async (teamId) => {
    set({ loading: true });
    const profiles = await recruitingProfileRepo.getByTeam(teamId);
    set({ profiles, loading: false });
  },

  getProfileForPlayer: async (playerId) => {
    const profiles = await recruitingProfileRepo.getByPlayer(playerId);
    return profiles[0];
  },

  setActiveProfile: (profile) => set({ activeProfile: profile }),

  createProfile: async (teamId, playerId, data) => {
    const now = new Date().toISOString();
    const profile: RecruitingProfile = {
      id: uuidv4(),
      playerId,
      teamId,
      graduationYear: data.graduationYear || new Date().getFullYear() + 1,
      gpa: data.gpa,
      height: data.height,
      reach: data.reach,
      verticalJump: data.verticalJump,
      clubName: data.clubName,
      contactEmail: data.contactEmail,
      guardianEmail: data.guardianEmail,
      guardianApproved: false,
      visibility: 'private',
      bio: data.bio || '',
      interestedSchools: data.interestedSchools || [],
      highlightReelIds: data.highlightReelIds || [],
      createdAt: now,
      updatedAt: now,
    };
    await recruitingProfileRepo.put(profile);
    set((s) => ({ profiles: [...s.profiles, profile] }));
    return profile;
  },

  updateProfile: async (id, updates) => {
    const existing = await recruitingProfileRepo.get(id);
    if (!existing) return;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await recruitingProfileRepo.put(updated);
    set((s) => ({
      profiles: s.profiles.map((p) => (p.id === id ? updated : p)),
      activeProfile: s.activeProfile?.id === id ? updated : s.activeProfile,
    }));
  },

  deleteProfile: async (id) => {
    await recruitingProfileRepo.delete(id);
    set((s) => ({
      profiles: s.profiles.filter((p) => p.id !== id),
      activeProfile: s.activeProfile?.id === id ? null : s.activeProfile,
    }));
  },

  setVisibility: async (id, visibility) => {
    await get().updateProfile(id, { visibility });
  },

  addSchool: async (id, school) => {
    const profile = get().profiles.find((p) => p.id === id);
    if (!profile) return;
    if (profile.interestedSchools.includes(school)) return;
    await get().updateProfile(id, {
      interestedSchools: [...profile.interestedSchools, school],
    });
  },

  removeSchool: async (id, school) => {
    const profile = get().profiles.find((p) => p.id === id);
    if (!profile) return;
    await get().updateProfile(id, {
      interestedSchools: profile.interestedSchools.filter((s) => s !== school),
    });
  },

  linkHighlightReel: async (id, reelId) => {
    const profile = get().profiles.find((p) => p.id === id);
    if (!profile || profile.highlightReelIds.includes(reelId)) return;
    await get().updateProfile(id, {
      highlightReelIds: [...profile.highlightReelIds, reelId],
    });
  },

  unlinkHighlightReel: async (id, reelId) => {
    const profile = get().profiles.find((p) => p.id === id);
    if (!profile) return;
    await get().updateProfile(id, {
      highlightReelIds: profile.highlightReelIds.filter((r) => r !== reelId),
    });
  },
}));
