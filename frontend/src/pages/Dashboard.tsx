import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getLookups } from '../api/lookups';
import { getPositionReport } from '../api/reports';

const currentPeriod = new Date().toISOString().slice(0, 7);
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const Dashboard = () => {
  const [companyId, setCompanyId] = useState('');
  const [period, setPeriod] = useState(currentPeriod);

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
    queryKey: ['dashboard-position', companyId, period],
    queryFn: () => getPositionReport(period, companyId),
    enabled: Boolean(companyId),
  });

  const totals = useMemo(() => {
    const items = positionQuery.data?.data ?? [];
    return items.reduce(
      (accumulator, item) => ({
        totalAssets: accumulator.totalAssets + 1,
        grossValue: accumulator.grossValue + item.grossValue,
        accumDepr: accumulator.accumDepr + item.accumDepr,
        netValue: accumulator.netValue + item.netValue,
      }),
      {
        totalAssets: 0,
        grossValue: 0,
        accumDepr: 0,
        netValue: 0,
      },
    );
  }, [positionQuery.data]);

  const topCategories = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const item of positionQuery.data?.data ?? []) {
      grouped.set(item.category, (grouped.get(item.category) ?? 0) + item.netValue);
    }
    return [...grouped.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value);
  }, [positionQuery.data]);

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Dashboard patrimonial</h2>
          <p className="muted">Acompanhe KPIs do período e a distribuição dos ativos.</p>
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
      </div>

      {positionQuery.error ? (
        <div className="error-box">Não foi possível carregar os indicadores.</div>
      ) : null}

      <div className="card-grid">
        <div className="card">
          <div className="muted">Total de ativos</div>
          <div className="kpi-value">{totals.totalAssets}</div>
        </div>
        <div className="card">
          <div className="muted">Valor bruto</div>
          <div className="kpi-value">{currency.format(totals.grossValue)}</div>
        </div>
        <div className="card">
          <div className="muted">Depreciação acumulada</div>
          <div className="kpi-value">{currency.format(totals.accumDepr)}</div>
        </div>
        <div className="card">
          <div className="muted">Valor líquido</div>
          <div className="kpi-value">{currency.format(totals.netValue)}</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Maior valor líquido por categoria</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Valor líquido</th>
              </tr>
            </thead>
            <tbody>
              {topCategories.length === 0 ? (
                <tr>
                  <td colSpan={2} className="empty-state">
                    Nenhum ativo disponível para o período selecionado.
                  </td>
                </tr>
              ) : (
                topCategories.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{currency.format(item.value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
