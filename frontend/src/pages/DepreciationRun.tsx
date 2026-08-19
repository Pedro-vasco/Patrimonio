import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { getDepreciationRuns, runDepreciation } from '../api/depreciation';
import { getLookups } from '../api/lookups';

const currentPeriod = new Date().toISOString().slice(0, 7);
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const DepreciationRun = () => {
  const [companyId, setCompanyId] = useState('');
  const [period, setPeriod] = useState(currentPeriod);
  const [bookType, setBookType] = useState('CONTABIL');
  const [errorMessage, setErrorMessage] = useState('');

  const lookupsQuery = useQuery({
    queryKey: ['lookups'],
    queryFn: getLookups,
  });

  useEffect(() => {
    if (!companyId && lookupsQuery.data?.companies[0]) {
      setCompanyId(lookupsQuery.data.companies[0].id);
    }
  }, [companyId, lookupsQuery.data]);

  const runsQuery = useQuery({
    queryKey: ['depreciation-runs'],
    queryFn: () => getDepreciationRuns(),
  });

  const mutation = useMutation({
    mutationFn: () => runDepreciation({ companyId, period, bookType }),
    onSuccess: () => {
      setErrorMessage('');
      runsQuery.refetch();
    },
    onError: () => {
      setErrorMessage('A execução falhou. Verifique se o período já não foi processado.');
    },
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Rodar depreciação</h2>
          <p className="muted">Execute o motor de depreciação linear para um período contábil.</p>
        </div>
      </div>

      {errorMessage ? <div className="error-box">{errorMessage}</div> : null}

      <div className="panel">
        <div className="form-grid">
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
          <label className="field">
            <span>Livro</span>
            <select value={bookType} onChange={(event) => setBookType(event.target.value)}>
              <option value="CONTABIL">CONTÁBIL</option>
              <option value="GERENCIAL">GERENCIAL</option>
            </select>
          </label>
        </div>

        <div className="actions">
          <button className="button" type="button" disabled={mutation.isPending || !companyId} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Executando...' : 'Executar depreciação'}
          </button>
        </div>
      </div>

      {mutation.data?.entries?.length ? (
        <div className="panel" style={{ marginTop: 20 }}>
          <h3>Última execução</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Ativo</th>
                  <th>Período</th>
                  <th>Depreciação</th>
                  <th>Valor líquido final</th>
                </tr>
              </thead>
              <tbody>
                {mutation.data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.asset?.assetCode ?? entry.assetId}</td>
                    <td>{entry.period}</td>
                    <td>{currency.format(Number(entry.deprAmount))}</td>
                    <td>{currency.format(Number(entry.closingNetValue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Execuções recentes</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Empresa</th>
                <th>Status</th>
                <th>Livro</th>
                <th>Itens</th>
              </tr>
            </thead>
            <tbody>
              {(runsQuery.data?.data ?? []).length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={5}>
                    Nenhuma execução encontrada.
                  </td>
                </tr>
              ) : (
                runsQuery.data?.data.map((run) => (
                  <tr key={run.id}>
                    <td>{run.period}</td>
                    <td>{run.company?.name ?? run.companyId}</td>
                    <td>
                      <span className="badge">{run.status}</span>
                    </td>
                    <td>{run.bookType}</td>
                    <td>{run._count?.entries ?? run.entries?.length ?? 0}</td>
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

export default DepreciationRun;
