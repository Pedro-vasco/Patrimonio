import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import AssetForm from './pages/AssetForm';
import Assets from './pages/Assets';
import Dashboard from './pages/Dashboard';
import DepreciationRun from './pages/DepreciationRun';
import Reports from './pages/Reports';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/assets/new" element={<AssetForm />} />
        <Route path="/assets/:id/edit" element={<AssetForm />} />
        <Route path="/depreciation" element={<DepreciationRun />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
