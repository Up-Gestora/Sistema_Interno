import { useEffect, useState } from 'react';
import type { TeamMember } from '../types/teamMember';

const MEMBERS_STORAGE_KEY = 'private_members_v2';
const LEGACY_MEMBERS_STORAGE_KEYS = ['private_members_v1'];
const DEFAULT_MEMBER_NAMES = ['Matheus', 'Igor', 'Vinicius', 'Mario', 'Davi'];

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeMember = (member: Partial<TeamMember>): TeamMember => ({
  id: typeof member.id === 'string' && member.id.trim() ? member.id : createId('membro'),
  nome: typeof member.nome === 'string' ? member.nome.trim() : '',
  email: typeof member.email === 'string' ? member.email.trim() : '',
  telefone: typeof member.telefone === 'string' ? member.telefone.trim() : '',
  cargo: typeof member.cargo === 'string' ? member.cargo.trim() : '',
  area: typeof member.area === 'string' ? member.area.trim() : '',
});

const buildDefaultMembers = (): TeamMember[] =>
  DEFAULT_MEMBER_NAMES.map((nome) => ({
    id: createId('membro'),
    nome,
    email: '',
    telefone: '',
    cargo: '',
    area: '',
  }));

const parseMembers = (raw: string | null): TeamMember[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Array<Partial<TeamMember>>;
    if (!Array.isArray(parsed)) return null;

    const normalized = parsed
      .map((item) => normalizeMember(item))
      .filter((item) => item.nome.trim());

    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
};

const loadMembers = (): TeamMember[] => {
  if (typeof window === 'undefined') return buildDefaultMembers();

  const current = parseMembers(localStorage.getItem(MEMBERS_STORAGE_KEY));
  if (current) return current;

  for (const key of LEGACY_MEMBERS_STORAGE_KEYS) {
    const legacy = parseMembers(localStorage.getItem(key));
    if (legacy) return legacy;
  }

  return buildDefaultMembers();
};

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>(loadMembers);

  useEffect(() => {
    localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(members));
  }, [members]);

  return {
    members,
    setMembers,
  };
}

