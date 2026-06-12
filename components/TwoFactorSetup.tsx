// components/TwoFactorSetup.tsx
"use client"

import { useState } from 'react'
import Image from 'next/image'
import { Loader2, Copy, Download, AlertCircle, CheckCircle } from 'lucide-react'

interface TwoFactorSetupProps {
  onComplete: () => void
  onCancel: () => void
}

export default function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'setup' | 'verify'>('setup')
  const [secret, setSecret] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const initSetup = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/2fa/setup', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSecret(data.secret)
        setQrCode(data.qrCode || '')
        setBackupCodes(data.backupCodes || [])
        setStep('verify')
      } else {
        setError(data.error || 'Failed to setup 2FA. Please try again.')
        if (response.status === 401) {
          setError('Session expired. Please refresh the page and try again.')
        }
      }
    } catch (err) {
      console.error('Setup error:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const verifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        onComplete()
      } else {
        setError(data.error || 'Invalid verification code. Please try again.')
      }
    } catch (err) {
      console.error('Verification error:', err)
      setError('Failed to verify code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copySecretKey = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    alert('Backup codes copied to clipboard! Save them in a secure place.')
  }

  const downloadBackupCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rocars-2fa-backup-codes-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (step === 'setup') {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 mb-1">
                Two-Factor Authentication Setup
              </p>
              <p className="text-sm text-blue-700">
                Two-factor authentication adds an extra layer of security to your account. 
                You will need to enter a 6-digit code from your authenticator app when signing in.
              </p>
            </div>
          </div>
        </div>
        
        <button
          onClick={initSetup}
          disabled={loading}
          className="w-full bg-black text-white py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition font-medium"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Setting up...</span>
            </div>
          ) : (
            'Begin Setup'
          )}
        </button>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Step 1: Secret Key */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs">1</span>
          Add to Authenticator App
        </h3>
        
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-3">
            Open your authenticator app (Google Authenticator, Microsoft Authenticator, or Authy) and scan the QR code or add this secret key:
          </p>
          
          {qrCode && (
            <div className="flex justify-center mb-3">
              <Image
                src={qrCode}
                alt="Two-factor authentication QR code"
                width={176}
                height={176}
                unoptimized
                className="h-44 w-44 rounded-lg border border-gray-200 bg-white p-2"
              />
            </div>
          )}
          
          <div className="bg-white rounded-lg border border-gray-300 p-3 mb-3">
            <code className="text-sm font-mono break-all block text-center">
              {secret}
            </code>
          </div>
          
          <button
            onClick={copySecretKey}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Secret Key
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-500 mt-3 text-center">
            Keep this secret private. Anyone with it can generate your login codes.
          </p>
        </div>
      </div>

      {/* Step 2: Verify Code */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs">2</span>
          Verify Setup
        </h3>
        
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-3">
            Enter the 6-digit code from your authenticator app to verify the setup:
          </p>
          
          <input
            type="text"
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
            maxLength={6}
            autoFocus
          />
        </div>
      </div>

      {/* Step 3: Backup Codes */}
      {backupCodes.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs">3</span>
            Save Backup Codes
          </h3>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800 mb-3">
              Save these backup codes in a secure place. You can use them to access your account if you lose your authenticator app.
            </p>
            
            <div className="bg-white rounded-lg p-3 font-mono text-sm grid grid-cols-2 gap-2 mb-3 border border-gray-200">
              {backupCodes.map((code, i) => (
                <div key={i} className="text-center font-bold text-gray-700">
                  {code}
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={copyBackupCodes}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                <Copy className="w-4 h-4" />
                Copy Codes
              </button>
              <button
                onClick={downloadBackupCodes}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={verifyAndEnable}
          disabled={loading || verificationCode.length !== 6}
          className="flex-1 bg-black text-white py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition font-medium"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying...</span>
            </div>
          ) : (
            'Enable 2FA'
          )}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
