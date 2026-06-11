import { GetServerSideProps } from 'next'
import { getTokenPayload } from '../lib/auth'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const payload = getTokenPayload(ctx.req as any)
  if (payload?.role === 'admin') return { redirect: { destination: '/admin', permanent: false } }
  return { redirect: { destination: '/rider', permanent: false } }
}

export default function Home() { return null }
