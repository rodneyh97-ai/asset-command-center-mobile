import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { FilmClip, FilmSession, ClipTag } from '@/domain/types';
import { filmClipRepo, filmSessionRepo } from '@/db/database';

interface FilmStore {
  clips: FilmClip[];
  sessions: FilmSession[];
  activeSession: FilmSession | null;

  loadClipsForMatch(matchId: string): Promise<void>;
  loadSessionsForTeam(teamId: string): Promise<void>;
  setActiveSession(id: string | null): Promise<void>;

  createSession(data: {
    teamId: string;
    matchId: string;
    filmUrl: string;
    title: string;
  }): Promise<FilmSession>;
  updateSession(session: FilmSession): Promise<void>;
  deleteSession(id: string): Promise<void>;

  addClip(data: {
    matchId: string;
    filmUrl: string;
    startSeconds: number;
    endSeconds?: number;
    tag: ClipTag;
    label: string;
    playerId?: string;
    setNumber: number;
    score: string;
    eventId?: string;
    notes: string;
  }): Promise<FilmClip>;
  updateClip(clip: FilmClip): Promise<void>;
  deleteClip(id: string): Promise<void>;
}

export const useFilmStore = create<FilmStore>((set, get) => ({
  clips: [],
  sessions: [],
  activeSession: null,

  async loadClipsForMatch(matchId: string) {
    const clips = await filmClipRepo.getByMatch(matchId);
    set({ clips: clips.sort((a, b) => a.startSeconds - b.startSeconds) });
  },

  async loadSessionsForTeam(teamId: string) {
    const sessions = await filmSessionRepo.getByTeam(teamId);
    set({ sessions: sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  },

  async setActiveSession(id: string | null) {
    if (!id) {
      set({ activeSession: null });
      return;
    }
    const session = get().sessions.find((s) => s.id === id) || (await filmSessionRepo.get(id));
    if (session) {
      const clips = await filmClipRepo.getByMatch(session.matchId);
      set({
        activeSession: session,
        clips: clips.sort((a, b) => a.startSeconds - b.startSeconds),
      });
    }
  },

  async createSession(data) {
    const now = new Date().toISOString();
    const session: FilmSession = {
      id: uuidv4(),
      teamId: data.teamId,
      matchId: data.matchId,
      filmUrl: data.filmUrl,
      title: data.title,
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    await filmSessionRepo.put(session);
    set({ sessions: [session, ...get().sessions] });
    return session;
  },

  async updateSession(session) {
    const updated = { ...session, updatedAt: new Date().toISOString() };
    await filmSessionRepo.put(updated);
    set({
      sessions: get().sessions.map((s) => (s.id === updated.id ? updated : s)),
      activeSession: get().activeSession?.id === updated.id ? updated : get().activeSession,
    });
  },

  async deleteSession(id) {
    await filmSessionRepo.delete(id);
    const clips = await filmClipRepo.getByMatch(
      get().sessions.find((s) => s.id === id)?.matchId || ''
    );
    for (const clip of clips) {
      await filmClipRepo.delete(clip.id);
    }
    set({
      sessions: get().sessions.filter((s) => s.id !== id),
      activeSession: get().activeSession?.id === id ? null : get().activeSession,
    });
  },

  async addClip(data) {
    const clip: FilmClip = {
      id: uuidv4(),
      matchId: data.matchId,
      filmUrl: data.filmUrl,
      startSeconds: data.startSeconds,
      endSeconds: data.endSeconds,
      tag: data.tag,
      label: data.label,
      playerId: data.playerId,
      setNumber: data.setNumber,
      score: data.score,
      eventId: data.eventId,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };
    await filmClipRepo.put(clip);
    const updated = [...get().clips, clip].sort((a, b) => a.startSeconds - b.startSeconds);
    set({ clips: updated });
    return clip;
  },

  async updateClip(clip) {
    await filmClipRepo.put(clip);
    set({ clips: get().clips.map((c) => (c.id === clip.id ? clip : c)) });
  },

  async deleteClip(id) {
    await filmClipRepo.delete(id);
    set({ clips: get().clips.filter((c) => c.id !== id) });
  },
}));
