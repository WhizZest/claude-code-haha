import { useEffect, useState } from 'react'

type Props = {
  text: string
  label?: string
  className?: string
}

export function CopyButton({ text, label = 'Copy', className = '' }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={className}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
