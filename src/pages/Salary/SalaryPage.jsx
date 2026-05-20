import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import SalaryAdminView from './SalaryAdminView';
import SalaryWorkerView from './SalaryWorkerView';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

/**
 * SalaryPage
 * Entry point for the Salary module. Branches to either Admin or Worker view.
 */
const SalaryPage = () => {
  const { role, loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  const isAdmin = role === 'admin' || role === 'super_admin';

  return (
    <div className="bg-gray-50/30 min-h-screen">
      {isAdmin ? <SalaryAdminView /> : <SalaryWorkerView />}
    </div>
  );
};

export default SalaryPage;
