'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle2, FileText } from 'lucide-react';
import { useState } from 'react';

interface CustomerRecordsProps {
  onFileUpload: (file: File | null) => void;
  uploadedFile: File | null;
  previewData: {
    totalCustomers: number;
    columns: string[];
  } | null;
}

export function Step2CustomerRecords({
  onFileUpload,
  uploadedFile,
  previewData,
}: CustomerRecordsProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Customer Records</CardTitle>
        <CardDescription>
          Upload your customer data in CSV format
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!uploadedFile ? (
          <div
            className={`relative border-2 border-dashed rounded-lg p-12 text-center hover:border-gray-400 transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-semibold text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">CSV file with customer data</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-900">{uploadedFile.name}</span>
                  </div>
                  <button
                    onClick={() => onFileUpload(null)}
                    className="text-xs text-green-600 hover:text-green-700 font-medium"
                  >
                    Change
                  </button>
                </div>
                {previewData && (
                  <div className="mt-2 text-sm text-green-700">
                    ✓ {previewData.totalCustomers.toLocaleString()} customers detected
                  </div>
                )}
              </div>
            </div>

            {previewData && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Detected Columns:</h4>
                <div className="flex flex-wrap gap-2">
                  {previewData.columns.map((col) => (
                    <span
                      key={col}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Expected CSV Format:</h4>
          <code className="text-xs text-blue-700 block">
            customer_id, first_name, last_name, email, phone, city, state, signup_date
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
