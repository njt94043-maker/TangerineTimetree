const API = 'http://localhost:9123';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json();
}

// Library
export const getTracks = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<any[]>(`/api/library/tracks${qs ? `?${qs}` : ''}`);
};

export const getTrack = (id: string) => request<any>(`/api/library/tracks/${id}`);

export const updateTrack = (id: string, data: Record<string, any>) =>
  request(`/api/library/tracks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteTrack = (id: string) =>
  request(`/api/library/tracks/${id}`, { method: 'DELETE' });

export const playTrack = (id: string) =>
  request(`/api/library/tracks/${id}/play`, { method: 'POST' });

export const analyzeTrack = (id: string) =>
  request(`/api/library/tracks/${id}/analyze`, { method: 'POST' });

export const trackFileUrl = (id: string) => `${API}/api/library/tracks/${id}/file`;

// Tags
export const getTags = () => request<any[]>('/api/library/tags');
export const createTag = (name: string, color = '#f39c12') =>
  request('/api/library/tags', { method: 'POST', body: JSON.stringify({ name, color }) });
export const deleteTag = (id: string) =>
  request(`/api/library/tags/${id}`, { method: 'DELETE' });
export const addTagToTrack = (trackId: string, tagId: string) =>
  request(`/api/library/tracks/${trackId}/tags`, { method: 'POST', body: JSON.stringify({ tag_id: tagId }) });
export const removeTagFromTrack = (trackId: string, tagId: string) =>
  request(`/api/library/tracks/${trackId}/tags/${tagId}`, { method: 'DELETE' });

// Waveform
export const getWaveform = (id: string) => request<number[]>(`/api/waveform/${id}`);
export const thumbnailUrl = (id: string) => `${API}/api/waveform/${id}/thumbnail`;

// Capture
export const getCaptureStatus = (sessionId: string) =>
  request<any>(`/api/capture/status/${sessionId}`);
export const startWasapi = (deviceIndex?: number, tabTitle = '', sourceUrl = '') =>
  request<any>('/api/wasapi/start', {
    method: 'POST',
    body: JSON.stringify({ device_index: deviceIndex ?? null, tab_title: tabTitle, source_url: sourceUrl }),
  });

export const getTabInfo = () =>
  request<{ title: string; url: string }>('/api/capture/tab-info');
export const stopWasapi = (sessionId: string) =>
  request<any>(`/api/wasapi/stop/${sessionId}`, { method: 'POST' });
export const confirmWasapi = (sessionId: string) =>
  request<any>(`/api/wasapi/confirm/${sessionId}`, { method: 'POST' });
export const discardWasapi = (sessionId: string) =>
  request<any>(`/api/wasapi/discard/${sessionId}`, { method: 'POST' });
export const pauseCapture = (sessionId: string) =>
  request(`/api/capture/pause/${sessionId}`, { method: 'POST' });
export const resumeCapture = (sessionId: string) =>
  request(`/api/capture/resume/${sessionId}`, { method: 'POST' });
export const getWasapiDevices = () => request<any[]>('/api/wasapi/devices');

// Stats
export const getStats = () => request<any>('/api/stats');

// Health
export const checkHealth = async (): Promise<boolean> => {
  try {
    await request('/api/health');
    return true;
  } catch {
    return false;
  }
};

export const getHealth = () => request<{ status: string; uptime: number; ffmpeg: string }>('/api/health');

// Admin
export const restartBackend = () =>
  request<{ status: string }>('/api/admin/restart', { method: 'POST' });

export const getBackendLogs = (lines = 50) =>
  request<{ lines: string[] }>(`/api/admin/logs?lines=${lines}`);
