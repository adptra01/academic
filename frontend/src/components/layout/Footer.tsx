// Next Imports
import Link from 'next/link'

const Footer = () => {
  return (
    <footer>
      <div className='text-muted-foreground mx-auto flex size-full max-w-360 items-center justify-between gap-3 px-4 py-3 max-sm:flex-col sm:gap-6 sm:px-6'>
        <p className='text-sm text-balance max-sm:text-center'>
          {`©${new Date().getFullYear()}`} Academic Research Platform · Mesin statistik deterministik
        </p>
        <div className='flex items-center gap-5 max-sm:hidden'>
          <Link href='/metode' className='text-muted-foreground hover:text-foreground text-sm transition duration-300'>
            Metode
          </Link>
          <Link href='/alur' className='text-muted-foreground hover:text-foreground text-sm transition duration-300'>
            Alur Kerja
          </Link>
          <Link href='/reproduksi' className='text-muted-foreground hover:text-foreground text-sm transition duration-300'>
            Reproduksi
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default Footer
