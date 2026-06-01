'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

export type Address = {
  id: string
  recipientFirstName: string
  recipientMiddleName?: string
  recipientLastName: string
  recipientExtensionName?: string
  phoneNumber: string
  province: string
  city: string
  barangay: string
  streetAddress: string
  zipCode: string
  landmark?: string
  isDefault: boolean
}

type AddressContextType = {
  addresses: Address[]
  selectedAddress: Address | null
  addAddress: (address: Address) => void
  updateAddress: (id: string, address: Address) => void
  deleteAddress: (id: string) => void
  setDefaultAddress: (id: string) => void
  selectAddress: (address: Address) => void
  loadAddresses: () => void
}

const AddressContext = createContext<AddressContextType | undefined>(undefined)

export function AddressProvider({ children }: { children: ReactNode }) {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const loadAddresses = useCallback(() => {
    // Only load if not initialized to prevent infinite loop
    if (isInitialized) return
    
    const stored = localStorage.getItem('userAddresses')
    if (stored) {
      const parsed = JSON.parse(stored)
      setAddresses(parsed)
      const defaultAddr = parsed.find((a: Address) => a.isDefault)
      const selected = localStorage.getItem('selectedAddress')
      if (selected) {
        setSelectedAddress(JSON.parse(selected))
      } else if (defaultAddr) {
        setSelectedAddress(defaultAddr)
      }
    } else {
      // Sample data for testing
      const sampleAddresses: Address[] = [
        {
          id: 'addr1',
          recipientFirstName: 'John',
          recipientLastName: 'Doe',
          phoneNumber: '09123456789',
          province: 'Metro Manila',
          city: 'Makati City',
          barangay: 'Barangay San Antonio',
          streetAddress: '123 Main Street',
          zipCode: '1200',
          isDefault: true
        }
      ]
      setAddresses(sampleAddresses)
      localStorage.setItem('userAddresses', JSON.stringify(sampleAddresses))
      setSelectedAddress(sampleAddresses[0])
      localStorage.setItem('selectedAddress', JSON.stringify(sampleAddresses[0]))
    }
    setIsInitialized(true)
  }, [isInitialized])

  useEffect(() => {
    loadAddresses()
  }, [loadAddresses])

  const saveAddresses = (newAddresses: Address[]) => {
    setAddresses(newAddresses)
    localStorage.setItem('userAddresses', JSON.stringify(newAddresses))
  }

  const addAddress = (address: Address) => {
    const newAddresses = [...addresses, address]
    saveAddresses(newAddresses)
  }

  const updateAddress = (id: string, updatedAddress: Address) => {
    const newAddresses = addresses.map(addr => addr.id === id ? updatedAddress : addr)
    saveAddresses(newAddresses)
    if (selectedAddress?.id === id) {
      setSelectedAddress(updatedAddress)
      localStorage.setItem('selectedAddress', JSON.stringify(updatedAddress))
    }
  }

  const deleteAddress = (id: string) => {
    const newAddresses = addresses.filter(addr => addr.id !== id)
    saveAddresses(newAddresses)
    if (selectedAddress?.id === id) {
      const newDefault = newAddresses.find(a => a.isDefault) || newAddresses[0]
      setSelectedAddress(newDefault || null)
      if (newDefault) localStorage.setItem('selectedAddress', JSON.stringify(newDefault))
      else localStorage.removeItem('selectedAddress')
    }
  }

  const setDefaultAddress = (id: string) => {
    const newAddresses = addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id
    }))
    saveAddresses(newAddresses)
  }

  const selectAddress = (address: Address) => {
    setSelectedAddress(address)
    localStorage.setItem('selectedAddress', JSON.stringify(address))
  }

  return (
    <AddressContext.Provider value={{ 
      addresses, 
      selectedAddress, 
      addAddress, 
      updateAddress, 
      deleteAddress, 
      setDefaultAddress, 
      selectAddress, 
      loadAddresses 
    }}>
      {children}
    </AddressContext.Provider>
  )
}

export function useAddress() {
  const context = useContext(AddressContext)
  if (context === undefined) {
    throw new Error('useAddress must be used within an AddressProvider')
  }
  return context
}