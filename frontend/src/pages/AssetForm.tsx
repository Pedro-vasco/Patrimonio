import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { createAsset, getAsset, updateAsset } from '../api/assets';
import { getLookups } from '../api/lookups';

const today = new Date().toISOString().slice(0, 10);

const AssetForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    companyId: '',
    branchId: '',
    costCenterId: '',
    assetCode: '',
    description: '',
    categoryId: '',
    acquisitionDate: today,
    inServiceDate: today,
    acquisitionValue: '',
    residualValue: '',
    usefulLifeMonths: '',
    status: 'ACTIVE',
  });

  const lookupsQuery = useQuery({
    queryKey: ['lookups'],
    queryFn: getLookups,
  });

  const assetQuery = useQuery({
    queryKey: ['asset', id],
    queryFn: () => getAsset(id as string),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!form.companyId && lookupsQuery.data?.companies[0]) {
      setForm((current) => ({
        ...current,
        companyId: lookupsQuery.data?.companies[0].id ?? '',
      }));
    }
  }, [form.companyId, lookupsQuery.data]);

  useEffect(() => {
    if (assetQuery.data) {
      setForm({
        companyId: assetQuery.data.companyId,
        branchId: assetQuery.data.branchId ?? '',
        costCenterId: assetQuery.data.costCenterId ?? '',
        assetCode: assetQuery.data.assetCode,
        description: assetQuery.data.description,
        categoryId: assetQuery.data.categoryId,
        acquisitionDate: assetQuery.data.acquisitionDate.slice(0, 10),
        inServiceDate: assetQuery.data.inServiceDate.slice(0, 10),
        acquisitionValue: String(assetQuery.data.acquisitionValue),
        residualValue: String(assetQuery.data.residualValue),
        usefulLifeMonths: String(assetQuery.data.usefulLifeMonths),
        status: assetQuery.data.status,
      });
    }
  }, [assetQuery.data]);

  const filteredLookups = useMemo(() => {
    const companyId = form.companyId;
    return {
      branches: lookupsQuery.data?.branches.filter((item) => item.companyId === companyId) ?? [],
      costCenters:
        lookupsQuery.data?.costCenters.filter((item) => item.companyId === companyId) ?? [],
      categories:
        lookupsQuery.data?.categories.filter((item) => item.companyId === companyId) ?? [],
    };
  }, [form.companyId, lookupsQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        companyId: form.companyId,
        branchId: form.branchId || undefined,
        costCenterId: form.costCenterId || undefined,
        assetCode: form.assetCode,
        description: form.description,
        categoryId: form.categoryId,
        acquisitionDate: form.acquisitionDate,
        inServiceDate: form.inServiceDate,
        acquisitionValue: Number(form.acquisitionValue),
        residualValue: form.residualValue ? Number(form.residualValue) : undefined,
        usefulLifeMonths: form.usefulLifeMonths ? Number(form.usefulLifeMonths) : undefined,
        status: form.status,
      };

      if (isEdit) {
        return updateAsset(id as string, payload);
      }

      return createAsset(payload);
    },
    onSuccess: () => {
      navigate('/assets');
    },
    onError: () => {
      setErrorMessage('Não foi possível salvar o ativo.');
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    mutation.mutate();
  };

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>{isEdit ? 'Editar ativo' : 'Novo ativo'}</h2>
          <p className="muted">Preencha os dados principais do bem patrimonial.</p>
        </div>
      </div>

      {errorMessage ? <div className="error-box">{errorMessage}</div> : null}

      <form className="panel" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="field">
            <span>Empresa</span>
            <select
              value={form.companyId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  companyId: event.target.value,
                  branchId: '',
                  costCenterId: '',
                  categoryId: '',
                }))
              }
              required
            >
              <option value="">Selecione</option>
              {lookupsQuery.data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Código do ativo</span>
            <input
              value={form.assetCode}
              onChange={(event) => setForm((current) => ({ ...current, assetCode: event.target.value }))}
              required
            />
          </label>

          <label className="field">
            <span>Descrição</span>
            <input
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              required
            />
          </label>

          <label className="field">
            <span>Categoria</span>
            <select
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryId: event.target.value }))
              }
              required
            >
              <option value="">Selecione</option>
              {filteredLookups.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Filial</span>
            <select
              value={form.branchId}
              onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}
            >
              <option value="">Sem filial</option>
              {filteredLookups.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Centro de custo</span>
            <select
              value={form.costCenterId}
              onChange={(event) =>
                setForm((current) => ({ ...current, costCenterId: event.target.value }))
              }
            >
              <option value="">Sem centro de custo</option>
              {filteredLookups.costCenters.map((costCenter) => (
                <option key={costCenter.id} value={costCenter.id}>
                  {costCenter.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Data de aquisição</span>
            <input
              type="date"
              value={form.acquisitionDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, acquisitionDate: event.target.value }))
              }
              required
            />
          </label>

          <label className="field">
            <span>Data de entrada em operação</span>
            <input
              type="date"
              value={form.inServiceDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, inServiceDate: event.target.value }))
              }
              required
            />
          </label>

          <label className="field">
            <span>Valor de aquisição</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.acquisitionValue}
              onChange={(event) =>
                setForm((current) => ({ ...current, acquisitionValue: event.target.value }))
              }
              required
            />
          </label>

          <label className="field">
            <span>Valor residual</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.residualValue}
              onChange={(event) =>
                setForm((current) => ({ ...current, residualValue: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Vida útil (meses)</span>
            <input
              type="number"
              min="1"
              value={form.usefulLifeMonths}
              onChange={(event) =>
                setForm((current) => ({ ...current, usefulLifeMonths: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="ACTIVE">Ativo</option>
              <option value="FULLY_DEPRECIATED">Totalmente depreciado</option>
              <option value="DISPOSED">Baixado</option>
            </select>
          </label>
        </div>

        <div className="actions">
          <button className="button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Salvar ativo'}
          </button>
          <Link className="button secondary" to="/assets">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
};

export default AssetForm;
