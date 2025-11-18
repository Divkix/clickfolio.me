'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resumeContentSchema, type ResumeContentFormData } from '@/lib/schemas/resume'
import type { ResumeContent } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Save, CheckCircle2 } from 'lucide-react'

interface EditResumeFormProps {
  initialData: ResumeContent
  onSave: (data: ResumeContent) => Promise<void>
}

export function EditResumeForm({ initialData, onSave }: EditResumeFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  const form = useForm<ResumeContentFormData>({
    resolver: zodResolver(resumeContentSchema),
    defaultValues: {
      ...initialData,
      // Ensure arrays are never undefined
      experience: initialData.experience || [],
      education: initialData.education || [],
      skills: initialData.skills || [],
      certifications: initialData.certifications || [],
    },
  })

  const {
    fields: experienceFields,
    append: appendExperience,
    remove: removeExperience,
  } = useFieldArray({
    control: form.control,
    name: 'experience',
  })

  const {
    fields: educationFields,
    append: appendEducation,
    remove: removeEducation,
  } = useFieldArray({
    control: form.control,
    name: 'education',
  })

  const {
    fields: skillFields,
    append: appendSkill,
    remove: removeSkill,
  } = useFieldArray({
    control: form.control,
    name: 'skills',
  })

  const {
    fields: certificationFields,
    append: appendCertification,
    remove: removeCertification,
  } = useFieldArray({
    control: form.control,
    name: 'certifications',
  })

  const handleSave = useCallback(async (data: ResumeContent, isAutoSave = false) => {
    setIsSaving(true)
    try {
      await onSave(data)
      setLastSaved(new Date())
      if (!isAutoSave) {
        toast.success('Resume updated successfully!')
      }
    } catch (error) {
      console.error('Failed to save resume:', error)
      if (!isAutoSave) {
        toast.error('Failed to save resume. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }, [onSave])

  // Auto-save functionality with debounce
  useEffect(() => {
    const subscription = form.watch(() => {
      // Clear existing timeout
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }

      // Set new timeout for auto-save (3 seconds)
      const timeout = setTimeout(() => {
        const values = form.getValues()
        const result = resumeContentSchema.safeParse(values)

        if (result.success) {
          handleSave(result.data, true)
        }
      }, 3000)

      setAutoSaveTimeout(timeout)
    })

    return () => {
      subscription.unsubscribe()
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }
    }
  }, [form, handleSave, autoSaveTimeout])

  const onSubmit = async (data: ResumeContentFormData) => {
    await handleSave(data as ResumeContent, false)
  }

  const getCharacterCount = (fieldName: FieldPath<ResumeContentFormData>, maxLength: number) => {
    const value = form.watch(fieldName) as string | undefined
    const count = value?.length || 0
    return `${count}/${maxLength}`
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Save Status Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Last saved {lastSaved.toLocaleTimeString()}</span>
              </>
            ) : null}
          </div>
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Publish Changes
          </Button>
        </div>

        {/* Basic Information Section */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Your name, headline, and professional summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="headline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Professional Headline</FormLabel>
                  <FormControl>
                    <Input placeholder="Senior Software Engineer" {...field} />
                  </FormControl>
                  <FormDescription>
                    A brief title that describes your professional role ({getCharacterCount('headline', 200)})
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Professional Summary</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write a compelling summary of your professional background and key achievements..."
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Highlight your key skills and experience ({getCharacterCount('summary', 1000)})
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Contact Information Section */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>How people can reach you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="contact.email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact.phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormDescription>Visibility controlled in privacy settings</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact.location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="San Francisco, CA" {...field} />
                  </FormControl>
                  <FormDescription>Visibility controlled in privacy settings</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="contact.linkedin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://linkedin.com/in/johndoe"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact.github"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GitHub (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://github.com/johndoe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact.website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Website (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://johndoe.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Experience Section */}
        <Card>
          <CardHeader>
            <CardTitle>Work Experience</CardTitle>
            <CardDescription>Your professional work history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {experienceFields.map((field, index) => (
              <div key={field.id} className="space-y-4 p-4 border rounded-lg relative">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Position {index + 1}</Badge>
                  {experienceFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExperience(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`experience.${index}.title`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Senior Software Engineer" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`experience.${index}.company`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input placeholder="Tech Corp" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name={`experience.${index}.location`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="San Francisco, CA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`experience.${index}.start_date`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input placeholder="Jan 2020" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`experience.${index}.end_date`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input placeholder="Present" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name={`experience.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your key responsibilities and achievements..."
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {(field.value?.length || 0)}/2000 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                appendExperience({
                  title: '',
                  company: '',
                  location: '',
                  start_date: '',
                  end_date: '',
                  description: '',
                })
              }
              disabled={experienceFields.length >= 10}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Experience
            </Button>
          </CardContent>
        </Card>

        {/* Education Section */}
        <Card>
          <CardHeader>
            <CardTitle>Education</CardTitle>
            <CardDescription>Your educational background</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {educationFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No education entries yet.</p>
            ) : (
              educationFields.map((field, index) => (
                <div key={field.id} className="space-y-4 p-4 border rounded-lg relative">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Education {index + 1}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEducation(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`education.${index}.degree`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Degree</FormLabel>
                          <FormControl>
                            <Input placeholder="Bachelor of Science" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`education.${index}.institution`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Institution</FormLabel>
                          <FormControl>
                            <Input placeholder="University of Example" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`education.${index}.location`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input placeholder="Boston, MA" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`education.${index}.graduation_date`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Graduation Date</FormLabel>
                          <FormControl>
                            <Input placeholder="May 2020" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`education.${index}.gpa`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GPA (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="3.8" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                appendEducation({
                  degree: '',
                  institution: '',
                  location: '',
                  graduation_date: '',
                  gpa: '',
                })
              }
              disabled={educationFields.length >= 10}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Education
            </Button>
          </CardContent>
        </Card>

        {/* Skills Section */}
        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
            <CardDescription>Your technical and professional skills</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {skillFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills added yet.</p>
            ) : (
              skillFields.map((field, index) => (
                <div key={field.id} className="space-y-4 p-4 border rounded-lg relative">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Skill Category {index + 1}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSkill(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name={`skills.${index}.category`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="Programming Languages" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`skills.${index}.items`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Skills (comma-separated)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="JavaScript, TypeScript, Python"
                            value={field.value?.join(', ') || ''}
                            onChange={(e) => {
                              const items = e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter((s) => s.length > 0)
                              field.onChange(items)
                            }}
                          />
                        </FormControl>
                        <FormDescription>Separate each skill with a comma</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                appendSkill({
                  category: '',
                  items: [],
                })
              }
              disabled={skillFields.length >= 20}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Skill Category
            </Button>
          </CardContent>
        </Card>

        {/* Certifications Section */}
        <Card>
          <CardHeader>
            <CardTitle>Certifications (Optional)</CardTitle>
            <CardDescription>Professional certifications and credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {certificationFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No certifications added yet.</p>
            ) : (
              certificationFields.map((field, index) => (
                <div key={field.id} className="space-y-4 p-4 border rounded-lg relative">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Certification {index + 1}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCertification(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`certifications.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Certification Name</FormLabel>
                          <FormControl>
                            <Input placeholder="AWS Certified Solutions Architect" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`certifications.${index}.issuer`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Issuer</FormLabel>
                          <FormControl>
                            <Input placeholder="Amazon Web Services" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`certifications.${index}.date`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date Issued</FormLabel>
                          <FormControl>
                            <Input placeholder="Jan 2023" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`certifications.${index}.url`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credential URL</FormLabel>
                          <FormControl>
                            <Input
                              type="url"
                              placeholder="https://credentials.example.com/..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                appendCertification({
                  name: '',
                  issuer: '',
                  date: '',
                  url: '',
                })
              }
              disabled={certificationFields.length >= 20}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Certification
            </Button>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Publish Changes
          </Button>
        </div>
      </form>
    </Form>
  )
}
