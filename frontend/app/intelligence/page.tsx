'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ShoppingCart, TrendingUp, DollarSign, Crown } from 'lucide-react';
import { getIntelligencePreview } from '@/lib/api';

interface IntelligenceCustomer {
  name: string;
  totalSpent: string | number;
}

interface IntelligencePreview {
  totalCustomers?: number;
  totalOrders?: number;
  revenue?: number;
  avgOrderValue?: number;
  customerHealth?: {
    active: number;
    dormant: number;
    atRisk: number;
  };
  topCustomers?: IntelligenceCustomer[];
}

export default function IntelligencePage() {
  const [data, setData] = useState<IntelligencePreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getIntelligencePreview();
        setData(result);
      } catch (error) {
        console.error('Error loading intelligence:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <p className="text-gray-600">Loading customer intelligence...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <p className="text-gray-600">No data available. Please complete onboarding first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-8">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Intelligence Preview</h1>
          <p className="text-gray-600">Your customer data has been processed and analyzed</p>
        </div>

        {/* Business Overview */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Business Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalCustomers?.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalOrders?.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{((data.revenue || 0) / 100000).toFixed(1)}L
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{Math.round(data.avgOrderValue || 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Customer Health */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📈 Customer Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-green-900">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-900">
                  {data?.customerHealth?.active || 0}
                </div>
                <p className="text-xs text-green-700 mt-1">Engaged customers</p>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-yellow-900">Dormant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-900">
                  {data?.customerHealth?.dormant || 0}
                </div>
                <p className="text-xs text-yellow-700 mt-1">Haven&apos;t purchased recently</p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-red-900">At Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-900">
                  {data?.customerHealth?.atRisk || 0}
                </div>
                <p className="text-xs text-red-700 mt-1">Decreasing engagement</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Top Customers */}
        {data.topCustomers && data.topCustomers.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">👑 Top 3 Customers</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {data.topCustomers.map((customer: IntelligenceCustomer, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Crown className={`h-5 w-5 ${index === 0 ? 'text-yellow-500' : 'text-gray-400'}`} />
                        <span className="font-medium">{customer.name}</span>
                      </div>
                      <span className="font-bold text-primary">
                        ₹{parseFloat(String(customer.totalSpent)).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Next Steps */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>✨ What&apos;s Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              Your customer intelligence is ready. The Opportunity Engine is now available as the next AI layer.
            </p>
            <div className="mt-4">
              <Link
                href="/opportunities"
                className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"
              >
                Open Opportunities
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
