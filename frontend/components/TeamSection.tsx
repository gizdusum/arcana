'use client'

import Image from 'next/image'
import { useState } from 'react'

const ACCENT = '#6e5ff0'
const ACCENT_BRIGHT = '#9d8ff5'

const members = [
  {
    slug: 'gizdusum',
    name: 'gizdusum',
    role: 'Founder & Technical Lead',
    desc: "Builds ARCANA's autonomous DeFi agent, smart contracts, vault logic, and on-chain execution layer.",
    skills: ['Smart Contracts', 'Autonomous Agents', 'Vault Logic', 'On-chain Execution'],
    links: [
      { icon: 'x',      href: 'https://x.com/gizdusumandnode', label: 'X profile' },
      { icon: 'github', href: 'https://github.com/gizdusum',   label: 'GitHub profile' },
    ],
  },
  {
    slug: 'sirald',
    name: 'Sirald',
    role: 'Growth & Communications Lead',
    desc: "Leads ARCANA's community presence, marketing communication, AMAs, partnerships, and public updates.",
    skills: ['Community', 'Marketing', 'AMAs', 'Partnerships'],
    links: [
      { icon: 'x', href: 'https://x.com/Sirald01', label: 'X profile' },
    ],
  },
]

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

function SkillPill({ label }: { label: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <span
      className="font-mono text-2xs uppercase tracking-widest px-2.5 py-0.5 rounded-sm cursor-default"
      style={{
        color: hovered ? 'var(--ink)' : 'var(--ink-3)',
        border: `1px solid ${hovered ? ACCENT : 'var(--border)'}`,
        background: hovered ? 'rgba(110,95,240,0.08)' : 'transparent',
        transition: 'all 200ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </span>
  )
}

function SocialLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      style={{
        color: hovered ? 'var(--arc)' : 'var(--ink-3)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        display: 'inline-flex',
        transition: 'color 200ms ease, transform 200ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon === 'x' ? <XIcon /> : <GithubIcon />}
    </a>
  )
}

function TeamCard({ member }: { member: typeof members[0] }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="flex flex-col rounded-sm"
      style={{
        background: hovered ? 'var(--surface-2)' : 'var(--surface)',
        border: `1px solid ${hovered ? ACCENT + '50' : 'var(--border)'}`,
        boxShadow: hovered ? '0 0 40px rgba(110,95,240,0.15)' : 'none',
        padding: '2.5rem',
        transform: hovered ? 'scale(1.01)' : 'scale(1)',
        transition: 'all 300ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div className="flex justify-center mb-6">
        <Image
          src={`/team/${member.slug}.jpg`}
          alt={member.name}
          width={128}
          height={128}
          className="rounded-full object-cover"
          style={{
            border: `2px solid ${hovered ? ACCENT_BRIGHT : ACCENT}`,
            boxShadow: hovered
              ? '0 0 48px rgba(110,95,240,0.5)'
              : '0 0 32px rgba(110,95,240,0.25)',
            transition: 'border-color 300ms ease, box-shadow 300ms ease',
            display: 'block',
          }}
        />
      </div>

      {/* Name */}
      <div className="text-center mb-2">
        <span
          className="font-mono text-xl font-medium tracking-wide"
          style={{
            color: 'var(--ink)',
            textShadow: '0 0 20px rgba(110,95,240,0.2)',
          }}
        >
          {member.name}
        </span>
      </div>

      {/* Role + accent underline */}
      <div className="flex flex-col items-center" style={{ marginTop: '8px', marginBottom: '16px' }}>
        <span
          className="font-mono text-xs font-medium uppercase"
          style={{
            color: 'var(--ink)',
            letterSpacing: '0.25em',
            marginBottom: '8px',
          }}
        >
          {member.role}
        </span>
        <div
          style={{
            width: '40px',
            height: '2px',
            background: 'rgba(110,95,240,0.7)',
            borderRadius: '1px',
          }}
        />
      </div>

      {/* Separator */}
      <div
        className="mx-auto mb-5"
        style={{
          width: '60%',
          height: '1px',
          background: 'var(--border)',
        }}
      />

      {/* Description */}
      <p
        className="font-mono text-xs leading-relaxed text-center mx-auto flex-grow mb-5"
        style={{
          color: 'var(--ink-2)',
          maxWidth: '360px',
        }}
      >
        {member.desc}
      </p>

      {/* Skills */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {member.skills.map((skill) => (
          <SkillPill key={skill} label={skill} />
        ))}
      </div>

      {/* Social links */}
      <div className="flex justify-center gap-4 mt-auto">
        {member.links.map((l) => (
          <SocialLink key={l.href} href={l.href} icon={l.icon} label={l.label} />
        ))}
      </div>
    </div>
  )
}

export function TeamSection() {
  return (
    <section
      className="px-6"
      style={{
        background: 'var(--bg)',
        paddingTop: '64px',
        paddingBottom: '96px',
        minHeight: 'calc(100vh - 3.5rem)',
      }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center" style={{ marginBottom: '80px' }}>
          <div
            className="font-mono text-xs tracking-widest uppercase mb-6"
            style={{ color: 'var(--ink-3)' }}
          >
            MEET THE BUILDERS
          </div>
          <h1
            className="font-mono font-light tracking-tight"
            style={{
              fontSize: 'clamp(2.2rem, 4vw, 3.5rem)',
              color: 'var(--ink)',
              marginBottom: '48px',
            }}
          >
            TEAM
          </h1>
          <p className="font-mono text-sm" style={{ color: 'var(--ink-2)' }}>
            The people building ARCANA.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {members.map((m) => (
            <TeamCard key={m.slug} member={m} />
          ))}
        </div>
      </div>
    </section>
  )
}
