interface PageSectionProps {
  children: React.ReactNode
  className?: string
}

export default function PageSection({
  children,
  className = '',
}: PageSectionProps) {
  return (
    <main
      className={`
        min-h-screen
        bg-[#f8f9fa]
        py-8
        lg:py-10
        ${className}
      `}
    >
      {children}
    </main>
  )
}