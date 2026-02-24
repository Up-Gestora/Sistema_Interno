import { useState } from 'react';
import Card from '../components/Card/Card';
import Modal from '../components/Modal/Modal';
import { useTeamMembers } from '../hooks/useTeamMembers';
import type { TeamMember, TeamMemberFormState } from '../types/teamMember';
import './MembrosPage.css';

const EMPTY_FORM: TeamMemberFormState = {
  nome: '',
  email: '',
  telefone: '',
  cargo: '',
  area: '',
};

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function MembrosPage() {
  const { members, setMembers } = useTeamMembers();
  const [form, setForm] = useState<TeamMemberFormState>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingMemberId(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setForm({
      nome: member.nome,
      email: member.email,
      telefone: member.telefone,
      cargo: member.cargo,
      area: member.area,
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingMemberId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleSaveMember = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const nome = form.nome.trim();
    if (!nome) {
      setError('Informe o nome do membro.');
      return;
    }

    const duplicate = members.some(
      (member) => member.id !== editingMemberId && member.nome.toLowerCase() === nome.toLowerCase(),
    );
    if (duplicate) {
      setError('Este membro ja esta cadastrado.');
      return;
    }

    if (editingMemberId) {
      setMembers((prev) =>
        prev.map((member) =>
          member.id === editingMemberId
            ? {
                ...member,
                nome,
                email: form.email.trim(),
                telefone: form.telefone.trim(),
                cargo: form.cargo.trim(),
                area: form.area.trim(),
              }
            : member,
        ),
      );
    } else {
      setMembers((prev) => [
        ...prev,
        {
          id: createId('membro'),
          nome,
          email: form.email.trim(),
          telefone: form.telefone.trim(),
          cargo: form.cargo.trim(),
          area: form.area.trim(),
        },
      ]);
    }

    closeModal();
  };

  const handleRemoveMember = (memberId: string) => {
    setMembers((prev) => prev.filter((member) => member.id !== memberId));
  };

  return (
    <div className="membros-page">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Membros/Equipe</h1>
          <p className="page-subtitle">
            Cadastro central de equipe para uso em projetos privados e outras funcionalidades.
          </p>
        </div>
        <button className="btn-novo-membro" onClick={openCreateModal}>
          + Novo Membro
        </button>
      </div>

      <Card title="Membros" className="membros-container">
        <div className="membros-table-container">
          <table className="membros-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>Cargo</th>
                <th>Area</th>
                <th className="actions-header">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    Nenhum membro cadastrado.
                  </td>
                </tr>
              ) : (
                [...members]
                  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
                  .map((member) => (
                    <tr key={member.id}>
                      <td className="nome-cell">{member.nome}</td>
                      <td>{member.email || '-'}</td>
                      <td>{member.telefone || '-'}</td>
                      <td>{member.cargo || '-'}</td>
                      <td>{member.area || '-'}</td>
                      <td className="actions-cell">
                        <div className="actions-buttons">
                          <button
                            type="button"
                            className="action-btn edit-btn"
                            onClick={() => openEditModal(member)}
                            title="Editar membro"
                            aria-label="Editar membro"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="action-btn delete-btn"
                            onClick={() => handleRemoveMember(member.id)}
                            title="Remover membro"
                            aria-label="Remover membro"
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingMemberId ? 'Editar Membro' : 'Novo Membro'}
        size="medium"
      >
        <form className="membros-form" onSubmit={handleSaveMember}>
          <div className="membros-form-row">
            <label>
              Nome completo *
              <input
                type="text"
                value={form.nome}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    nome: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="membros-form-row">
            <label>
              Telefone
              <input
                type="text"
                value={form.telefone}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    telefone: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Cargo / funcao
              <input
                type="text"
                value={form.cargo}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    cargo: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <label>
            Area / equipe
            <input
              type="text"
              value={form.area}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  area: event.target.value,
                }))
              }
            />
          </label>

          {error && <span className="membros-error">{error}</span>}

          <div className="membros-form-actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {editingMemberId ? 'Salvar alteracoes' : 'Salvar membro'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

