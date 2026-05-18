import type { Metadata } from 'next'
import { TeamSection } from '@/components/TeamSection'

export const metadata: Metadata = {
  title: 'Team — ARCANA',
  description: 'The people building ARCANA.',
}

export default function TeamPage() {
  return <TeamSection />
}
