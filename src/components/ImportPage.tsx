import React from 'react';
import { PatchPage } from './PatchPage';
import { ProjectSummary } from '../types';

interface ImportPageProps {
  onStatusChange: (status: string, progress: number) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentProject: ProjectSummary | null;
}

export const ImportPage: React.FC<ImportPageProps> = (props) => {
  return <PatchPage {...props} />;
};
