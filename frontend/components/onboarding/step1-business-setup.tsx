'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BusinessSetupProps {
  data: {
    companyName: string;
    industry: string;
  };
  onUpdate: (data: Partial<BusinessSetupProps['data']>) => void;
}

export function Step1BusinessSetup({ data, onUpdate }: BusinessSetupProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Business Setup</CardTitle>
        <CardDescription>
          Tell us about your business to get started
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName">
            Company Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="companyName"
            placeholder="Enter your company name"
            value={data.companyName}
            onChange={(e) => onUpdate({ companyName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">
            Industry <span className="text-red-500">*</span>
          </Label>
          <Select
            value={(data.industry || undefined) as any}
            onValueChange={(value) => onUpdate({ industry: value })}
          >
            <SelectTrigger id="industry">
              <SelectValue placeholder="Select your industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fashion">Fashion Retail</SelectItem>
              <SelectItem value="coffee">Coffee & Beverages</SelectItem>
              <SelectItem value="beauty">Beauty & Cosmetics</SelectItem>
              <SelectItem value="jewelry">Jewelry & Accessories</SelectItem>
              <SelectItem value="food">Food & Grocery</SelectItem>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </CardContent>
    </Card>
  );
}
