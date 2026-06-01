'use client';

import { useState } from 'react';
import { Smartphone, Loader2, ExternalLink } from 'lucide-react';

interface GcashPaymentHostedProps {
  amount: number;
  orderId: string;
  onSuccess: () => void;
}

export function GcashPaymentHosted({ amount, orderId, onSuccess }: GcashPaymentHostedProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const createCheckout = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/create-checkout-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          description: `Order ${orderId}`,
          successUrl: `${window.location.origin}/order-confirmation?orderId=${orderId}`,
          cancelUrl: `${window.location.origin}/checkout`
        })
      });
      
      const data = await response.json();
      
      if (data.checkoutUrl) {
        setCheckoutUrl(data.checkoutUrl);
        // Redirect to PayMongo's hosted checkout page
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Failed to initiate payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-center space-y-4">
      <div className="bg-blue-50 rounded-lg p-4">
        <Smartphone className="h-12 w-12 text-blue-500 mx-auto mb-2" />
        <p className="font-semibold">GCash Payment</p>
        <p className="text-sm text-gray-600 mt-1">
          Amount: ₱{Math.round(amount).toLocaleString()}
        </p>
      </div>
      
      <button
        onClick={createCheckout}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Smartphone className="h-5 w-5" />
            Pay with GCash
            <ExternalLink className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}