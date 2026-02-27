export interface ReportCoverAdjustment {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ReportCoverItem {
  id: string;
  name: string;
  url: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  createdAt: string;
  adjustment: ReportCoverAdjustment;
}

