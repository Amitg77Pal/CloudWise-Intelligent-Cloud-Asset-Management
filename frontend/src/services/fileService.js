import api from './api';

const sanitizeDownloadFileName = (rawName) => {
  const input = String(rawName || '').trim();
  if (!input) return 'download';
  const noPath = input.replace(/[\\/]/g, '_');
  const noControls = noPath.replace(/[\x00-\x1f\x7f]/g, '');
  const collapsed = noControls.replace(/\s+/g, ' ').trim();
  if (!collapsed || collapsed === '.' || collapsed === '..') return 'download';
  return collapsed.slice(0, 180);
};

const parseFilenameFromContentDisposition = (disposition) => {
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;\n]+)/i);
  if (utf8Match?.[1]) {
    try {
      return sanitizeDownloadFileName(decodeURIComponent(utf8Match[1]));
    } catch {
      // ignore
    }
  }

  const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
  if (match?.[1]) {
    return sanitizeDownloadFileName(match[1].replace(/['"]/g, '').trim());
  }

  return null;
};

const fileService = {
  uploadFile: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    };

    const response = await api.post('/api/files/upload', formData, config);
    return response.data;
  },

  getAllFiles: async (params = {}) => {
    try {
      const response = await api.get('/api/files', { params });
      // Ensure we always return an array
      return {
        success: true,
        data: Array.isArray(response.data) ? response.data : []
      };
    } catch (error) {
      console.error('Error fetching files:', error);
      return {
        success: false,
        data: []
      };
    }
  },

  getFileById: async (id) => {
    try {
      const response = await api.get(`/api/files/${id}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  deleteFile: async (id) => {
    try {
      const response = await api.delete(`/api/files/${id}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error deleting file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  downloadFile: async (id, fileName) => {
    try {
      // Stream file through backend — never exposes S3 URLs to the client
      const response = await api.get(`/api/files/${id}/download`, {
        responseType: 'blob',
      });

      // Try to extract filename from Content-Disposition header as fallback
      let downloadName = fileName;
      if (!downloadName) {
        const disposition = response.headers['content-disposition'];
        if (disposition) {
          const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match && match[1]) {
            downloadName = match[1].replace(/['"]/g, '');
          }
        }
      }
      downloadName = downloadName || 'download';

      // Create a blob URL and trigger download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { success: true };
    } catch (error) {
      console.error("Download failed:", error);
      return { success: false, error: error.message };
    }
  },

  downloadFilesZip: async (ids, fallbackName = 'my-files.zip') => {
    try {
      const response = await api.post(
        '/api/files/download-zip',
        { ids },
        { responseType: 'blob' }
      );
      // If the server returned JSON (error) as a blob, try to extract a useful message
      const contentType = response.headers?.['content-type'] || response.data?.type || '';
      if (String(contentType).includes('application/json')) {
        try {
          const text = await response.data.text();
          const parsed = JSON.parse(text);
          return { success: false, error: parsed?.error || parsed?.message || text };
        } catch (e) {
          return { success: false, error: 'Server returned an error for the ZIP download.' };
        }
      }

      const disposition = response.headers?.['content-disposition'];
      const headerName = parseFilenameFromContentDisposition(disposition);
      const downloadName = headerName || sanitizeDownloadFileName(fallbackName);

      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/zip' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return { success: true };
    } catch (error) {
      console.error('Bulk ZIP download failed:', error);
      // If backend returned an error as a blob (responseType blob), try to extract it
      if (error?.response?.data && typeof error.response.data.text === 'function') {
        try {
          const text = await error.response.data.text();
          try {
            const parsed = JSON.parse(text);
            return { success: false, error: parsed?.error || parsed?.message || text };
          } catch {
            return { success: false, error: text.slice(0, 400) };
          }
        } catch (e) {
          // fallthrough
        }
      }
      return { success: false, error: error.message };
    }
  },

  getCategories: async () => {
    try {
      const response = await api.get('/api/files/categories');
      return { success: true, data: response.data || [] };
    } catch (error) {
      console.error('Error fetching categories:', error);
      return { success: false, data: [] };
    }
  },

  updateCategory: async (id, category) => {
    try {
      const response = await api.put(`/api/files/${id}/category`, { category });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error updating category:', error);
      return { success: false, error: error.message };
    }
  },

  updateCategoryBulk: async (ids, category) => {
    try {
      const response = await api.put('/api/files/bulk/category', { ids, category });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Bulk category update failed:', error);
      return { success: false, error: error.message };
    }
  },

  reanalyzeFile: async (id) => {
    try {
      const response = await api.post(`/api/files/${id}/reanalyze`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error reanalyzing file:', error);
      return { success: false, error: error.message };
    }
  },

  deleteBulk: async (ids) => {
    try {
      const response = await api.delete('/api/files/bulk', { data: { ids } });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error in bulk delete:', error);
      return { success: false, error: error.message };
    }
  },

  searchFiles: async (query) => {
    try {
      const response = await api.get('/api/files/search', { params: { q: query } });
      return { success: true, data: response.data || [] };
    } catch (error) {
      console.error('Error searching files:', error);
      return { success: false, data: [] };
    }
  }
};

export default fileService;
