export const employees = Array.from({ length: 37 }, (_, i) => ({
  id: i + 1,
  name: `Employee ${i + 1}`,
  address: {
    street: `${100 + i} Elm St`,
    city: ['NYC', 'LA', 'Chicago', 'Houston'][i % 4],
    zip: `${10000 + i}`,
  },
  department: ['Engineering', 'Sales', 'Support'][i % 3],
  region: ['North', 'South', 'East', 'West'][i % 4],
  salary: 40000 + (i % 10) * 5000,
  active: i % 5 !== 0,
  joinedAt: new Date(2024, i % 12, (i % 27) + 1).toISOString(),
}));

export type Employee = (typeof employees)[number];

export const userDetails = {
  id: 'usr_8f3a21',
  name: 'Jane Doe',
  active: true,
  score: 50,
  themeColor: '#4f46e5',
  createdAt: '2024-01-15T10:30:00Z',
  bio: undefined,
  permissions: ['read', 'write', 'delete'],
  tags: ['important', 'urgent', 'archived'],
  reportFile: 'reports/annual-2024.pdf',
  feedback: { comment: 'Great service, would recommend!', author: 'Alex' },
  address: { street: '123 Main', city: 'NYC', zip: '10001' },
  settings: {
    theme: 'dark',
    features: { api: { enabled: true, version: 'v2' } },
  },
  users: Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    role: i === 0 ? 'admin' : 'viewer',
  })),
};
