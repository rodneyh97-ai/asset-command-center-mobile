import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ScoutingReport, OpponentPlayer } from '@/domain/types';
import { scoutingReportRepo } from '@/db/database';

interface ScoutingStore {
  reports: ScoutingReport[];
  activeReport: ScoutingReport | null;

  loadReportsForTeam(teamId: string): Promise<void>;
  setActiveReport(id: string | null): Promise<void>;

  createReport(data: {
    teamId: string;
    opponentName: string;
    matchDate?: string;
  }): Promise<ScoutingReport>;
  updateReport(report: ScoutingReport): Promise<void>;
  deleteReport(id: string): Promise<void>;

  addKeyPlayer(reportId: string, player: OpponentPlayer): Promise<void>;
  removeKeyPlayer(reportId: string, index: number): Promise<void>;
}

export const useScoutingStore = create<ScoutingStore>((set, get) => ({
  reports: [],
  activeReport: null,

  async loadReportsForTeam(teamId: string) {
    const reports = await scoutingReportRepo.getByTeam(teamId);
    set({ reports: reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  },

  async setActiveReport(id: string | null) {
    if (!id) {
      set({ activeReport: null });
      return;
    }
    const report = get().reports.find((r) => r.id === id) || (await scoutingReportRepo.get(id));
    if (report) set({ activeReport: report });
  },

  async createReport(data) {
    const now = new Date().toISOString();
    const report: ScoutingReport = {
      id: uuidv4(),
      teamId: data.teamId,
      opponentName: data.opponentName,
      matchDate: data.matchDate,
      status: 'draft',
      offenseNotes: '',
      defenseNotes: '',
      servingNotes: '',
      serveReceiveNotes: '',
      keyPlayers: [],
      tendencies: '',
      gameplan: '',
      createdAt: now,
      updatedAt: now,
    };
    await scoutingReportRepo.put(report);
    set({ reports: [report, ...get().reports] });
    return report;
  },

  async updateReport(report) {
    const updated = { ...report, updatedAt: new Date().toISOString() };
    await scoutingReportRepo.put(updated);
    set({
      reports: get().reports.map((r) => (r.id === updated.id ? updated : r)),
      activeReport: get().activeReport?.id === updated.id ? updated : get().activeReport,
    });
  },

  async deleteReport(id) {
    await scoutingReportRepo.delete(id);
    set({
      reports: get().reports.filter((r) => r.id !== id),
      activeReport: get().activeReport?.id === id ? null : get().activeReport,
    });
  },

  async addKeyPlayer(reportId, player) {
    const report = get().reports.find((r) => r.id === reportId);
    if (!report) return;
    const updated = {
      ...report,
      keyPlayers: [...report.keyPlayers, player],
      updatedAt: new Date().toISOString(),
    };
    await scoutingReportRepo.put(updated);
    set({
      reports: get().reports.map((r) => (r.id === updated.id ? updated : r)),
      activeReport: get().activeReport?.id === updated.id ? updated : get().activeReport,
    });
  },

  async removeKeyPlayer(reportId, index) {
    const report = get().reports.find((r) => r.id === reportId);
    if (!report) return;
    const updated = {
      ...report,
      keyPlayers: report.keyPlayers.filter((_, i) => i !== index),
      updatedAt: new Date().toISOString(),
    };
    await scoutingReportRepo.put(updated);
    set({
      reports: get().reports.map((r) => (r.id === updated.id ? updated : r)),
      activeReport: get().activeReport?.id === updated.id ? updated : get().activeReport,
    });
  },
}));
