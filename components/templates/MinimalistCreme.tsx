/**
 * MinimalistCreme Resume Template
 * A beautiful, professional resume layout with crème background and amber accents
 */

import type { ResumeContent } from '@/lib/types/database'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  MapPin,
  Linkedin,
  Github,
  Globe,
  Calendar,
  GraduationCap,
  Award,
  ExternalLink,
} from 'lucide-react'

interface MinimalistCremeProps {
  content: ResumeContent
  profile: {
    avatar_url: string | null
    handle: string
  }
}

/**
 * Extract initials from full name for avatar fallback
 * @example getInitials("Alex Rivera") → "AR"
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Format date range for experience/education
 */
function formatDateRange(startDate: string, endDate?: string | null): string {
  const start = new Date(startDate).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
  const end = endDate
    ? new Date(endDate).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : 'Present'
  return `${start} — ${end}`
}

export function MinimalistCreme({ content, profile }: MinimalistCremeProps) {
  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header Section */}
      <header className="bg-gradient-to-br from-amber-100 via-orange-100 to-amber-50 border-b border-amber-200">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <Avatar className="w-32 h-32 border-4 border-white shadow-lg ring-4 ring-amber-200">
              <AvatarImage
                src={profile.avatar_url || undefined}
                alt={content.full_name}
                className="object-cover aspect-square"
              />
              <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white text-3xl font-semibold">
                {getInitials(content.full_name)}
              </AvatarFallback>
            </Avatar>

            {/* Name and Headline */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
                {content.full_name}
              </h1>
              <p className="text-xl text-amber-800 font-medium mb-6">
                {content.headline}
              </p>

              {/* Contact Links */}
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                {content.contact.email && (
                  <a
                    href={`mailto:${content.contact.email}`}
                    className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-amber-700 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>{content.contact.email}</span>
                  </a>
                )}
                {content.contact.location && (
                  <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{content.contact.location}</span>
                  </div>
                )}
                {content.contact.linkedin && (
                  <a
                    href={content.contact.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-amber-700 transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                    <span>LinkedIn</span>
                  </a>
                )}
                {content.contact.github && (
                  <a
                    href={content.contact.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-amber-700 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    <span>GitHub</span>
                  </a>
                )}
                {content.contact.website && (
                  <a
                    href={content.contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-amber-700 transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Website</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Summary Section */}
        {content.summary && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              About
            </h2>
            <p className="text-gray-700 leading-relaxed text-lg">
              {content.summary}
            </p>
            <Separator className="mt-6 bg-amber-200" />
          </section>
        )}

        {/* Experience Section */}
        {content.experience && content.experience.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              Experience
            </h2>
            <div className="space-y-6">
              {content.experience.map((job, index) => (
                <Card
                  key={index}
                  className="border border-amber-100 shadow-md hover:shadow-lg transition-shadow duration-200 bg-white"
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {job.title}
                        </h3>
                        <p className="text-lg text-amber-800 font-medium">
                          {job.company}
                        </p>
                      </div>
                      <div className="flex flex-col items-start md:items-end gap-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {formatDateRange(job.start_date, job.end_date)}
                          </span>
                        </div>
                        {job.location && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <MapPin className="w-4 h-4" />
                            <span>{job.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 mb-3 leading-relaxed">
                      {job.description}
                    </p>
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="space-y-2 mt-4">
                        {job.highlights.map((highlight, hIndex) => (
                          <li
                            key={hIndex}
                            className="flex items-start gap-3 text-gray-600"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                            <span className="flex-1">{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Separator className="mt-8 bg-amber-200" />
          </section>
        )}

        {/* Education Section */}
        {content.education && content.education.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-amber-600" />
              Education
            </h2>
            <div className="space-y-4">
              {content.education.map((edu, index) => (
                <Card
                  key={index}
                  className="border border-amber-100 shadow-md hover:shadow-lg transition-shadow duration-200 bg-white"
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {edu.degree}
                        </h3>
                        <p className="text-amber-800 font-medium">
                          {edu.institution}
                        </p>
                        {edu.location && (
                          <p className="text-sm text-gray-500 mt-1">
                            {edu.location}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 flex flex-col items-start md:items-end gap-1">
                        {edu.graduation_date && (
                          <span>{edu.graduation_date}</span>
                        )}
                        {edu.gpa && (
                          <span className="text-amber-700 font-medium">
                            GPA: {edu.gpa}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Separator className="mt-8 bg-amber-200" />
          </section>
        )}

        {/* Skills Section */}
        {content.skills && content.skills.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Skills</h2>
            <div className="space-y-6">
              {content.skills.map((skillGroup, index) => (
                <div key={index}>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
                    {skillGroup.category}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {skillGroup.items.map((skill, sIndex) => (
                      <Badge
                        key={sIndex}
                        variant="secondary"
                        className="bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition-colors px-3 py-1 text-sm"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Separator className="mt-8 bg-amber-200" />
          </section>
        )}

        {/* Certifications Section */}
        {content.certifications && content.certifications.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-600" />
              Certifications
            </h2>
            <div className="space-y-3">
              {content.certifications.map((cert, index) => (
                <Card
                  key={index}
                  className="border border-amber-100 shadow-md hover:shadow-lg transition-shadow duration-200 bg-white"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {cert.name}
                        </h3>
                        <p className="text-amber-800">{cert.issuer}</p>
                        {cert.date && (
                          <p className="text-sm text-gray-500 mt-1">
                            Issued: {cert.date}
                          </p>
                        )}
                      </div>
                      {cert.url && (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-200 bg-gradient-to-br from-amber-100 via-orange-100 to-amber-50 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <p className="text-sm text-gray-600">
            Built with{' '}
            <a
              href="https://webresume.now"
              className="text-amber-800 hover:text-amber-900 font-medium transition-colors"
            >
              webresume.now
            </a>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Turn your PDF resume into a beautiful web portfolio in seconds
          </p>
        </div>
      </footer>
    </div>
  )
}
