'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, ShoppingCart, Package } from 'lucide-react';

interface ReviewProps {
  data: {
    companyName: string;
    industry: string;
    totalCustomers: number;
    totalOrders: number;
    productsDetected: number;
  };
}

export function Step4Review({ data }: ReviewProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Review Your Data</CardTitle>
        <CardDescription>
          Please review the information before generating customer intelligence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 p-4 bg-gray-50 rounded-lg flex items-start space-x-3">
            <Building2 className="h-5 w-5 text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-500">Company</p>
              <p className="text-lg font-semibold text-gray-900">{data.companyName}</p>
              <p className="text-sm text-gray-600 capitalize">{data.industry}</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Users className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-900">Customers</p>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {data.totalCustomers.toLocaleString()}
            </p>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-900">Orders</p>
            </div>
            <p className="text-2xl font-bold text-green-900">
              {data.totalOrders.toLocaleString()}
            </p>
          </div>

          <div className="col-span-2 p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Package className="h-4 w-4 text-purple-600" />
              <p className="text-sm font-medium text-purple-900">Products Detected</p>
            </div>
            <p className="text-2xl font-bold text-purple-900">
              {data.productsDetected}
            </p>
            <p className="text-xs text-purple-700 mt-1">
              Automatically identified from order data
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6 text-center">
          <h3 className="font-semibold text-gray-900 mb-2">
            Ready to Generate Customer Intelligence
          </h3>
          <p className="text-sm text-gray-600">
            We&apos;ll analyze your data to identify customer segments, buying patterns,
            and growth opportunities
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
