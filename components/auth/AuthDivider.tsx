'use client'

interface AuthDividerProps {
  text?: string
}

export function AuthDivider({ text = 'OR' }: AuthDividerProps) {
  return (
    <div className="relative flex items-center">
      <div className="flex-grow border-t border-slate-200" />
      <span className="mx-4 flex-shrink text-sm font-medium text-slate-500">
        {text}
      </span>
      <div className="flex-grow border-t border-slate-200" />
    </div>
  )
}
