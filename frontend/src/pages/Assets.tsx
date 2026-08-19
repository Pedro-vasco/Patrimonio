import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { getAssets } from '../api/assets';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const Assets = () => {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const assetsQuery = useQuery({
    queryKey: ['assets', status],
    queryFn: () => getAssets({ page: 1, pageSize: 50, status: status || undefined }),
  });

  const assets = useMemo(() => {
    const list = assetsQuery.data?.data ?? [];
    if (!search) {
      return list;
    }

    const normalizedSearch = search.toLowerCase();
    return list.filter(
      (asset) =>
        asset.assetCode.toLowerCase().includes(normalizedSearch) ||
        asset.description.toLowerCase().includes(normalizedSearch),
    );
  }, [assetsQuery.data, search]);

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Ativos</h2>
          <p className="muted">Liste, filtre e edite os bens cadastrados.</p>
        </div>
        <Link className="button" to="/assets/new">
          Novo ativo
        </Link>
      </div>

      <div className="filters">
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="FULLY_DEPRECIATED">Totalmente depreciado</option>
            <option value="DISPOSED">Baixado</option>
          </select>
        </label>
        <label className="field">
          <span>Busca</span>
          <input
            value={search}
            placeholder="Código ou descrição"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="panel">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Filial</th>
                <th>Status</th>
                <th>Valor líquido</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={7}>
                    Nenhum ativo encontrado.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>{asset.assetCode}</td>
                    <td>{asset.description}</td>
                    <td>{asset.category?.name ?? '-'}</td>
                    <td>{asset.branch?.name ?? '-'}</td>
                    <td>
                      <span className="badge">{asset.status}</span>
                    </td>
                    <td>{currency.format(Number(asset.netBookValue))}</td>
                    <td>
                      <Link className="button secondary" to={`/assets/${asset.id}/edit`}>
                        Editar
                      </Link>
                    </td>
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

export default Assets;
