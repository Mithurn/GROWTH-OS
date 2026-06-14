'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Users, Target, Zap } from 'lucide-react';
import { useEffect, useState, use } from 'react';
import { getOpportunityCustomers } from '@/lib/api';

export default function OpportunityDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const pathname = usePathname();
  const resolvedParams = use(params);
  const opportunityId = resolvedParams.id;
  
  const [opportunityTitle, setOpportunityTitle] = useState('Loading Opportunity...');
  const [opportunityStats, setOpportunityStats] = useState({ customers: 0, value: 0 });

  useEffect(() => {
    async function fetchOpp() {
      try {
        const res = await getOpportunityCustomers(opportunityId);
        if (res.success && res.data?.opportunity) {
          setOpportunityTitle(res.data.opportunity.title);
          setOpportunityStats({
            customers: res.data.opportunity.audience_size,
            value: res.data.opportunity.potential_revenue,
          });
        }
      } catch (e) {
        setOpportunityTitle('Opportunity Details');
      }
    }
    fetchOpp();
  }, [opportunityId]);

  const tabs = [
    { name: 'Overview', href: `/opportunities/${opportunityId}`, icon: Target },
    { name: 'Customer Intelligence', href: `/opportunities/${opportunityId}/intelligence`, icon: Users },
    { name: 'Campaign Strategy', href: `/opportunities/${opportunityId}/campaign`, icon: Zap },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#FAFAFA]">
      {/* Sub-Navigation Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            
            {/* Left: Breadcrumbs & Title */}
            <div className="flex items-center gap-3 w-1/3">
              <Link 
                href="/opportunities" 
                className="text-[#6B7280] hover:text-[#1A1A1A] transition-colors flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Opportunities
              </Link>
              <div className="h-4 w-[1px] bg-[#E5E7EB] mx-1"></div>
              <h1 className="text-[14px] font-bold text-[#1A1A1A] truncate pr-4">
                {opportunityTitle}
              </h1>
            </div>

            {/* Center: Tabs */}
            <div className="flex items-center justify-center gap-1.5 w-1/3">
              {tabs.map((tab) => {
                const isActive = pathname === tab.href;
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.name}
                    href={tab.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                      isActive 
                        ? 'bg-[#5B4FFF] text-white shadow-sm' 
                        : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.name}
                  </Link>
                );
              })}
            </div>

            {/* Right: Quick Stats */}
            <div className="flex items-center justify-end gap-3 text-[13px] font-semibold text-[#4B5563] w-1/3">
              <span className="flex items-center gap-1.5 bg-[#F9FAFB] px-2.5 py-1 rounded-md border border-[#E5E7EB]">
                <Users className="h-3.5 w-3.5 text-[#9CA3AF]" />
                {opportunityStats.customers.toLocaleString()} 
                <span className="font-normal text-[#9CA3AF] text-[11px] ml-0.5">Customers</span>
              </span>
              <span className="flex items-center gap-1.5 bg-[#F0FDF4] text-[#166534] px-2.5 py-1 rounded-md border border-[#BBF7D0]">
                {opportunityStats.value >= 100000 
                  ? `₹${(opportunityStats.value / 100000).toFixed(1)}L`
                  : `₹${opportunityStats.value}`}
                <span className="font-medium text-[#15803D] text-[11px] ml-0.5">Value</span>
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative">
        {children}
      </div>
    </div>
  );
}
