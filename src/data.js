export const initialCreator = {
  username: 'demo',
  name: 'Aarav Mehta',
  tagline: 'Making the internet a little more fun.',
  bio: 'Streamer, storyteller & professional chai enthusiast. Your support helps me make bigger, better things. Thanks for being here ✨',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&q=85',
  banner: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1800&q=85',
  instagram: 'aaravcreates',
  youtube: 'AaravCreates',
  website: 'aaravcreates.in',
}

export const initialSupporters = [
  { id: 's1', name: 'Priya S.', amount: 499, message: 'Your last video got me through a rough week. Keep going 💛', type: 'Shoutout', time: '2 min ago', status: 'new' },
  { id: 's2', name: 'Rohan', amount: 199, message: 'When is the next late-night stream?', type: 'Question', time: '18 min ago', status: 'new' },
  { id: 's3', name: 'Anonymous', amount: 99, message: 'Big fan since day one!', type: 'Support', time: '1 hr ago', status: 'done' },
  { id: 's4', name: 'Ananya', amount: 49, message: 'Play my favourite song on stream?', type: 'Song request', time: '3 hr ago', status: 'new' },
]

export const getSaved = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

export const save = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const formatRupees = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

export const creatorFromProfile = (profile) => ({
  ...initialCreator,
  username: profile.username,
  name: profile.display_name,
  tagline: profile.tagline,
  bio: profile.bio,
  avatar: profile.avatar_url || initialCreator.avatar,
  banner: profile.banner_url || initialCreator.banner,
  instagram: profile.links?.instagram || '',
  youtube: profile.links?.youtube || '',
  website: profile.links?.website || '',
})

export const supporterFromRecord = (record) => {
  const elapsed = Math.max(0, Date.now() - new Date(record.created_at).getTime())
  const minutes = Math.floor(elapsed / 60000)
  const time = minutes < 1 ? 'just now'
    : minutes < 60 ? `${minutes} min ago`
      : minutes < 1440 ? `${Math.floor(minutes / 60)} hr ago`
        : new Date(record.created_at).toLocaleDateString()

  return {
    id: record.id,
    name: record.is_anonymous ? 'Anonymous' : record.fan_name,
    amount: record.amount,
    message: record.message,
    type: record.request_type,
    time,
    status: record.status,
  }
}
