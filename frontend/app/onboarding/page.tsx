'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ProgressTracker } from '@/components/onboarding/progress-tracker';
import { Step1BusinessSetup } from '@/components/onboarding/step1-business-setup';
import { Step2CustomerRecords } from '@/components/onboarding/step2-customer-records';
import { Step3PurchaseHistory } from '@/components/onboarding/step3-purchase-history';
import { Step4Review } from '@/components/onboarding/step4-review';
import { Step5Processing } from '@/components/onboarding/step5-processing';
import { saveBusinessInfo, uploadCustomerCSV, uploadOrderCSV, startIngestion, getIngestionStatus } from '@/lib/api';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Business Setup Data
  const [businessData, setBusinessData] = useState({
    companyName: '',
    industry: '',
  });

  // Customer Records Data
  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [customerPreview, setCustomerPreview] = useState<{
    totalCustomers: number;
    columns: string[];
  } | null>(null);

  // Orders Data
  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [ordersPreview, setOrdersPreview] = useState<{
    totalOrders: number;
    dateRange: { start: string; end: string } | null;
  } | null>(null);

  const handleCustomerUpload = async (file: File | null) => {
    if (!file) {
      setCustomerFile(null);
      setCustomerPreview(null);
      return;
    }

    setCustomerFile(file);
    try {
      const result = await uploadCustomerCSV(file);
      setCustomerPreview(result.preview);
    } catch (error) {
      console.error('Error uploading customer CSV:', error);
      alert('Failed to upload customer CSV');
    }
  };

  const handleOrdersUpload = async (file: File | null) => {
    if (!file) {
      setOrdersFile(null);
      setOrdersPreview(null);
      return;
    }

    setOrdersFile(file);
    try {
      const result = await uploadOrderCSV(file);
      setOrdersPreview(result.preview);
    } catch (error) {
      console.error('Error uploading orders CSV:', error);
      alert('Failed to upload orders CSV');
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return businessData.companyName && businessData.industry;
      case 2:
        return customerFile !== null;
      case 3:
        return ordersFile !== null;
      case 4:
        return true;
      case 5:
        return false;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      try {
        const result = await saveBusinessInfo(businessData.companyName, businessData.industry);
        const savedCompanyId = result?.data?.id ?? null;

        if (savedCompanyId) {
          window.localStorage.setItem('xeno_company_id', savedCompanyId);
        }

        setCurrentStep(2);
      } catch (error) {
        console.error('Error saving business info:', error);
        alert('Failed to save business information');
      }
    } else if (currentStep === 4) {
      // Start ingestion process
      await startProcessing();
    } else if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const startProcessing = async () => {
    if (!customerFile || !ordersFile) return;

    setIsProcessing(true);
    setCurrentStep(5);

    try {
      const result = await startIngestion(customerFile, ordersFile);
      const sessionId = result.sessionId;

      // Poll for status
      const pollInterval = setInterval(async () => {
        const status = await getIngestionStatus(sessionId);

        if (status.step === 'completed') {
          clearInterval(pollInterval);
          setTimeout(() => {
            router.push('/opportunities');
          }, 2000);
        } else if (status.step === 'error') {
          clearInterval(pollInterval);
          alert('Ingestion failed: ' + status.message);
          setIsProcessing(false);
          setCurrentStep(4);
        }
      }, 1000);

    } catch (error) {
      console.error('Error starting ingestion:', error);
      alert('Failed to start ingestion');
      setIsProcessing(false);
      setCurrentStep(4);
    }
  };

  const steps = [
    { id: 1, name: 'Business Setup', status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'current' : 'upcoming' },
    { id: 2, name: 'Customer Records', status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'current' : 'upcoming' },
    { id: 3, name: 'Purchase History', status: currentStep > 3 ? 'completed' : currentStep === 3 ? 'current' : 'upcoming' },
    { id: 4, name: 'Review', status: currentStep > 4 ? 'completed' : currentStep === 4 ? 'current' : 'upcoming' },
    { id: 5, name: 'Processing', status: currentStep === 5 ? 'current' : 'upcoming' },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Xeno Grow</h1>
          <p className="text-gray-600">Let&apos;s get your growth engine set up</p>
        </div>

        {/* Progress Tracker */}
        <div className="mb-8">
          <ProgressTracker steps={steps} />
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {currentStep === 1 && (
            <Step1BusinessSetup
              data={businessData}
              onUpdate={(updates) => setBusinessData({ ...businessData, ...updates })}
            />
          )}

          {currentStep === 2 && (
            <Step2CustomerRecords
              onFileUpload={handleCustomerUpload}
              uploadedFile={customerFile}
              previewData={customerPreview}
            />
          )}

          {currentStep === 3 && (
            <Step3PurchaseHistory
              onFileUpload={handleOrdersUpload}
              uploadedFile={ordersFile}
              previewData={ordersPreview}
            />
          )}

          {currentStep === 4 && (
            <Step4Review
                data={{
                companyName: businessData.companyName,
                industry: businessData.industry,
                totalCustomers: customerPreview?.totalCustomers || 0,
                totalOrders: ordersPreview?.totalOrders || 0,
                productsDetected: 52,
              }}
            />
          )}

          {currentStep === 5 && (
            <Step5Processing onComplete={() => undefined} />
          )}
        </div>

        {/* Navigation Buttons */}
        {currentStep < 5 && (
          <div className="flex justify-between max-w-2xl mx-auto">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || isProcessing}
            >
              Back
            </Button>

              <Button
                onClick={handleNext}
                disabled={!canProceed() || isProcessing}
              >
              {currentStep === 4 ? 'Generate Opportunities' : 'Continue'}
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}
