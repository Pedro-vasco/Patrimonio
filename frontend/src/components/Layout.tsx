import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Ativos', to: '/assets' },
  { label: 'Rodar Depreciação', to: '/depreciation' },
  { label: 'Relatórios', to: '/reports' },
];

const Layout = () => (
  <div className="app-shell">
    <aside className="sidebar">
      <h1>Patrimônio</h1>
      <nav className="nav-list">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
    <main className="content">
      <Outlet />
    </main>
  </div>
);

export default Layout;
