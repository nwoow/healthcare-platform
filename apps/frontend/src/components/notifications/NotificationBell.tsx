'use client'

import { useState, useRef } from 'react'
import useSWR from 'swr'
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Link,
  Divider,
  CircularProgress,
} from '@mui/material'
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NoneIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Assignment as AssignmentIcon,
  Article as ArticleIcon,
} from '@mui/icons-material'
import { submissionApi } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'approved' | 'rejected' | 'new_submission' | 'form_published'
  title: string
  message: string
  timestamp: string
  read: boolean
  link?: string
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function NotificationIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'approved':
      return <CheckCircleIcon sx={{ color: 'success.main' }} />
    case 'rejected':
      return <CancelIcon sx={{ color: 'error.main' }} />
    case 'new_submission':
      return <AssignmentIcon sx={{ color: 'primary.main' }} />
    case 'form_published':
      return <ArticleIcon sx={{ color: 'info.main' }} />
    default:
      return <AssignmentIcon sx={{ color: 'primary.main' }} />
  }
}

const CLINICIAN_ROLES = ['doctor', 'nurse', 'receptionist']

export function NotificationBell({ userId, role }: { userId: string; role?: string }) {
  const router = useRouter()
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const {
    data: notifications = [],
    isLoading,
    mutate,
  } = useSWR<Notification[]>(
    userId ? `notifications-${userId}` : null,
    () =>
      submissionApi
        .get<Notification[]>(`/submissions/notifications/${userId}`)
        .then((r) => r.data),
    { refreshInterval: 30000 },
  )

  const unreadCount = notifications.filter((n) => !n.read).length

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read)
    await Promise.allSettled(
      unread.map((n) =>
        submissionApi.patch(`/submissions/notifications/${n.id}/read`),
      ),
    )
    mutate()
  }

  function resolveLink(notification: Notification): string | null {
    if (!notification.link) return null
    // Route clinicians to their own submissions view, not the admin area
    if (CLINICIAN_ROLES.includes(role ?? '')) {
      return notification.link.replace('/admin/forms/submissions', '/clinician/submissions')
    }
    return notification.link
  }

  async function markOneRead(notification: Notification) {
    if (!notification.read) {
      await submissionApi
        .patch(`/submissions/notifications/${notification.id}/read`)
        .catch(() => {})
      mutate()
    }
    const link = resolveLink(notification)
    if (link) {
      router.push(link)
    }
    setOpen(false)
  }

  return (
    <>
      <IconButton
        ref={anchorRef}
        color="inherit"
        onClick={() => setOpen(true)}
        aria-label="notifications"
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: { sx: { width: 380, maxHeight: 480, display: 'flex', flexDirection: 'column' } },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Link
              component="button"
              variant="body2"
              onClick={markAllRead}
              sx={{ cursor: 'pointer', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Mark all read
            </Link>
          )}
        </Box>

        {/* Body */}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                gap: 1,
                color: 'text.secondary',
              }}
            >
              <NoneIcon sx={{ fontSize: 40 }} />
              <Typography variant="body2">All caught up</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((notification, idx) => (
                <Box key={notification.id}>
                  <ListItem
                    alignItems="flex-start"
                    onClick={() => markOneRead(notification)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: notification.read
                        ? 'transparent'
                        : 'rgba(14, 124, 123, 0.08)',
                      '&:hover': { bgcolor: 'action.hover' },
                      py: 1.5,
                    }}
                  >
                    <ListItemIcon sx={{ mt: 0.5, minWidth: 36 }}>
                      <NotificationIcon type={notification.type} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: notification.read ? 400 : 700 }}
                        >
                          {notification.title}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {notification.message} &bull; {timeAgo(notification.timestamp)}
                        </Typography>
                      }
                    />
                  </ListItem>
                  {idx < notifications.length - 1 && (
                    <Divider component="li" />
                  )}
                </Box>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  )
}
