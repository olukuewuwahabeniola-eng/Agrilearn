/**
 * Multipart upload with client-to-server progress.
 * Fetch cannot report upload progress; XMLHttpRequest can.
 */
export function uploadFormWithProgress({
  url,
  method = "POST",
  form,
  headers = {},
  credentials = "same-origin",
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = credentials === "include";

    Object.entries(headers).forEach(([key, value]) => {
      if (value) xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || !event.total) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.upload.onload = () => {
      if (onProgress) onProgress(100);
    };

    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText || "null");
      } catch {
        data = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }

      const error = new Error(
        (data && data.message) || `Request failed (${xhr.status})`
      );
      error.status = xhr.status;
      error.data = data;
      reject(error);
    };

    xhr.onerror = () => {
      reject(new Error("Network error during upload. Please try again."));
    };

    xhr.send(form);
  });
}
