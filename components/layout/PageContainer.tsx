interface PageContainerProps {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-lg',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
  xl: 'max-w-7xl',
}

export default function PageContainer({
  children,
  className = '',
  size = 'xl',
}: PageContainerProps) {
  return (
    <div
      className={`
        w-full
        mx-auto
        px-4
        sm:px-6
        lg:px-8
        ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </div>
  )
}