import React from 'react';
import { ConvertPage } from './ConvertPage';
import { ProjectSummary } from '../types';

interface ExportPageProps {
  onStatusChange: (status: string, progress: number) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onProjectLoaded?: (project: ProjectSummary) => void;
  onNavigateToPatch?: () => void;
}

export const ExportPage: React.FC<ExportPageProps> = (props) => {
  return <ConvertPage {...props} />;
};
