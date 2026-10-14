import { Skeleton } from '@/components/ui/skeleton'

/** Fallback instan saat RSC segmen `(pages)` diambil (aturan 6.1/6.2 skill). Statis — tanpa fetch. */
const PagesLoading = () => {
  return (
    <div className='space-y-6' aria-busy='true'>
      <div className='space-y-2'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-4 w-72' />
      </div>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
      </div>
      <Skeleton className='h-64 w-full' />
    </div>
  )
}

export default PagesLoading
