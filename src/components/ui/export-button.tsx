'use client';

import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { ExportConfig } from '@/lib/export';

interface ExportButtonProps {
  getExportConfig: () => ExportConfig;
  disabled?: boolean;
}

export function ExportButton({ getExportConfig, disabled }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      setIsExporting(true);
      const config = getExportConfig();

      if (config.data.length === 0) {
        toast.error('내보낼 데이터가 없습니다');
        return;
      }

      const { exportToCSV, exportToExcel, exportToPDF } = await import('@/lib/export');

      switch (format) {
        case 'csv':
          exportToCSV(config);
          toast.success('CSV 파일이 다운로드되었습니다');
          break;
        case 'xlsx':
          await exportToExcel(config);
          toast.success('Excel 파일이 다운로드되었습니다');
          break;
        case 'pdf':
          await exportToPDF(config);
          toast.success('PDF 파일이 다운로드되었습니다');
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('내보내기에 실패했습니다');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || isExporting} aria-label="내보내기">
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          내보내기
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>파일 형식 선택</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="w-4 h-4 mr-2" />
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('xlsx')}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileDown className="w-4 h-4 mr-2" />
          PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
