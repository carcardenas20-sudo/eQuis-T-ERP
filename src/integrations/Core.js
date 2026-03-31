import { getToken } from '@/api/localClient';

export async function UploadFile({ file }) {
  const formData = new FormData();
  formData.append('file', file);

  const token = getToken();
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Upload failed');
  }

  const result = await response.json();
  return { file_url: result.url };
}
