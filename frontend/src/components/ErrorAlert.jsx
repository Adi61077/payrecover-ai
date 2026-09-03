import React from 'react'
import { AlertCircle, X } from 'lucide-react'

export default function ErrorAlert({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-800/50 text-red-400">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <p className="text-sm flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="flex-shrink-0 hover:text-red-300">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
