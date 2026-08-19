import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getLookups } from '../api/lookups';
import { getDepreciationMap, getPositionReport } from '../api/reports';

const currentPeriod = new Date().toISOString().slice(0, 7);
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const Reports = () => {
  const [companyId, setCompanyId] = useState('');
  const [period, setPeriod] = useState(currentPeriod);
  const [tab, setTab] = useState<'position' | 'map'>('position');
  const [groupBy, setGroupBy] = useState<'costCenter' | 'category' | 'branch'>('costCenter');

  const lookupsQuery = useQuery({
    queryKey: ['lookups'],
    queryFn: getLookups,
  });

  useEffect(() => {
    if (!companyId && lookupsQuery.data?.companies[0]) {
      setCompanyId(lookupsQuery.data.companies[0].id);
    }
  }, [companyId, lookupsQuery.data]);

  const positionQuery = useQuery({
    queryKey: ['position-report', companyId, period],
    queryFn: () => getPositionReport(period, companyId),
    enabled: Boolean(companyId),
  });

  const mapQuery = useQuery({
    queryKey: ['depreciation-map', companyId, period, groupBy],
    queryFn: () => getDepreciationMap(period, companyId, groupBy),
    enabled: Boolean(companyId),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Relatórios</h2>
          <p className="muted">Consulte a posição patrimonial e o mapa de depreciação por dimensão.</p>
        </div>
      </div>

      <div className="toolbar">
        <label className="field">
          <span>Empresa</span>
          <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
            <option value="">Selecione</option>
            {lookupsQuery.data?.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Período</span>
          <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>

        {tab === 'map' ? (
          <label className="field">
            <span>Agrupar por</span>
            <select
              value={groupBy}
              onChange={(event) =>
                setGroupBy(event.target.value as 'costCenter' | 'category' | 'branch')
              }
            >
              <option value="costCenter">Centro de custo</option>
              <option value="category">Categoria</option>
              <option value="branch">Filial</option>
            </select>
          </label>
        ) : null}
      </div>

      <div className="tabs">
        <button
          className={`tab${tab === 'position' ? ' active' : ''}`}
          type="button"
          onClick={() => setTab('position')}
        >
          Posição Patrimonial
        </button>
        <button
          className={`tab${tab === 'map' ? ' active' : ''}`}
          type="button"
          onClick={() => setTab('map')}
        >
          Mapa de Depreciação
        </button>
      </div>

      {tab === 'position' ? (
        <div className="panel">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Filial</th>
                  <th>Centro de custo</th>
                  <th>Bruto</th>
                  <th>Acumulada</th>
                  <th>Líquido</th>
                </tr>
              </thead>
              <tbody>
                {(positionQuery.data?.data ?? []).length === 0 ? (
                  <tr>
                    <td className="empty-state" colSpan={8}>
                      Nenhum dado para o período informado.
                    </td>
                  </tr>
                ) : (
                  positionQuery.data?.data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.code}</td>
                      <td>{item.description}</td>
                      <td>{item.category}</td>
                      <td>{item.branch ?? '-'}</td>
                      <td>{item.costCenter ?? '-'}</td>
                      <td>{currency.format(item.grossValue)}</td>
                      <td>{currency.format(item.accumDepr)}</td>
                      <td>{currency.format(item.netValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Qtd. ativos</th>
                  <th>Depreciação do período</th>
                  <th>Valor bruto</th>
                  <th>Valor líquido</th>
                </tr>
              </thead>
              <tbody>
                {(mapQuery.data?.data ?? []).length === 0 ? (
                  <tr>
                    <td className="empty-state" colSpan={5}>
                      Nenhum dado consolidado para o período informado.
                    </td>
                  </tr>
                ) : (
                  mapQuery.data?.data.map((item) => (
                    <tr key={item.group}>
                      <td>{item.group}</td>
                      <td>{item.assetCount}</td>
                      <td>{currency.format(item.depreciationAmount)}</td>
                      <td>{currency.format(item.grossValue)}</td>
                      <td>{currency.format(item.netValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default Reports;
