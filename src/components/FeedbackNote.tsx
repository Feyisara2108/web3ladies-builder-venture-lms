import { Star } from 'lucide-react'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MentorComment } from '@/types'

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('size-3', i < rating ? 'fill-primary text-primary' : 'text-muted-foreground')}
        />
      ))}
    </span>
  )
}

/** One piece of mentor feedback, tinted primary (timeline + review detail). */
export function FeedbackNote({
  comment,
  mentorName,
}: {
  comment: MentorComment
  mentorName?: string
}) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-primary">
          Mentor feedback{mentorName ? ` · ${mentorName}` : ''}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {comment.rating && <Stars rating={comment.rating} />}
          {timeAgo(comment.created_at)}
        </div>
      </div>
      <p className="mt-1 text-sm whitespace-pre-line">{comment.comment}</p>
    </div>
  )
}
