'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

export type PaymentMethod = {
  id: string
  type: 'credit_card' | 'debit_card' | 'gcash' | 'paypal' | 'bank_transfer'
  lastFour?: string
  cardBrand?: string
  expiryMonth?: string
  expiryYear?: string
  cardholderName?: string
  email?: string
  accountName?: string
  accountNumber?: string
  isDefault: boolean
}

type PaymentContextType = {
  paymentMethods: PaymentMethod[]
  selectedPayment: PaymentMethod | null
  addPaymentMethod: (method: PaymentMethod) => void
  updatePaymentMethod: (id: string, method: PaymentMethod) => void
  deletePaymentMethod: (id: string) => void
  setDefaultPayment: (id: string) => void
  selectPayment: (method: PaymentMethod) => void
  loadPaymentMethods: () => void
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined)

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const loadPaymentMethods = useCallback(() => {
    if (isInitialized) return
    
    const stored = localStorage.getItem('userPaymentMethods')
    if (stored) {
      const parsed = JSON.parse(stored)
      setPaymentMethods(parsed)
      const defaultMethod = parsed.find((p: PaymentMethod) => p.isDefault)
      const selected = localStorage.getItem('selectedPaymentMethod')
      if (selected) {
        setSelectedPayment(JSON.parse(selected))
      } else if (defaultMethod) {
        setSelectedPayment(defaultMethod)
      }
    } else {
      // Sample data for testing
      const sampleMethods: PaymentMethod[] = [
        {
          id: 'pay1',
          type: 'credit_card',
          lastFour: '4242',
          cardBrand: 'visa',
          expiryMonth: '12',
          expiryYear: '2025',
          cardholderName: 'John Doe',
          isDefault: true
        }
      ]
      setPaymentMethods(sampleMethods)
      localStorage.setItem('userPaymentMethods', JSON.stringify(sampleMethods))
      setSelectedPayment(sampleMethods[0])
      localStorage.setItem('selectedPaymentMethod', JSON.stringify(sampleMethods[0]))
    }
    setIsInitialized(true)
  }, [isInitialized])

  useEffect(() => {
    loadPaymentMethods()
  }, [loadPaymentMethods])

  const savePaymentMethods = useCallback((newMethods: PaymentMethod[]) => {
    setPaymentMethods(newMethods)
    localStorage.setItem('userPaymentMethods', JSON.stringify(newMethods))
  }, [])

  const addPaymentMethod = useCallback((method: PaymentMethod) => {
    setPaymentMethods(prev => {
      const newMethods = [...prev, method]
      localStorage.setItem('userPaymentMethods', JSON.stringify(newMethods))
      return newMethods
    })
  }, [])

  const updatePaymentMethod = useCallback((id: string, updatedMethod: PaymentMethod) => {
    setPaymentMethods(prev => {
      const newMethods = prev.map(m => m.id === id ? updatedMethod : m)
      localStorage.setItem('userPaymentMethods', JSON.stringify(newMethods))
      if (selectedPayment?.id === id) {
        setSelectedPayment(updatedMethod)
        localStorage.setItem('selectedPaymentMethod', JSON.stringify(updatedMethod))
      }
      return newMethods
    })
  }, [selectedPayment])

  const deletePaymentMethod = useCallback((id: string) => {
    setPaymentMethods(prev => {
      const newMethods = prev.filter(m => m.id !== id)
      localStorage.setItem('userPaymentMethods', JSON.stringify(newMethods))
      if (selectedPayment?.id === id) {
        const newDefault = newMethods.find(m => m.isDefault) || newMethods[0]
        setSelectedPayment(newDefault || null)
        if (newDefault) localStorage.setItem('selectedPaymentMethod', JSON.stringify(newDefault))
        else localStorage.removeItem('selectedPaymentMethod')
      }
      return newMethods
    })
  }, [selectedPayment])

  const setDefaultPayment = useCallback((id: string) => {
    setPaymentMethods(prev => {
      const newMethods = prev.map(method => ({
        ...method,
        isDefault: method.id === id
      }))
      localStorage.setItem('userPaymentMethods', JSON.stringify(newMethods))
      return newMethods
    })
  }, [])

  const selectPayment = useCallback((method: PaymentMethod) => {
    setSelectedPayment(method)
    localStorage.setItem('selectedPaymentMethod', JSON.stringify(method))
  }, [])

  return (
    <PaymentContext.Provider value={{ 
      paymentMethods, 
      selectedPayment, 
      addPaymentMethod, 
      updatePaymentMethod, 
      deletePaymentMethod, 
      setDefaultPayment, 
      selectPayment, 
      loadPaymentMethods 
    }}>
      {children}
    </PaymentContext.Provider>
  )
}

export function usePayment() {
  const context = useContext(PaymentContext)
  if (context === undefined) {
    throw new Error('usePayment must be used within a PaymentProvider')
  }
  return context
}