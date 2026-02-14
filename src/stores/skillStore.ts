import { create } from "zustand";
import type { Skill, SkillSummary } from "@/types/skill";

interface SkillState {
  skills: SkillSummary[];
  activeSkillId: string | null;
  isLoading: boolean;

  setSkills: (skills: SkillSummary[]) => void;
  setActiveSkillId: (id: string | null) => void;
  addSkill: (skill: SkillSummary) => void;
  updateSkill: (id: string, data: Partial<SkillSummary>) => void;
  removeSkill: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useSkillStore = create<SkillState>((set) => ({
  skills: [],
  activeSkillId: null,
  isLoading: false,

  setSkills: (skills) => set({ skills }),

  setActiveSkillId: (activeSkillId) => set({ activeSkillId }),

  addSkill: (skill) =>
    set((s) => ({ skills: [skill, ...s.skills] })),

  updateSkill: (id, data) =>
    set((s) => ({
      skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...data } : sk)),
    })),

  removeSkill: (id) =>
    set((s) => ({
      skills: s.skills.filter((sk) => sk.id !== id),
      activeSkillId: s.activeSkillId === id ? null : s.activeSkillId,
    })),

  setLoading: (isLoading) => set({ isLoading }),
}));
